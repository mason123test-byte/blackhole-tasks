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
using System.Threading;

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

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(
        IntPtr window,
        IntPtr insertAfter,
        int x,
        int y,
        int width,
        int height,
        uint flags
    );

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

    public static bool MoveTopLeft(IntPtr window, int x, int y)
    {
        const uint SWP_NOSIZE = 0x0001;
        const uint SWP_NOZORDER = 0x0004;
        const uint SWP_NOACTIVATE = 0x0010;
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try
        {
            return SetWindowPos(
                window,
                IntPtr.Zero,
                x,
                y,
                0,
                0,
                SWP_NOSIZE | SWP_NOZORDER | SWP_NOACTIVATE
            );
        }
        finally { if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous); }
    }

    public static bool ClickAt(int x, int y)
    {
        if (!SetCursorPos(x, y)) return false;
        Thread.Sleep(80);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        return true;
    }

    public static bool DragFromTo(int startX, int startY, int endX, int endY)
    {
        if (!SetCursorPos(startX, startY)) return false;
        Thread.Sleep(100);
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(80);
        const int steps = 18;
        for (var step = 1; step <= steps; step++)
        {
            var progress = (double)step / steps;
            var x = (int)Math.Round(startX + (endX - startX) * progress);
            var y = (int)Math.Round(startY + (endY - startY) * progress);
            if (!SetCursorPos(x, y))
            {
                mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
                return false;
            }
            Thread.Sleep(30);
        }
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

function Ensure-WindowOnVirtualScreen([int]$ProcessId, $Window) {
  $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $width = $Window.Bounds.Right - $Window.Bounds.Left
  $height = $Window.Bounds.Bottom - $Window.Bounds.Top
  $maximumLeft = [Math]::Max($screen.Left, $screen.Right - $width)
  $maximumTop = [Math]::Max($screen.Top, $screen.Bottom - $height)
  $targetLeft = [Math]::Min([Math]::Max($Window.Bounds.Left, $screen.Left), $maximumLeft)
  $targetTop = [Math]::Min([Math]::Max($Window.Bounds.Top, $screen.Top), $maximumTop)
  if ($targetLeft -eq $Window.Bounds.Left -and $targetTop -eq $Window.Bounds.Top) {
    return $Window
  }
  $before = "$($Window.Bounds.Left),$($Window.Bounds.Top),$($Window.Bounds.Right),$($Window.Bounds.Bottom)"
  if (-not [BlackHoleWindowProbe]::MoveTopLeft($Window.Handle, $targetLeft, $targetTop)) {
    throw "Failed to move expanded scene into the visible virtual screen."
  }
  Start-Sleep -Milliseconds 250
  $moved = Wait-SceneSize $ProcessId 800 600 5000
  "SCENE_REPOSITION before=$before after=$($moved.Bounds.Left),$($moved.Bounds.Top),$($moved.Bounds.Right),$($moved.Bounds.Bottom) screen=$($screen.Left),$($screen.Top),$($screen.Right),$($screen.Bottom)"
  return $moved
}

function Get-SceneClosePoint($Window) {
  $clientWidth = $Window.ClientBounds.Right - $Window.ClientBounds.Left
  $toolbarWidth = [Math]::Min(560, [Math]::Max(1, $clientWidth - 64))
  $toolbarLeft = $Window.ClientBounds.Left + [int](($clientWidth - $toolbarWidth) / 2)
  $toolbarRight = $toolbarLeft + $toolbarWidth
  return [PSCustomObject]@{
    X = $toolbarRight - 18
    Y = $Window.ClientBounds.Top + 27
    Left = $toolbarLeft
    Top = $Window.ClientBounds.Top + 13
    Right = $toolbarRight
    Bottom = $Window.ClientBounds.Top + 44
  }
}

function Invoke-SceneCloseClick($Window, [string]$Attempt) {
  $target = Get-SceneClosePoint $Window
  if (-not [BlackHoleWindowProbe]::ClickAt($target.X, $target.Y)) {
    throw "Failed to click the in-scene close control at $($target.X),$($target.Y)."
  }
  $actual = [BlackHoleWindowProbe+Point]::new()
  if (-not [BlackHoleWindowProbe]::GetCursorPos([ref]$actual)) {
    throw "GetCursorPos failed after clicking the in-scene close control."
  }
  "CLOSE_TARGET attempt=$Attempt toolbar=$($target.Left),$($target.Top),$($target.Right),$($target.Bottom) requested=$($target.X),$($target.Y) actual=$($actual.X),$($actual.Y)"
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

function Write-BlackHoleColorEvidence(
  [string]$ScreenshotPath,
  $Window,
  [string]$Label,
  [string]$EvidencePath
) {
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path $ScreenshotPath))
  try {
    $screen = [System.Windows.Forms.SystemInformation]::VirtualScreen
    $centerX = [int](($Window.ClientBounds.Left + $Window.ClientBounds.Right) / 2) - $screen.Left
    $centerY = [int](($Window.ClientBounds.Top + $Window.ClientBounds.Bottom) / 2) - $screen.Top
    $left = [Math]::Max(0, $centerX - 120)
    $top = [Math]::Max(0, $centerY - 90)
    $right = [Math]::Min($bitmap.Width - 1, $centerX + 119)
    $bottom = [Math]::Min($bitmap.Height - 1, $centerY + 89)
    $warm = 0
    $neutralBright = 0
    $dark = 0
    $luminous = 0
    for ($y = $top; $y -le $bottom; $y += 2) {
      for ($x = $left; $x -le $right; $x += 2) {
        $pixel = $bitmap.GetPixel($x, $y)
        if ($pixel.R -gt 96 -or $pixel.G -gt 96 -or $pixel.B -gt 96) {
          $luminous++
        }
        if ($pixel.R -ge 120 -and
            $pixel.R -gt $pixel.G + 15 -and
            $pixel.G -gt $pixel.B + 15) {
          $warm++
        }
        if ($pixel.R -ge 210 -and $pixel.G -ge 210 -and $pixel.B -ge 210 -and
            ([Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B)) -
             [Math]::Min($pixel.R, [Math]::Min($pixel.G, $pixel.B))) -lt 18) {
          $neutralBright++
        }
        if ($pixel.R -lt 35 -and $pixel.G -lt 35 -and $pixel.B -lt 35) {
          $dark++
        }
      }
    }
    "label=$Label luminous=$luminous warm=$warm neutralBright=$neutralBright dark=$dark crop=$left,$top,$right,$bottom" |
      Add-Content -LiteralPath $EvidencePath
  } finally {
    $bitmap.Dispose()
  }
}

