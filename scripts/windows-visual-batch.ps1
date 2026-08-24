param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-visual-batch"
)

$ErrorActionPreference = "Stop"
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputDirectory) {
  Remove-Item -LiteralPath $OutputDirectory -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$batchLogPath = Join-Path $OutputDirectory "batch.log"
$metricsPath = Join-Path $OutputDirectory "metrics.jsonl"
$summaryPath = Join-Path $OutputDirectory "batch-summary.json"
$contactSheetPath = Join-Path $OutputDirectory "contact-sheet.png"

function Write-BatchLog([string]$Message) {
  $line = "{0:o} {1}" -f [DateTime]::UtcNow, $Message
  $line | Tee-Object -FilePath $batchLogPath -Append
}

function Get-FrozenRoiMetrics([string]$ImagePath) {
  Add-Type -AssemblyName System.Drawing
  $bitmap = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $ImagePath))
  try {
    if ($bitmap.Width -lt 840 -or $bitmap.Height -lt 510) {
      throw "Frozen ROI requires at least 840x510, got $($bitmap.Width)x$($bitmap.Height)."
    }

    $counts = [int[]]::new(760)
    $corePixels = 0
    for ($x = 80; $x -lt 840; $x++) {
      $columnCount = 0
      for ($y = 330; $y -lt 385; $y++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 540) {
          $columnCount++
          $corePixels++
        }
      }
      $counts[$x - 80] = $columnCount
    }

    $activeCounts = @($counts | Where-Object { $_ -gt 0 })
    $columns = $activeCounts.Count
    $avg = if ($columns -gt 0) { [double]$corePixels / $columns } else { 0.0 }
    $sorted = @($activeCounts | Sort-Object)
    if ($sorted.Count -eq 0) {
      $median = 0.0
    } elseif (($sorted.Count % 2) -eq 1) {
      $median = [double]$sorted[[int][Math]::Floor($sorted.Count / 2)]
    } else {
      $upper = [int]($sorted.Count / 2)
      $median = ([double]$sorted[$upper - 1] + [double]$sorted[$upper]) / 2.0
    }

    $longest = 0
    $run = 0
    foreach ($count in $counts) {
      if ($count -gt 0) {
        $run++
        if ($run -gt $longest) { $longest = $run }
      } else {
        $run = 0
      }
    }

    $rowXs = [System.Collections.Generic.List[int]]::new()
    for ($x = 80; $x -lt 840; $x++) {
      $p = $bitmap.GetPixel($x, 354)
      if (($p.R + $p.G + $p.B) -gt 180) { $rowXs.Add($x - 80) }
    }
    $span = if ($rowXs.Count -gt 0) { $rowXs[$rowXs.Count - 1] - $rowXs[0] + 1 } else { 0 }

    $lower = 0
    for ($y = 360; $y -lt 510; $y++) {
      for ($x = 80; $x -lt 840; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 180) { $lower++ }
      }
    }

    $warm = 0
    for ($y = 180; $y -lt 520; $y++) {
      for ($x = 80; $x -lt 840; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        $wrappedBPlus8 = (($p.B + 8) -band 255)
        if ($p.R -gt $wrappedBPlus8 -and ($p.R + $p.G + $p.B) -gt 180) { $warm++ }
      }
    }

    $shadow = 0
    for ($y = 285; $y -lt 345; $y++) {
      for ($x = 410; $x -lt 510; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if (($p.R + $p.G + $p.B) -gt 15) { $shadow++ }
      }
    }

    $dead = 0
    for ($y = 0; $y -lt $bitmap.Height; $y++) {
      for ($x = 0; $x -lt $bitmap.Width; $x++) {
        $p = $bitmap.GetPixel($x, $y)
        if ($p.R -eq 255 -and $p.G -eq 255 -and $p.B -eq 255) { $dead++ }
      }
    }

    return [ordered]@{
      avg = $avg
      median = $median
      core = $corePixels
      columns = $columns
      longest = $longest
      span = $span
      lower = $lower
      warm = $warm
      shadow = $shadow
      dead = $dead
    }
  } finally {
    $bitmap.Dispose()
  }
}

function Get-MetricDelta($Metrics, $Control) {
  return [ordered]@{
    avg = [double]$Metrics.avg - [double]$Control.avg
    median = [double]$Metrics.median - [double]$Control.median
    core = [int]$Metrics.core - [int]$Control.core
    columns = [int]$Metrics.columns - [int]$Control.columns
    longest = [int]$Metrics.longest - [int]$Control.longest
    span = [int]$Metrics.span - [int]$Control.span
    lower = [int]$Metrics.lower - [int]$Control.lower
    warm = [int]$Metrics.warm - [int]$Control.warm
    shadow = [int]$Metrics.shadow - [int]$Control.shadow
    dead = [int]$Metrics.dead - [int]$Control.dead
  }
}

