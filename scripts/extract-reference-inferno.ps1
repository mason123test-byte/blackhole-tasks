param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$OutputPath = "output/windows-smoke/reference-inferno.png",
  [string]$ReferenceCommit = "b49fa0ab2eaf0644a690f4cb386d70c21eb9f969"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

# The final demo slot is Inferno. Sample at 96% of total animation time:
# after the black hole reaches full size, but before the loop restarts.
$targetFraction = 0.96
$resolvedInput = (Resolve-Path $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null

$image = [System.Drawing.Image]::FromFile($resolvedInput)
try {
  $dimension = [System.Drawing.Imaging.FrameDimension]::new($image.FrameDimensionsList[0])
  $frameCount = $image.GetFrameCount($dimension)
  if ($frameCount -lt 1) { throw "Reference demo.gif contains no frames." }

  $frameIndex = [Math]::Min($frameCount - 1, [Math]::Floor(($frameCount - 1) * $targetFraction))
  $totalCentiseconds = 0
  $targetCentiseconds = 0
  try {
    $delayProperty = $image.GetPropertyItem(0x5100)
    if ($delayProperty.Value.Length -ge ($frameCount * 4)) {
      $delays = @()
      for ($index = 0; $index -lt $frameCount; $index++) {
        $delay = [BitConverter]::ToInt32($delayProperty.Value, $index * 4)
        if ($delay -le 0) { $delay = 1 }
        $delays += $delay
        $totalCentiseconds += $delay
      }
      $targetCentiseconds = [int][Math]::Round($totalCentiseconds * $targetFraction)
      $elapsed = 0
      for ($index = 0; $index -lt $frameCount; $index++) {
        $elapsed += $delays[$index]
        if ($elapsed -ge $targetCentiseconds) {
          $frameIndex = $index
          break
        }
      }
    }
  } catch {
    Write-Warning "GIF frame-delay metadata unavailable; using frame-count fraction: $($_.Exception.Message)"
  }

  $image.SelectActiveFrame($dimension, $frameIndex) | Out-Null
  $bitmap = [System.Drawing.Bitmap]::new(
    $image.Width,
    $image.Height,
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  )
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.DrawImageUnscaled($image, 0, 0)
    $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }

  $metadataPath = [System.IO.Path]::ChangeExtension($resolvedOutput, ".txt")
  @(
    "referenceRepo=s0xDk/ghostty-blackhole",
    "referenceCommit=$ReferenceCommit",
    "source=demo.gif",
    "targetFraction=$targetFraction",
    "frameIndex=$frameIndex",
    "frameCount=$frameCount",
    "targetCentiseconds=$targetCentiseconds",
    "totalCentiseconds=$totalCentiseconds",
    "size=$($image.Width)x$($image.Height)"
  ) | Set-Content -LiteralPath $metadataPath -Encoding utf8

  "REFERENCE_INFERNO_CAPTURE commit=$ReferenceCommit frame=$frameIndex/$frameCount targetFraction=$targetFraction size=$($image.Width)x$($image.Height) path=$OutputPath"
} finally {
  $image.Dispose()
}
