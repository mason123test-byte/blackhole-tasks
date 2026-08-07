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
    private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);

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

    public static bool ClickAt(int x, int y)
    {
        if (!SetCursorPos(x, y)) return false;
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        return true;
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

function Wait-OrbRenderReady([int]$ProcessId, [int]$TimeoutMilliseconds = 20000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  $lastTitle = ""
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title.StartsWith("黑洞任务|renderer=") })
    if ($match.Count -gt 0) {
      $lastTitle = $match[0].Title
      if ($lastTitle -match '^黑洞任务\|renderer=webgl2\|frame=ready\|energy=(\d+)\|size=(\d+)x(\d+)(?:\|diag=.*)?$' -and
        [int]$Matches[1] -gt 100 -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180) {
        return $match[0]
      }
      if ($lastTitle -match '^黑洞任务\|renderer=canvas2d\|') {
        throw "Orb fell back to Canvas2D instead of the reference WebGL2 renderer: $lastTitle"
      }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Orb did not produce a non-empty WebGL2 frame within ${TimeoutMilliseconds}ms; lastTitle='$lastTitle'."
}

function Wait-SceneSize([int]$ProcessId, [int]$MinimumWidth, [int]$MinimumHeight, [int]$TimeoutMilliseconds = 30000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
    if ($match.Count -eq 1) {
      $width = $match[0].ClientBounds.Right - $match[0].ClientBounds.Left
      $height = $match[0].ClientBounds.Bottom - $match[0].ClientBounds.Top
      if ($width -ge $MinimumWidth -and $height -ge $MinimumHeight) { return $match[0] }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Single scene did not reach at least ${MinimumWidth}x${MinimumHeight} within ${TimeoutMilliseconds}ms."
}

function Wait-SceneCompact([int]$ProcessId, [int]$MaximumWidth = 300, [int]$MaximumHeight = 230, [int]$TimeoutMilliseconds = 30000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
    if ($match.Count -eq 1) {
      $width = $match[0].ClientBounds.Right - $match[0].ClientBounds.Left
      $height = $match[0].ClientBounds.Bottom - $match[0].ClientBounds.Top
      if ($width -le $MaximumWidth -and $height -le $MaximumHeight) { return $match[0] }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Single scene did not return below ${MaximumWidth}x${MaximumHeight} within ${TimeoutMilliseconds}ms."
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

function Save-ScreenRegion([string]$Path, $Bounds, [int]$Padding = 0) {
  $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $left = [Math]::Max($screen.Left, $Bounds.Left - $Padding)
  $top = [Math]::Max($screen.Top, $Bounds.Top - $Padding)
  $right = [Math]::Min($screen.Right, $Bounds.Right + $Padding)
  $bottom = [Math]::Min($screen.Bottom, $Bounds.Bottom + $Padding)
  $width = [Math]::Max(1, $right - $left)
  $height = [Math]::Max(1, $bottom - $top)
  $bitmap = [System.Drawing.Bitmap]::new($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.CopyFromScreen($left, $top, 0, 0, $bitmap.Size)
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
$stdoutPath = Join-Path $OutputDirectory "process-stdout.log"
$stderrPath = Join-Path $OutputDirectory "process-stderr.log"
[BlackHoleWindowProbe]::SetCursorPos(1, 1) | Out-Null
$process = Start-Process -FilePath $resolvedExePath `
  -ArgumentList "--smoke-diagnostics=$diagnosticPath" `
  -RedirectStandardOutput $stdoutPath `
  -RedirectStandardError $stderrPath `
  -PassThru
try {
  try {
    # WebView2's first cold start on a fresh GitHub runner can exceed 30 seconds
    # immediately after the release linker and installer builders finish.
    $orb = Wait-AppWindow $process.Id "黑洞任务" $true 90000
  } catch {
    $process.Refresh()
    "STARTUP_TIMEOUT pid=$($process.Id) exited=$($process.HasExited) exitCode=$(if ($process.HasExited) { $process.ExitCode } else { 'running' })"
    if (Test-Path $diagnosticPath) {
      "STARTUP_DIAGNOSTICS $(Get-Content -LiteralPath $diagnosticPath -Raw)"
    }
    if (Test-Path $stdoutPath) {
      "STARTUP_STDOUT $(Get-Content -LiteralPath $stdoutPath -Raw)"
    }
    if (Test-Path $stderrPath) {
      "STARTUP_STDERR $(Get-Content -LiteralPath $stderrPath -Raw)"
    }
    throw
  }
  Start-Sleep -Milliseconds 1000
  Save-DesktopScreenshot (Join-Path $OutputDirectory "00-before-render-check.png")
  Save-ScreenRegion (Join-Path $OutputDirectory "00-before-render-closeup.png") $orb.ClientBounds 16
  $orb = Wait-OrbRenderReady $process.Id
  Start-Sleep -Milliseconds 800
  $initialWindows = @(Get-AppWindows $process.Id | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
  $initialWindows | ForEach-Object {
    "STARTUP_WINDOW title=$($_.Title) outer=$($_.Bounds.Left),$($_.Bounds.Top),$($_.Bounds.Right),$($_.Bounds.Bottom) client=$($_.ClientBounds.Left),$($_.ClientBounds.Top),$($_.ClientBounds.Right),$($_.ClientBounds.Bottom)"
  }
  if ($initialWindows.Count -ne 1) {
    throw "Expected one single-scene window at startup, found $($initialWindows.Count)."
  }

  $initialScreenshot = Join-Path $OutputDirectory "01-orb-only.png"
  Save-DesktopScreenshot $initialScreenshot
  Save-ScreenRegion (Join-Path $OutputDirectory "01-orb-closeup.png") $orb.ClientBounds 16
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
  if (-not [BlackHoleWindowProbe]::ClickAt($orbCenterX, $orbCenterY)) {
    throw "ClickAt failed for compact scene center $orbCenterX,$orbCenterY."
  }
  $actualCursor = [BlackHoleWindowProbe+Point]::new()
  if (-not [BlackHoleWindowProbe]::GetCursorPos([ref]$actualCursor)) {
    throw "GetCursorPos failed after moving to the orb."
  }
  "SCRIPT_CURSOR requested=$orbCenterX,$orbCenterY actual=$($actualCursor.X),$($actualCursor.Y)"
  $expanded = Wait-SceneSize $process.Id 800 600
  $expandedWindows = @(Get-AppWindows $process.Id | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
  if ($expandedWindows.Count -ne 1) {
    throw "Expansion created another native window; expected 1, found $($expandedWindows.Count)."
  }
  Save-DesktopScreenshot (Join-Path $OutputDirectory "02-single-scene-expanded.png")
  Save-ScreenRegion (Join-Path $OutputDirectory "02-single-scene-closeup.png") $expanded.ClientBounds 8

  $collapseX = $expanded.ClientBounds.Left + [int](($expanded.ClientBounds.Right - $expanded.ClientBounds.Left) * 0.74)
  $collapseY = $expanded.ClientBounds.Top + 45
  if (-not [BlackHoleWindowProbe]::ClickAt($collapseX, $collapseY)) {
    throw "Failed to click the in-scene collapse control."
  }
  $orb = Wait-SceneCompact $process.Id

  $process.Refresh()
  $baselineThreads = $process.Threads.Count
  $baselineHandles = $process.HandleCount
  1..12 | ForEach-Object {
    $compactCenterX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)
    $compactCenterY = [int](($orb.ClientBounds.Top + $orb.ClientBounds.Bottom) / 2)
    [BlackHoleWindowProbe]::ClickAt($compactCenterX, $compactCenterY) | Out-Null
    $expanded = Wait-SceneSize $process.Id 800 600 10000
    $collapseX = $expanded.ClientBounds.Left + [int](($expanded.ClientBounds.Right - $expanded.ClientBounds.Left) * 0.74)
    $collapseY = $expanded.ClientBounds.Top + 45
    [BlackHoleWindowProbe]::ClickAt($collapseX, $collapseY) | Out-Null
    $orb = Wait-SceneCompact $process.Id 300 230 10000
  }
  Start-Sleep -Milliseconds 750
  $process.Refresh()
  if ($process.HasExited -or -not $process.Responding) {
    throw "Application exited or stopped responding during repeated single-window resize cycles."
  }
  $threadGrowth = $process.Threads.Count - $baselineThreads
  $handleGrowth = $process.HandleCount - $baselineHandles
  if ($threadGrowth -gt 4) {
    throw "Thread count grew unexpectedly after resize cycles: delta=$threadGrowth."
  }
  if ($handleGrowth -gt 30) {
    throw "Handle count grew unexpectedly after resize cycles: delta=$handleGrowth."
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
