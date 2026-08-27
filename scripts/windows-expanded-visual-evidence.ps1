param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputPath
)

$ErrorActionPreference = "Stop"
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public static class ExpandedEvidenceProbe
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

    public static bool ClickAt(int x, int y)
    {
        var previous = SetThreadDpiAwarenessContext(new IntPtr(-4));
        try
        {
            if (!NativeSetCursorPos(x, y)) return false;
            Thread.Sleep(100);
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(50);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
            return true;
        }
        finally
        {
            if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous);
        }
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
        finally
        {
            if (previous != IntPtr.Zero) SetThreadDpiAwarenessContext(previous);
        }
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
                result.Add(new WindowInfo {
                    Handle = window,
                    Title = title.ToString(),
                    Bounds = rect,
                    ClientBounds = clientRect,
                });
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

if (-not [ExpandedEvidenceProbe]::EnablePerMonitorV2()) {
  throw "Failed to enable per-monitor-v2 DPI awareness for expanded visual evidence."
}

function Get-AppWindows([int]$ProcessId) {
  return @([ExpandedEvidenceProbe]::VisibleWindows($ProcessId))
}

function Wait-OrbRenderReady([int]$ProcessId, [int]$TimeoutMilliseconds = 60000) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  $lastTitle = ""
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title.StartsWith("黑洞任务|renderer=") })
    if ($match.Count -eq 1) {
      $lastTitle = $match[0].Title
      if ($lastTitle -match '^黑洞任务\|renderer=webgl2\|frame=ready\|energy=(\d+)\|size=(\d+)x(\d+)(?:\|diag=.*)?$' -and
          [int]$Matches[1] -gt 100 -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180) {
        return $match[0]
      }
      if ($lastTitle -match '^黑洞任务\|renderer=canvas2d\|') {
        throw "Evidence process fell back to Canvas2D: $lastTitle"
      }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Evidence process did not produce a compact WebGL2 frame within ${TimeoutMilliseconds}ms; lastTitle='$lastTitle'."
}

function Wait-ExpandedRenderReady(
  [int]$ProcessId,
  [int]$MinimumWidth,
  [int]$MinimumHeight,
  [int]$TimeoutMilliseconds = 60000
) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($TimeoutMilliseconds)
  $lastTitle = ""
  $lastNativeSize = "missing"
  do {
    $match = @(Get-AppWindows $ProcessId | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
    if ($match.Count -eq 1) {
      $width = $match[0].ClientBounds.Right - $match[0].ClientBounds.Left
      $height = $match[0].ClientBounds.Bottom - $match[0].ClientBounds.Top
      $lastNativeSize = "${width}x${height}"
      $lastTitle = $match[0].Title
      if ($lastTitle -match '^黑洞任务\|renderer=webgl2\|frame=ready\|energy=(\d+)\|size=(\d+)x(\d+)(?:\|diag=.*)?$') {
        $renderWidth = [int]$Matches[2]
        $renderHeight = [int]$Matches[3]
        if ($width -ge $MinimumWidth -and $height -ge $MinimumHeight -and
            $renderWidth -ge $MinimumWidth -and $renderHeight -ge $MinimumHeight -and
            [int]$Matches[1] -gt 100) {
          "EXPANDED_RENDER_READY native=${width}x${height} render=${renderWidth}x${renderHeight} title=$lastTitle"
          return $match[0]
        }
      }
      if ($lastTitle -match '^黑洞任务\|renderer=canvas2d\|') {
        throw "Expanded evidence fell back to Canvas2D instead of WebGL2: $lastTitle"
      }
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $deadline)
  throw "Expanded WebGL2 evidence did not reach native/render ${MinimumWidth}x${MinimumHeight} within ${TimeoutMilliseconds}ms; native=$lastNativeSize lastTitle='$lastTitle'."
}

function Ensure-WindowOnVirtualScreen($Window) {
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
  if (-not [ExpandedEvidenceProbe]::MoveTopLeft($Window.Handle, $targetLeft, $targetTop)) {
    throw "Failed to move expanded evidence window onto the virtual screen."
  }
  Start-Sleep -Milliseconds 300
  $match = @(Get-AppWindows $process.Id | Where-Object { $_.Title -eq "黑洞任务" -or $_.Title.StartsWith("黑洞任务|") })
  if ($match.Count -ne 1) {
    throw "Expanded evidence window disappeared while repositioning."
  }
  return $match[0]
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

$resolvedExePath = (Resolve-Path $ExePath).Path
$resolvedOutputPath = [System.IO.Path]::GetFullPath($OutputPath)
$diagnosticPath = Join-Path $env:TEMP "blackhole-expanded-evidence-$([Guid]::NewGuid().ToString('N')).txt"
$process = Start-Process -FilePath $resolvedExePath `
  -ArgumentList "--smoke-diagnostics=$diagnosticPath" `
  -PassThru

try {
  $orb = Wait-OrbRenderReady $process.Id 90000
  $centerX = [int](($orb.ClientBounds.Left + $orb.ClientBounds.Right) / 2)
  $centerY = [int](($orb.ClientBounds.Top + $orb.ClientBounds.Bottom) / 2)
  if (-not [ExpandedEvidenceProbe]::ClickAt($centerX, $centerY)) {
    throw "Failed to expand evidence process at $centerX,$centerY."
  }

  $expanded = Wait-ExpandedRenderReady $process.Id 800 600 90000
  $expanded = Ensure-WindowOnVirtualScreen $expanded
  $expanded = Wait-ExpandedRenderReady $process.Id 800 600 30000
  Start-Sleep -Milliseconds 250

  Save-DesktopScreenshot $OutputPath
  $closeupPath = Join-Path (Split-Path -Parent $resolvedOutputPath) "02-single-scene-closeup.png"
  Save-ScreenRegion $closeupPath $expanded.ClientBounds 8
  "EXPANDED_VISUAL_EVIDENCE_OK path=$resolvedOutputPath native=$($expanded.ClientBounds.Right - $expanded.ClientBounds.Left)x$($expanded.ClientBounds.Bottom - $expanded.ClientBounds.Top) title=$($expanded.Title)"
} finally {
  if (-not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    $process.WaitForExit(5000) | Out-Null
  }
  Remove-Item -LiteralPath $diagnosticPath -ErrorAction SilentlyContinue
}