function Get-ColorDistance([System.Drawing.Color]$First, [System.Drawing.Color]$Second) {
  return [Math]::Abs([int]$First.R - [int]$Second.R) +
    [Math]::Abs([int]$First.G - [int]$Second.G) +
    [Math]::Abs([int]$First.B - [int]$Second.B)
}

$diagnosticPath = Join-Path $env:TEMP "blackhole-tasks-native-cursor-$([Guid]::NewGuid().ToString('N')).txt"
$smokeCommandPath = [System.IO.Path]::ChangeExtension($diagnosticPath, ".command")
$smokeSnapshotPath = [System.IO.Path]::ChangeExtension($diagnosticPath, ".snapshot.json")
$smokeSnapshotSequence = 0
$smokeTransportSequence = 0
$smokeCommandFiles = [System.Collections.Generic.List[string]]::new()
Remove-Item -LiteralPath $smokeSnapshotPath -ErrorAction SilentlyContinue
function Write-SmokeCommand([string]$Command) {
  $script:smokeTransportSequence += 1
  $publishedPath = "{0}.{1:D6}.cmd" -f $smokeCommandPath, $script:smokeTransportSequence
  $temporaryPath = "$publishedPath.tmp"
  $script:smokeCommandFiles.Add($publishedPath)
  try {
    [System.IO.File]::WriteAllText($temporaryPath, $Command, [System.Text.UTF8Encoding]::new($false))
    [System.IO.File]::Move($temporaryPath, $publishedPath)
  } finally {
    Remove-Item -LiteralPath $temporaryPath -ErrorAction SilentlyContinue
  }
}
function Get-SmokeTaskSnapshot([int]$TimeoutMilliseconds = 15000) {
  $script:smokeSnapshotSequence += 1
  $expectedSequence = $script:smokeSnapshotSequence
  Write-SmokeCommand "snapshot:$expectedSequence"
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  do {
    if (Test-Path $smokeSnapshotPath) {
      try {
        $snapshot = Get-Content -LiteralPath $smokeSnapshotPath -Raw | ConvertFrom-Json
        if ([int]$snapshot.sequence -eq $expectedSequence) { return $snapshot }
      } catch {
        # The monitor replaces this small JSON file without locking. Retry if a
        # read lands between truncate and write.
      }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Smoke snapshot $expectedSequence was not written within ${TimeoutMilliseconds}ms."
}
function Wait-SmokeTaskState(
  [string]$Title,
  [bool]$Exists,
  [string]$Quadrant = "",
  [string]$Status = "",
  [int]$TimeoutMilliseconds = 10000
) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  $lastState = "missing"
  do {
    $snapshot = Get-SmokeTaskSnapshot
    $matches = @($snapshot.tasks | Where-Object { $_.title -eq $Title })
    if ($matches.Count -gt 0) {
      $lastState = ($matches | ForEach-Object { "$($_.quadrant)/$($_.status)" }) -join ","
    } else {
      $lastState = "missing"
    }
    if (-not $Exists -and $matches.Count -eq 0) { return $snapshot }
    if ($Exists -and $matches.Count -eq 1 -and
        (!$Quadrant -or $matches[0].quadrant -eq $Quadrant) -and
        (!$Status -or $matches[0].status -eq $Status)) {
      return $snapshot
    }
    Start-Sleep -Milliseconds 75
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Task '$Title' did not reach exists=$Exists quadrant='$Quadrant' status='$Status'; lastState=$lastState."
}

function Capture-VisualComparisonFrame(
  [string]$ResolvedExePath,
  [string]$Mode,
  [string]$OutputPath
) {
  $modeDiagnostics = Join-Path $OutputDirectory "visual-$Mode-diagnostics.txt"
  $env:BLACKHOLE_VISUAL_COMPARE = $Mode
  $visualProcess = Start-Process -FilePath $ResolvedExePath `
    -ArgumentList "--smoke-diagnostics=$modeDiagnostics" `
    -PassThru
  try {
    $orbWindow = Wait-AppWindow $visualProcess.Id "黑洞任务" $true 90000
    $orbWindow = Wait-OrbRenderReady $visualProcess.Id
    $centerX = [int](($orbWindow.ClientBounds.Left + $orbWindow.ClientBounds.Right) / 2)
    $centerY = [int](($orbWindow.ClientBounds.Top + $orbWindow.ClientBounds.Bottom) / 2)
    if (-not [BlackHoleWindowProbe]::ClickAt($centerX, $centerY)) {
      throw "Failed to expand $Mode visual comparison at $centerX,$centerY."
    }
    $expandedWindow = Wait-SceneSize $visualProcess.Id 800 600 30000
    $expandedWindow = Ensure-WindowOnVirtualScreen $visualProcess.Id $expandedWindow
    Start-Sleep -Milliseconds 1600
    Save-ScreenRegion $OutputPath $expandedWindow.ClientBounds
    "VISUAL_COMPARISON_CAPTURE mode=$Mode path=$OutputPath size=$($expandedWindow.ClientBounds.Right - $expandedWindow.ClientBounds.Left)x$($expandedWindow.ClientBounds.Bottom - $expandedWindow.ClientBounds.Top)"
  } finally {
    Remove-Item Env:BLACKHOLE_VISUAL_COMPARE -ErrorAction SilentlyContinue
    if (-not $visualProcess.HasExited) {
      Stop-Process -Id $visualProcess.Id -Force
      $visualProcess.WaitForExit(5000) | Out-Null
    }
    Start-Sleep -Milliseconds 500
  }
}

function Get-BrightMaskMetrics(
  [System.Drawing.Bitmap]$Baseline,
  [System.Drawing.Bitmap]$Candidate,
  [int]$Left,
  [int]$Top,
  [int]$Right,
  [int]$Bottom
) {
  $intersection = 0
  $union = 0
  $xor = 0
  for ($y = $Top; $y -lt $Bottom; $y++) {
    for ($x = $Left; $x -lt $Right; $x++) {
      $before = $Baseline.GetPixel($x, $y)
      $after = $Candidate.GetPixel($x, $y)
      $beforeBright = [Math]::Max($before.R, [Math]::Max($before.G, $before.B)) -ge 96
      $afterBright = [Math]::Max($after.R, [Math]::Max($after.G, $after.B)) -ge 96
      if ($beforeBright -or $afterBright) { $union++ }
      if ($beforeBright -and $afterBright) { $intersection++ }
      if ($beforeBright -ne $afterBright) { $xor++ }
    }
  }
  $iou = if ($union -eq 0) { 1.0 } else { [double]$intersection / [double]$union }
  [PSCustomObject]@{ Intersection = $intersection; Union = $union; Xor = $xor; IoU = $iou }
}

function Get-BrightPixelCount(
  [System.Drawing.Bitmap]$Bitmap,
  [int]$Left,
  [int]$Top,
  [int]$Right,
  [int]$Bottom
) {
  $count = 0
  for ($y = $Top; $y -lt $Bottom; $y++) {
    for ($x = $Left; $x -lt $Right; $x++) {
      $pixel = $Bitmap.GetPixel($x, $y)
      if ([Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B)) -ge 96) {
        $count++
      }
    }
  }
  return $count
}

function Write-VisualComparisonEvidence(
  [string]$BaselinePath,
  [string]$CandidatePath,
  [string]$DifferencePath,
  [string]$MetricsPath
) {
  $baseline = [System.Drawing.Bitmap]::FromFile((Resolve-Path $BaselinePath))
  $candidate = [System.Drawing.Bitmap]::FromFile((Resolve-Path $CandidatePath))
  try {
    if ($baseline.Width -ne $candidate.Width -or $baseline.Height -ne $candidate.Height) {
      throw "Visual comparison frames are not aligned: baseline=$($baseline.Width)x$($baseline.Height) candidate=$($candidate.Width)x$($candidate.Height)."
    }
    $difference = [System.Drawing.Bitmap]::new($baseline.Width, $baseline.Height)
    try {
      for ($y = 0; $y -lt $baseline.Height; $y++) {
        for ($x = 0; $x -lt $baseline.Width; $x++) {
          $before = $baseline.GetPixel($x, $y)
          $after = $candidate.GetPixel($x, $y)
          $red = [Math]::Min(255, [Math]::Abs([int]$before.R - [int]$after.R) * 4)
          $green = [Math]::Min(255, [Math]::Abs([int]$before.G - [int]$after.G) * 4)
          $blue = [Math]::Min(255, [Math]::Abs([int]$before.B - [int]$after.B) * 4)
          $difference.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, $red, $green, $blue))
        }
      }
      $difference.Save($DifferencePath, [System.Drawing.Imaging.ImageFormat]::Png)
    } finally {
      $difference.Dispose()
    }

    $lower = Get-BrightMaskMetrics $baseline $candidate `
      ([int]($baseline.Width * 0.28)) ([int]($baseline.Height * 0.46)) `
      ([int]($baseline.Width * 0.72)) ([int]($baseline.Height * 0.76))
    $upper = Get-BrightMaskMetrics $baseline $candidate `
      ([int]($baseline.Width * 0.18)) ([int]($baseline.Height * 0.18)) `
      ([int]($baseline.Width * 0.82)) ([int]($baseline.Height * 0.46))
    $candidateBrightPixels = Get-BrightPixelCount $candidate `
      ([int]($candidate.Width * 0.28)) ([int]($candidate.Height * 0.18)) `
      ([int]($candidate.Width * 0.72)) ([int]($candidate.Height * 0.76))
    $culture = [System.Globalization.CultureInfo]::InvariantCulture
    $lowerIoU = $lower.IoU
    $upperIoU = $upper.IoU
    @(
      "lowerIntersection=$($lower.Intersection)"
      "lowerUnion=$($lower.Union)"
      "lowerXor=$($lower.Xor)"
      "lowerIoU=$($lowerIoU.ToString('F6', $culture))"
      "upperIntersection=$($upper.Intersection)"
      "upperUnion=$($upper.Union)"
      "upperXor=$($upper.Xor)"
      "upperIoU=$($upperIoU.ToString('F6', $culture))"
      "candidateBrightPixels=$candidateBrightPixels"
    ) | Set-Content -LiteralPath $MetricsPath
    "VISUAL_COMPARISON_METRICS lowerIoU=$($lowerIoU.ToString('F6', $culture)) upperIoU=$($upperIoU.ToString('F6', $culture)) lowerXor=$($lower.Xor) upperXor=$($upper.Xor) candidateBrightPixels=$candidateBrightPixels"
    if ($candidateBrightPixels -lt 1000) {
      throw "Candidate Gargantua render is effectively blank: candidateBrightPixels=$candidateBrightPixels."
    }
  } finally {
    $baseline.Dispose()
    $candidate.Dispose()
  }
}

