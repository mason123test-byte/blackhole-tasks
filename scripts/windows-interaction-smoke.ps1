param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-smoke"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public static class BlackHoleWindowProbe
{
    public delegate bool EnumWindowsProc(IntPtr window, IntPtr parameter);

    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    public sealed class WindowInfo
    {
        public IntPtr Handle { get; set; }
        public string Title { get; set; }
        public Rect Bounds { get; set; }
    }

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr parameter);

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maximumCount);

    [DllImport("user32.dll")]
    private static extern bool GetWindowRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int x, int y);

    public static WindowInfo[] VisibleWindows(int expectedProcessId)
    {
        var result = new List<WindowInfo>();
        EnumWindows((window, parameter) =>
        {
            uint processId;
            GetWindowThreadProcessId(window, out processId);
            if (processId != expectedProcessId || !IsWindowVisible(window)) return true;
            Rect rect;
            if (!GetWindowRect(window, out rect)) return true;
            var title = new StringBuilder(256);
            GetWindowText(window, title, title.Capacity);
            result.Add(new WindowInfo { Handle = window, Title = title.ToString(), Bounds = rect });
            return true;
        }, IntPtr.Zero);
        return result.ToArray();
    }
}
'@

function Get-AppWindows([int]$ProcessId) {
  return @([BlackHoleWindowProbe]::VisibleWindows($ProcessId))
}

function Wait-AppWindow([int]$ProcessId, [string]$Title, [bool]$Visible, [int]$TimeoutMilliseconds = 6000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object Title -EQ $Title)
    if (($match.Count -gt 0) -eq $Visible) {
      if ($Visible) { return $match[0] }
      return $null
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Window '$Title' did not reach visible=$Visible within ${TimeoutMilliseconds}ms."
}

function Save-DesktopScreenshot([string]$Path) {
  $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $bitmap = [System.Drawing.Bitmap]::new($screen.Width, $screen.Height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($screen.Left, $screen.Top, 0, 0, $bitmap.Size)
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

function Get-ColorDistance([System.Drawing.Color]$First, [System.Drawing.Color]$Second) {
  return [Math]::Abs([int]$First.R - [int]$Second.R) +
    [Math]::Abs([int]$First.G - [int]$Second.G) +
    [Math]::Abs([int]$First.B - [int]$Second.B)
}

$process = Start-Process -FilePath (Resolve-Path $ExePath) -PassThru
try {
  $orb = Wait-AppWindow $process.Id "黑洞任务" $true
  Start-Sleep -Milliseconds 800
  $knownTitles = @("黑洞任务", "黑洞任务工作区", "快速新增任务")
  $initialWindows = @(Get-AppWindows $process.Id | Where-Object { $_.Title -in $knownTitles })
  $initialWindows | ForEach-Object {
    "STARTUP_WINDOW title=$($_.Title) rect=$($_.Bounds.Left),$($_.Bounds.Top),$($_.Bounds.Right),$($_.Bounds.Bottom)"
  }
  if ($initialWindows.Count -ne 1) {
    throw "Expected only the orb at startup, found $($initialWindows.Count) visible app windows."
  }

  $initialScreenshot = Join-Path $OutputDirectory "01-orb-only.png"
  Save-DesktopScreenshot $initialScreenshot
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $initialScreenshot))
  try {
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $sampleY = [Math]::Max($screen.Top, [Math]::Min($screen.Bottom - 1, $orb.Bounds.Top + 5))
    $insideX = [Math]::Max($screen.Left, [Math]::Min($screen.Right - 1, $orb.Bounds.Left + 5))
    $outsideX = [Math]::Max($screen.Left, [Math]::Min($screen.Right - 1, $orb.Bounds.Left - 5))
    $inside = $bitmap.GetPixel($insideX - $screen.Left, $sampleY - $screen.Top)
    $outside = $bitmap.GetPixel($outsideX - $screen.Left, $sampleY - $screen.Top)
    $distance = Get-ColorDistance $inside $outside
    if ($distance -gt 48) {
      throw "Orb corner is not transparent enough (adjacent desktop color distance=$distance)."
    }
  } finally {
    $bitmap.Dispose()
  }

  $orbCenterX = [int](($orb.Bounds.Left + $orb.Bounds.Right) / 2)
  $orbCenterY = [int](($orb.Bounds.Top + $orb.Bounds.Bottom) / 2)
  [BlackHoleWindowProbe]::SetCursorPos($orbCenterX, $orbCenterY) | Out-Null
  $workspace = Wait-AppWindow $process.Id "黑洞任务工作区" $true

  $separated = $workspace.Bounds.Right -le $orb.Bounds.Left -or
    $workspace.Bounds.Left -ge $orb.Bounds.Right -or
    $workspace.Bounds.Bottom -le $orb.Bounds.Top -or
    $workspace.Bounds.Top -ge $orb.Bounds.Bottom
  if (-not $separated) {
    throw "Workspace overlaps the orb: orb=$($orb.Bounds.Left),$($orb.Bounds.Top),$($orb.Bounds.Right),$($orb.Bounds.Bottom) workspace=$($workspace.Bounds.Left),$($workspace.Bounds.Top),$($workspace.Bounds.Right),$($workspace.Bounds.Bottom)."
  }
  Save-DesktopScreenshot (Join-Path $OutputDirectory "02-hover-open.png")

  [BlackHoleWindowProbe]::SetCursorPos(1, 1) | Out-Null
  Wait-AppWindow $process.Id "黑洞任务工作区" $false | Out-Null

  $process.Refresh()
  $baselineThreads = $process.Threads.Count
  $baselineHandles = $process.HandleCount
  1..20 | ForEach-Object {
    [BlackHoleWindowProbe]::SetCursorPos($orbCenterX, $orbCenterY) | Out-Null
    Start-Sleep -Milliseconds 155
    [BlackHoleWindowProbe]::SetCursorPos(1, 1) | Out-Null
    Start-Sleep -Milliseconds 55
  }
  Start-Sleep -Milliseconds 750
  Wait-AppWindow $process.Id "黑洞任务工作区" $false | Out-Null
  $process.Refresh()
  if ($process.HasExited -or -not $process.Responding) {
    throw "Application exited or stopped responding during repeated hover cycles."
  }
  $threadGrowth = $process.Threads.Count - $baselineThreads
  $handleGrowth = $process.HandleCount - $baselineHandles
  if ($threadGrowth -gt 4) {
    throw "Thread count grew unexpectedly after hover cycles: delta=$threadGrowth."
  }
  if ($handleGrowth -gt 30) {
    throw "Handle count grew unexpectedly after hover cycles: delta=$handleGrowth."
  }

  $logPath = Join-Path $env:LOCALAPPDATA "com.blackhole.tasks\logs\BlackHole Tasks.log"
  if (-not (Test-Path $logPath) -or (Get-Item $logPath).Length -eq 0) {
    throw "Application log was not created or is empty: $logPath"
  }

  "WINDOWS_INTERACTION_SMOKE_OK pid=$($process.Id) threadsDelta=$threadGrowth handlesDelta=$handleGrowth"
} finally {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit(5000) | Out-Null
  }
}
