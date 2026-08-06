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

    [StructLayout(LayoutKind.Sequential)]
    public struct Point
    {
        public int X;
        public int Y;
    }

    public sealed class WindowInfo
    {
        public IntPtr Handle { get; set; }
        public string Title { get; set; }
        public Rect Bounds { get; set; }
        public Rect ClientBounds { get; set; }
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
    private static extern bool GetClientRect(IntPtr window, out Rect rect);

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr window, ref Point point);

    [DllImport("user32.dll", EntryPoint = "SetCursorPos")]
    private static extern bool NativeSetCursorPos(int x, int y);

    [DllImport("user32.dll", EntryPoint = "GetCursorPos")]
    private static extern bool NativeGetCursorPos(out Point point);

    [DllImport("user32.dll")]
    private static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);

    public static bool EnablePerMonitorV2()
    {
        return SetThreadDpiAwarenessContext(new IntPtr(-4)) != IntPtr.Zero;
    }

    public static bool SetCursorPos(int x, int y)
    {
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try { return NativeSetCursorPos(x, y); }
        finally { if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous); }
    }

    public static bool GetCursorPos(out Point point)
    {
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try { return NativeGetCursorPos(out point); }
        finally { if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous); }
    }

    public static WindowInfo[] VisibleWindows(int expectedProcessId)
    {
        var result = new List<WindowInfo>();
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try
        {
            EnumWindows((window, parameter) =>
            {
                uint processId;
                GetWindowThreadProcessId(window, out processId);
                if (processId != expectedProcessId || !IsWindowVisible(window)) return true;
                Rect rect;
                if (!GetWindowRect(window, out rect)) return true;
                Rect clientRect;
                Point clientOrigin = new Point();
                GetClientRect(window, out clientRect);
                ClientToScreen(window, ref clientOrigin);
                clientRect.Right = clientOrigin.X + clientRect.Right;
                clientRect.Bottom = clientOrigin.Y + clientRect.Bottom;
                clientRect.Left = clientOrigin.X;
                clientRect.Top = clientOrigin.Y;
                var title = new StringBuilder(256);
                GetWindowText(window, title, title.Capacity);
                result.Add(new WindowInfo { Handle = window, Title = title.ToString(), Bounds = rect, ClientBounds = clientRect });
                return true;
            }, IntPtr.Zero);
            return result.ToArray();
        }
        finally
        {
            if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous);
        }
    }
}
'@

if (-not [BlackHoleWindowProbe]::EnablePerMonitorV2()) {
  throw "Failed to enable per-monitor-v2 DPI awareness for the Windows probe."
}

function Get-AppWindows([int]$ProcessId) {
  return @([BlackHoleWindowProbe]::VisibleWindows($ProcessId))
}

function Wait-AppWindow([int]$ProcessId, [string]$Title, [bool]$Visible, [int]$TimeoutMilliseconds = 30000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title -eq $Title -or ($Title -eq "黑洞任务" -and $_.Title.StartsWith("黑洞任务|")) })
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

$diagnosticPath = Join-Path $env:TEMP "blackhole-tasks-native-cursor-diagnostics.txt"
$resolvedExePath = (Resolve-Path $ExePath).Path
$diagnosticMarkerPath = [System.IO.Path]::ChangeExtension($resolvedExePath, ".smoke-diagnostics")
Set-Content -LiteralPath $diagnosticMarkerPath -Value $diagnosticPath -NoNewline
$env:BLACKHOLE_SMOKE_DIAGNOSTICS = "1"
$env:BLACKHOLE_SMOKE_DIAGNOSTICS_PATH = $diagnosticPath
$process = Start-Process -FilePath $resolvedExePath -ArgumentList "--smoke-diagnostics=$diagnosticPath" -PassThru
try {
  $orb = Wait-AppWindow $process.Id "黑洞任务" $true
  Start-Sleep -Milliseconds 800
  $knownTitles = @("黑洞任务", "黑洞任务工作区", "快速新增任务")
  $initialWindows = @(Get-AppWindows $process.Id | Where-Object { $_.Title -in $knownTitles -or $_.Title.StartsWith("黑洞任务|") })
  $initialWindows | ForEach-Object {
    "STARTUP_WINDOW title=$($_.Title) outer=$($_.Bounds.Left),$($_.Bounds.Top),$($_.Bounds.Right),$($_.Bounds.Bottom) client=$($_.ClientBounds.Left),$($_.ClientBounds.Top),$($_.ClientBounds.Right),$($_.ClientBounds.Bottom)"
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

  $orbCenterX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)
  $orbCenterY = [int](($orb.ClientBounds.Top + $orb.ClientBounds.Bottom) / 2)
  if (-not [BlackHoleWindowProbe]::SetCursorPos($orbCenterX, $orbCenterY)) {
    throw "SetCursorPos failed for $orbCenterX,$orbCenterY."
  }
  $actualCursor = [BlackHoleWindowProbe+Point]::new()
  if (-not [BlackHoleWindowProbe]::GetCursorPos([ref]$actualCursor)) {
    throw "GetCursorPos failed after moving to the orb."
  }
  "SCRIPT_CURSOR requested=$orbCenterX,$orbCenterY actual=$($actualCursor.X),$($actualCursor.Y)"
  try {
    $workspace = Wait-AppWindow $process.Id "黑洞任务工作区" $true
  } catch {
    Get-AppWindows $process.Id | ForEach-Object {
      "HOVER_TIMEOUT_WINDOW title=$($_.Title) client=$($_.ClientBounds.Left),$($_.ClientBounds.Top),$($_.ClientBounds.Right),$($_.ClientBounds.Bottom)"
    }
    if (Test-Path $diagnosticPath) {
      "NATIVE_CURSOR_DIAGNOSTICS $(Get-Content -LiteralPath $diagnosticPath -Raw)"
    } else {
      "NATIVE_CURSOR_DIAGNOSTICS_MISSING path=$diagnosticPath"
    }
    Save-DesktopScreenshot (Join-Path $OutputDirectory "02-hover-timeout.png")
    throw
  }

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
  Remove-Item Env:BLACKHOLE_SMOKE_DIAGNOSTICS -ErrorAction SilentlyContinue
  Remove-Item Env:BLACKHOLE_SMOKE_DIAGNOSTICS_PATH -ErrorAction SilentlyContinue
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit(5000) | Out-Null
  }
  $diagnosticLog = Join-Path $env:LOCALAPPDATA "com.blackhole.tasks\logs\BlackHole Tasks.log"
  if (Test-Path $diagnosticLog) {
    Copy-Item -LiteralPath $diagnosticLog -Destination (Join-Path $OutputDirectory "BlackHole-Tasks.log") -Force
  }
  if (Test-Path $diagnosticPath) {
    Copy-Item -LiteralPath $diagnosticPath -Destination (Join-Path $OutputDirectory "native-cursor-diagnostics.txt") -Force
  }
}