$resolvedExePath = (Resolve-Path $ExePath).Path
$visualBaselinePath = Join-Path $OutputDirectory "visual-baseline.png"
$visualCandidatePath = Join-Path $OutputDirectory "visual-candidate.png"
$visualSplitPath = Join-Path $OutputDirectory "visual-split.png"
$visualDifferencePath = Join-Path $OutputDirectory "visual-difference.png"
$visualMetricsPath = Join-Path $OutputDirectory "visual-comparison-metrics.txt"
Capture-VisualComparisonFrame $resolvedExePath "baseline" $visualBaselinePath
Capture-VisualComparisonFrame $resolvedExePath "candidate" $visualCandidatePath
Capture-VisualComparisonFrame $resolvedExePath "split" $visualSplitPath
Write-VisualComparisonEvidence $visualBaselinePath $visualCandidatePath $visualDifferencePath $visualMetricsPath

$diagnosticMarkerPath = [System.IO.Path]::ChangeExtension($resolvedExePath, ".smoke-diagnostics")
Set-Content -LiteralPath $diagnosticMarkerPath -Value $diagnosticPath -NoNewline
$env:BLACKHOLE_SMOKE_DIAGNOSTICS = "1"
$env:BLACKHOLE_SMOKE_DIAGNOSTICS_PATH = $diagnosticPath
$stdoutPath = Join-Path $OutputDirectory "process-stdout.log"
$stderrPath = Join-Path $OutputDirectory "process-stderr.log"
$colorEvidencePath = Join-Path $OutputDirectory "black-hole-color-evidence.txt"
Set-Content -LiteralPath $colorEvidencePath -Value "" -NoNewline
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
  Write-BlackHoleColorEvidence $initialScreenshot $orb "compact" $colorEvidencePath
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
  $expanded = Ensure-WindowOnVirtualScreen $process.Id $expanded
  Start-Sleep -Milliseconds 800
  $expandedWindows = @(Get-AppWindows $process.Id | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
  if ($expandedWindows.Count -ne 1) {
    throw "Expansion created another native window; expected 1, found $($expandedWindows.Count)."
  }
  $expandedScreenshot = Join-Path $OutputDirectory "02-single-scene-expanded.png"
  Save-DesktopScreenshot $expandedScreenshot
  Save-ScreenRegion (Join-Path $OutputDirectory "02-single-scene-closeup.png") $expanded.ClientBounds 8
  Write-BlackHoleColorEvidence $expandedScreenshot $expanded "expanded" $colorEvidencePath

  # Exercise the real DOM controls with Win32 input, then verify each async
  # mutation against a Rust-side database snapshot. This keeps the test black
  # box at the UI boundary without relying on stale pixel coordinates alone.
  $smokeTaskTitle = "smoke-ui-$($process.Id)"
  Wait-SmokeTaskState $smokeTaskTitle $false | Out-Null
  $clientWidth = $expanded.ClientBounds.Right - $expanded.ClientBounds.Left
  $clientHeight = $expanded.ClientBounds.Bottom - $expanded.ClientBounds.Top
  $gridLeft = $expanded.ClientBounds.Left + 26
  $gridTop = $expanded.ClientBounds.Top + 56
  $cellWidth = [int](($clientWidth - 52) / 2)
  $cellHeight = [int](($clientHeight - 80) / 2)
  $q1ContentLeft = $gridLeft + 14
  $q1ContentRight = $gridLeft + $cellWidth - 150
  $q2ContentLeft = $gridLeft + $cellWidth + 150
  $q2ContentRight = $gridLeft + (2 * $cellWidth) - 14
  $taskY = $gridTop + 12 + 27 + 4 + 17
  $addX = $q1ContentRight - 12
  $addY = $gridTop + 12 + 13
  if (-not [BlackHoleWindowProbe]::ClickAt($addX, $addY)) {
    throw "Failed to click the Q1 add control at $addX,$addY."
  }
  Start-Sleep -Milliseconds 750
  [System.Windows.Forms.SendKeys]::SendWait($smokeTaskTitle)
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Wait-SmokeTaskState $smokeTaskTitle $true "q1" "todo" | Out-Null
  # The Rust snapshot can observe the inserted row before React's awaited
  # createTask call has unmounted InlineAdd. Escape is harmless once the form
  # is gone, and guarantees the native drag starts on the task card instead
  # of the still-focused input field.
  [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
  Start-Sleep -Milliseconds 500
  Start-Sleep -Milliseconds 200
  Save-DesktopScreenshot (Join-Path $OutputDirectory "03-task-created-q1.png")

  $dragStartX = [int](($q1ContentLeft + $q1ContentRight) / 2)
  $dragTargetX = [int](($q2ContentLeft + $q2ContentRight) / 2)
  $dragTargetY = $gridTop + [int]($cellHeight / 2)
  if (-not [BlackHoleWindowProbe]::DragFromTo($dragStartX, $taskY, $dragTargetX, $dragTargetY)) {
    throw "Failed to drag task from Q1 $dragStartX,$taskY to Q2 $dragTargetX,$dragTargetY."
  }
  Wait-SmokeTaskState $smokeTaskTitle $true "q2" "todo" | Out-Null
  Start-Sleep -Milliseconds 200
  Save-DesktopScreenshot (Join-Path $OutputDirectory "04-task-dragged-q2.png")

  $q2CheckX = $q2ContentLeft + 24
  if (-not [BlackHoleWindowProbe]::ClickAt($q2CheckX, $taskY)) {
    throw "Failed to click the Q2 completion control at $q2CheckX,$taskY."
  }
  Wait-SmokeTaskState $smokeTaskTitle $true "q2" "done" | Out-Null
  Start-Sleep -Milliseconds 200
  Save-DesktopScreenshot (Join-Path $OutputDirectory "05-task-completed-q2.png")

  Invoke-SceneCloseClick $expanded "persistence"
  $orb = Wait-SceneCompact $process.Id 300 230 10000
  $orbCenterX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)
  $orbCenterY = [int](($orb.ClientBounds.Top + $orb.ClientBounds.Bottom) / 2)
  if (-not [BlackHoleWindowProbe]::ClickAt($orbCenterX, $orbCenterY)) {
    throw "Failed to reopen the compact scene at $orbCenterX,$orbCenterY."
  }
  $expanded = Wait-SceneSize $process.Id 800 600 10000
  $expanded = Ensure-WindowOnVirtualScreen $process.Id $expanded
  Wait-SmokeTaskState $smokeTaskTitle $true "q2" "done" | Out-Null
  Start-Sleep -Milliseconds 200
  Save-DesktopScreenshot (Join-Path $OutputDirectory "06-task-persisted-after-reopen.png")

  $clientWidth = $expanded.ClientBounds.Right - $expanded.ClientBounds.Left
  $gridLeft = $expanded.ClientBounds.Left + 26
  $gridTop = $expanded.ClientBounds.Top + 56
  $cellWidth = [int](($clientWidth - 52) / 2)
  $q2ContentLeft = $gridLeft + $cellWidth + 150
  $taskY = $gridTop + 12 + 27 + 4 + 17
  $q2TaskBodyX = $q2ContentLeft + 90
  if (-not [BlackHoleWindowProbe]::ClickAt($q2TaskBodyX, $taskY)) {
    throw "Failed to open the Q2 task editor at $q2TaskBodyX,$taskY."
  }
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait("{TAB}{TAB}{TAB}{ENTER}")
  Start-Sleep -Milliseconds 250
  [System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
  Wait-SmokeTaskState $smokeTaskTitle $false | Out-Null
  Start-Sleep -Milliseconds 200
  Save-DesktopScreenshot (Join-Path $OutputDirectory "07-task-deleted.png")
  "TASK_INTERACTION_OK title=$smokeTaskTitle created=q1/todo dragged=q2/todo completed=q2/done persisted=q2/done deleted=true"

  Invoke-SceneCloseClick $expanded "initial"
  $orb = Wait-SceneCompact $process.Id 300 230 10000

  $process.Refresh()
  $baselineThreads = $process.Threads.Count
  $baselineHandles = $process.HandleCount
  1..12 | ForEach-Object {
    $cycle = $_
    $orbCenterX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)
    $orbCenterY = [int](($orb.ClientBounds.Top + $orb.ClientBounds.Bottom) / 2)
    if (-not [BlackHoleWindowProbe]::ClickAt($orbCenterX, $orbCenterY)) {
      throw "Cycle $cycle failed to click the compact scene at $orbCenterX,$orbCenterY."
    }
    Start-Sleep -Milliseconds 500
    $expanded = Wait-SceneSize $process.Id 800 600 30000
    $expanded = Ensure-WindowOnVirtualScreen $process.Id $expanded
    Start-Sleep -Milliseconds 350
    Invoke-SceneCloseClick $expanded "cycle-$cycle"
    Start-Sleep -Milliseconds 500
    $orb = Wait-SceneCompact $process.Id 300 230 10000
    Start-Sleep -Milliseconds 250
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
  Remove-Item -LiteralPath $diagnosticMarkerPath -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $smokeCommandPath -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $smokeSnapshotPath -ErrorAction SilentlyContinue
  $smokeCommandFiles | ForEach-Object {
    Remove-Item -LiteralPath $_ -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath "$_.tmp" -ErrorAction SilentlyContinue
  }
}