function Test-155Stability($Metrics, $Control) {
  return (
    [Math]::Abs([double]$Metrics.avg - [double]$Control.avg) -le 0.10 -and
    [double]$Metrics.median -eq [double]$Control.median -and
    [Math]::Abs([int]$Metrics.core - [int]$Control.core) -le 2 -and
    [Math]::Abs([int]$Metrics.columns - [int]$Control.columns) -le 2 -and
    [Math]::Abs([int]$Metrics.longest - [int]$Control.longest) -le 1 -and
    [Math]::Abs([int]$Metrics.span - [int]$Control.span) -le [Math]::Max(1, [Math]::Ceiling([double]$Control.span * 0.03)) -and
    [Math]::Abs([int]$Metrics.lower - [int]$Control.lower) -le [Math]::Max(1, [Math]::Ceiling([double]$Control.lower * 0.03)) -and
    [Math]::Abs([int]$Metrics.warm - [int]$Control.warm) -le [Math]::Max(1, [Math]::Ceiling([double]$Control.warm * 0.05)) -and
    [Math]::Abs([int]$Metrics.shadow - [int]$Control.shadow) -le 2 -and
    [int]$Metrics.dead -eq 0
  )
}

function New-ContactSheet($Cases, $Rows) {
  Add-Type -AssemblyName System.Drawing
  $thumbWidth = 460
  $thumbHeight = 350
  $labelHeight = 42
  $sheet = [System.Drawing.Bitmap]::new($thumbWidth * 3, ($thumbHeight + $labelHeight) * 3)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $font = [System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif, 14)
  $brush = [System.Drawing.Brushes]::White
  try {
    $graphics.Clear([System.Drawing.Color]::Black)
    for ($index = 0; $index -lt $Cases.Count; $index++) {
      $case = $Cases[$index]
      $row = $Rows[$index]
      $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath (Join-Path $OutputDirectory $row.imagePath)))
      try {
        $column = $index % 3
        $gridRow = [Math]::Floor($index / 3)
        $left = $column * $thumbWidth
        $top = $gridRow * ($thumbHeight + $labelHeight)
        $graphics.DrawImage($source, [System.Drawing.Rectangle]::new($left, $top, $thumbWidth, $thumbHeight))
        $exposureLabel = if ($null -eq $case.exposure) { "default 1.55" } else { "{0:N2}" -f [double]$case.exposure }
        $graphics.DrawString("$($case.id)  exposure=$exposureLabel", $font, $brush, [single]($left + 8), [single]($top + $thumbHeight + 8))
      } finally {
        $source.Dispose()
      }
    }
    $sheet.Save($contactSheetPath, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $font.Dispose()
    $graphics.Dispose()
    $sheet.Dispose()
  }
}

$cases = @(
  [pscustomobject]@{ id = "control"; exposure = $null },
  [pscustomobject]@{ id = "smoke-01"; exposure = 1.55 },
  [pscustomobject]@{ id = "smoke-02"; exposure = 1.55 },
  [pscustomobject]@{ id = "smoke-03"; exposure = 1.55 },
  [pscustomobject]@{ id = "smoke-04"; exposure = 1.55 },
  [pscustomobject]@{ id = "smoke-05"; exposure = 1.45 },
  [pscustomobject]@{ id = "smoke-06"; exposure = 1.50 },
  [pscustomobject]@{ id = "smoke-07"; exposure = 1.60 },
  [pscustomobject]@{ id = "smoke-08"; exposure = 1.65 }
)

$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { "local" }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local" }
$rows = [System.Collections.Generic.List[object]]::new()
$controlMetrics = $null

Write-BatchLog "BATCH_START headSha=$headSha runId=$runId exe=$resolvedExePath cases=$($cases.Count)"
Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue

foreach ($case in $cases) {
  $caseDirectory = Join-Path $env:TEMP "blackhole-visual-batch-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
  $outputImageName = "$($case.id).png"
  $outputImagePath = Join-Path $OutputDirectory $outputImageName
  try {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    if ($null -ne $case.exposure) {
      $experiment = [ordered]@{
        experimentId = $case.id
        parameters = [ordered]@{ FILM_DISK_EXPOSURE = [double]$case.exposure }
      }
      $env:BLACKHOLE_VISUAL_EXPERIMENT = ($experiment | ConvertTo-Json -Compress)
    }

    $envState = if ($null -eq $case.exposure) { "unset" } else { $env:BLACKHOLE_VISUAL_EXPERIMENT }
    Write-BatchLog "CAPTURE_START id=$($case.id) experiment=$envState"
    & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") `
      -ExePath $resolvedExePath `
      -OutputDirectory $caseDirectory `
      -VisualOnly

    $candidatePath = Join-Path $caseDirectory "visual-candidate.png"
    if (-not (Test-Path -LiteralPath $candidatePath) -or (Get-Item -LiteralPath $candidatePath).Length -eq 0) {
      throw "Native capture did not produce visual-candidate.png for $($case.id)."
    }
    Copy-Item -LiteralPath $candidatePath -Destination $outputImagePath -Force

    $metrics = Get-FrozenRoiMetrics $outputImagePath
    if ($null -eq $controlMetrics) { $controlMetrics = $metrics }
    $delta = Get-MetricDelta $metrics $controlMetrics
    $parameters = if ($null -eq $case.exposure) { [ordered]@{} } else { [ordered]@{ FILM_DISK_EXPOSURE = [double]$case.exposure } }
    $row = [ordered]@{
      schemaVersion = "1.0"
      headSha = $headSha
      runId = $runId
      experimentId = $case.id
      infrastructureOnly = $true
      parameters = $parameters
      captureStatus = "success"
      imagePath = $outputImageName
      metrics = $metrics
      deltaFromControl = $delta
      error = $null
    }
    ($row | ConvertTo-Json -Compress -Depth 8) | Add-Content -LiteralPath $metricsPath
    $rows.Add([pscustomobject]$row)
    Write-BatchLog "CAPTURE_OK id=$($case.id) avg=$($metrics.avg) median=$($metrics.median) core=$($metrics.core) columns=$($metrics.columns) longest=$($metrics.longest)"
  } catch {
    $parameters = if ($null -eq $case.exposure) { [ordered]@{} } else { [ordered]@{ FILM_DISK_EXPOSURE = [double]$case.exposure } }
    $failedRow = [ordered]@{
      schemaVersion = "1.0"
      headSha = $headSha
      runId = $runId
      experimentId = $case.id
      infrastructureOnly = $true
      parameters = $parameters
      captureStatus = "failed"
      imagePath = $null
      metrics = $null
      deltaFromControl = $null
      error = $_.Exception.Message
    }
    ($failedRow | ConvertTo-Json -Compress -Depth 8) | Add-Content -LiteralPath $metricsPath
    Write-BatchLog "CAPTURE_FAILED id=$($case.id) error=$($_.Exception.Message)"
    throw
  } finally {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue
    Write-BatchLog "CAPTURE_CLEANUP id=$($case.id) experimentEnvCleared=$(-not (Test-Path Env:BLACKHOLE_VISUAL_EXPERIMENT))"
  }
}

New-ContactSheet $cases $rows

$stableRows = @($rows | Where-Object { $_.experimentId -match '^smoke-0[1-4]$' })
$stable155 = ($stableRows.Count -eq 4) -and (@($stableRows | Where-Object { -not (Test-155Stability $_.metrics $controlMetrics) }).Count -eq 0)
$variedRows = @($rows | Where-Object { $_.experimentId -match '^smoke-0[5-8]$' })
$parameterSensitivity = $false
foreach ($row in $variedRows) {
  $delta = $row.deltaFromControl
  if ([Math]::Abs([double]$delta.avg) -gt 0.0000001 -or
      [int]$delta.core -ne 0 -or [int]$delta.columns -ne 0 -or [int]$delta.longest -ne 0 -or
      [int]$delta.lower -ne 0 -or [int]$delta.warm -ne 0 -or [int]$delta.shadow -ne 0) {
    $parameterSensitivity = $true
    break
  }
}

$expectedFiles = @(
  "control.png",
  "smoke-01.png", "smoke-02.png", "smoke-03.png", "smoke-04.png",
  "smoke-05.png", "smoke-06.png", "smoke-07.png", "smoke-08.png",
  "metrics.jsonl", "batch-summary.json", "contact-sheet.png", "batch.log"
)
$infrastructureVerdict = if ($rows.Count -eq 9 -and $stable155 -and $parameterSensitivity) { "PASS" } else { "FAIL" }
$summary = [ordered]@{
  schemaVersion = "1.0"
  headSha = $headSha
  runId = $runId
  totalGroups = 9
  successfulGroups = $rows.Count
  controlMetrics = $controlMetrics
  repeated155 = [ordered]@{
    count = $stableRows.Count
    stableWithinScreenshotTolerance = $stable155
    tolerancePolicy = [ordered]@{
      avgAbsolute = 0.10
      medianExact = $true
      coreAbsolute = 2
      columnsAbsolute = 2
      longestAbsolute = 1
      spanPercent = 3
      lowerPercent = 3
      warmPercent = 5
      shadowAbsolute = 2
      deadMustBeZero = $true
    }
  }
  parameterSensitivity = [ordered]@{
    detected = $parameterSensitivity
    experiments = @($variedRows | ForEach-Object {
      [ordered]@{
        experimentId = $_.experimentId
        parameters = $_.parameters
        deltaFromControl = $_.deltaFromControl
      }
    })
  }
  files = $expectedFiles
  infrastructureVerdict = $infrastructureVerdict
  notAVisualAcceptance = $true
}
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $summaryPath
Write-BatchLog "BATCH_SUMMARY successfulGroups=$($rows.Count) stable155=$stable155 parameterSensitivity=$parameterSensitivity verdict=$infrastructureVerdict"

if ($infrastructureVerdict -ne "PASS") {
  throw "Batch infrastructure verdict was $infrastructureVerdict."
}

Write-BatchLog "BATCH_OK"
