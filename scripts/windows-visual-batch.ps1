param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-visual-batch"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")

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

function New-ContactSheet($Cases, $Rows) {
  Add-Type -AssemblyName System.Drawing
  $thumbWidth = 460
  $thumbHeight = 350
  $labelHeight = 42
  $sheet = [System.Drawing.Bitmap]::new($thumbWidth * 3, ($thumbHeight + $labelHeight) * 3)
  $graphics = [System.Drawing.Graphics]::FromImage($sheet)
  $font = [System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif, 14)
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
        $outerLabel = if ($null -eq $case.diskOuter) { "default" } else { "{0:N1}" -f [double]$case.diskOuter }
        $graphics.DrawString("$($case.id)  DISK_OUTER=$outerLabel", $font, [System.Drawing.Brushes]::White, [single]($left + 8), [single]($top + $thumbHeight + 8))
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

# Single-factor geometry sweep. Current renderer uses Kerr coordinates with M=1;
# the upstream Gargantua reference uses Schwarzschild-radius units (r_s=2M).
# Its DISK_OUTER=7 r_s therefore maps to about 14 M in this coordinate scale.
# Values walk from the accepted 35 M source extent toward that evidence-derived target.
$cases = @(
  [pscustomobject]@{ id = "control"; diskOuter = $null },
  [pscustomobject]@{ id = "smoke-01"; diskOuter = 32.0 },
  [pscustomobject]@{ id = "smoke-02"; diskOuter = 29.0 },
  [pscustomobject]@{ id = "smoke-03"; diskOuter = 26.0 },
  [pscustomobject]@{ id = "smoke-04"; diskOuter = 23.0 },
  [pscustomobject]@{ id = "smoke-05"; diskOuter = 20.0 },
  [pscustomobject]@{ id = "smoke-06"; diskOuter = 18.0 },
  [pscustomobject]@{ id = "smoke-07"; diskOuter = 16.0 },
  [pscustomobject]@{ id = "smoke-08"; diskOuter = 14.0 }
)

$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { "local" }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local" }
$rows = [System.Collections.Generic.List[object]]::new()
$controlMetrics = $null
$exeDigest = (Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()

Write-BatchLog "BATCH_START headSha=$headSha runId=$runId exe=$resolvedExePath exeSha256=$exeDigest cases=$($cases.Count) sweep=DISK_OUTER"
Write-BatchLog "BUILD_EVIDENCE batchJobNpmCiCount=$env:BLACKHOLE_BATCH_NPM_CI_COUNT tauriNoBundleReleaseExeBuildCount=$env:BLACKHOLE_BATCH_EXE_BUILD_COUNT"
if ($env:BLACKHOLE_BATCH_NPM_CI_COUNT -ne "1" -or $env:BLACKHOLE_BATCH_EXE_BUILD_COUNT -ne "1") {
  throw "Batch build evidence markers must both equal one."
}
Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue

foreach ($case in $cases) {
  $caseDirectory = Join-Path $env:TEMP "blackhole-visual-batch-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
  $outputImageName = "$($case.id).png"
  $outputImagePath = Join-Path $OutputDirectory $outputImageName
  try {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    if ($null -ne $case.diskOuter) {
      $experiment = [ordered]@{
        experimentId = $case.id
        parameters = [ordered]@{ DISK_OUTER = [double]$case.diskOuter }
      }
      $env:BLACKHOLE_VISUAL_EXPERIMENT = ($experiment | ConvertTo-Json -Compress)
    }

    $experimentState = if ($null -eq $case.diskOuter) { "unset" } else { $env:BLACKHOLE_VISUAL_EXPERIMENT }
    Write-BatchLog "CAPTURE_START id=$($case.id) diskOuter=$($case.diskOuter) experiment=$experimentState temp=$caseDirectory exeSha256=$exeDigest"
    & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") `
      -ExePath $resolvedExePath `
      -OutputDirectory $caseDirectory `
      -VisualOnly `
      -CandidateOnly

    $candidatePath = Join-Path $caseDirectory "visual-candidate.png"
    if (-not (Test-Path -LiteralPath $candidatePath) -or (Get-Item -LiteralPath $candidatePath).Length -eq 0) {
      throw "Native WebView2 capture did not produce visual-candidate.png for $($case.id)."
    }
    Copy-Item -LiteralPath $candidatePath -Destination $outputImagePath

    $metrics = Get-FrozenRoiMetrics $outputImagePath
    if ($null -eq $controlMetrics) { $controlMetrics = $metrics }
    $delta = Get-MetricDelta $metrics $controlMetrics
    $row = [ordered]@{
      schemaVersion = "2.0"
      headSha = $headSha
      runId = $runId
      experimentId = $case.id
      diskOuter = $case.diskOuter
      filmDiskExposure = 1.55
      captureStatus = "success"
      imagePath = $outputImageName
      fixedRoiMetrics = $metrics
      deltaFromControl = $delta
    }
    ($row | ConvertTo-Json -Compress -Depth 8) | Add-Content -LiteralPath $metricsPath
    $rows.Add([pscustomobject]$row)
    Write-BatchLog "CAPTURE_OK id=$($case.id) processRun=$($rows.Count)/9 image=$outputImageName"
  } catch {
    Write-BatchLog "CAPTURE_FAILED id=$($case.id) error=$($_.Exception.Message)"
    throw
  } finally {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue
    Write-BatchLog "CAPTURE_CLEANUP id=$($case.id) experimentEnvCleared=$(-not (Test-Path Env:BLACKHOLE_VISUAL_EXPERIMENT))"
  }
}

New-ContactSheet $cases $rows

$variedRows = @($rows | Where-Object { $_.experimentId -ne 'control' })
$parameterSensitivity = @($variedRows | Where-Object {
  $delta = $_.deltaFromControl
  [Math]::Abs([double]$delta.avg) -gt 0.0000001 -or
  [double]$delta.median -ne 0 -or
  [int]$delta.core -ne 0 -or [int]$delta.columns -ne 0 -or
  [int]$delta.longest -ne 0 -or [int]$delta.span -ne 0 -or
  [int]$delta.lower -ne 0 -or [int]$delta.warm -ne 0 -or
  [int]$delta.shadow -ne 0 -or [int]$delta.dead -ne 0
}).Count -gt 0

$expectedFiles = @(
  "control.png",
  "smoke-01.png", "smoke-02.png", "smoke-03.png", "smoke-04.png",
  "smoke-05.png", "smoke-06.png", "smoke-07.png", "smoke-08.png",
  "metrics.jsonl", "batch-summary.json", "contact-sheet.png", "batch.log"
)
$summary = [ordered]@{
  schemaVersion = "2.0"
  headSha = $headSha
  runId = $runId
  totalGroups = 9
  successfulGroups = $rows.Count
  geometrySweep = [ordered]@{
    parameter = "DISK_OUTER"
    control = 35.0
    candidates = @($variedRows | ForEach-Object {
      [ordered]@{
        experimentId = $_.experimentId
        diskOuter = $_.diskOuter
        deltaFromControl = $_.deltaFromControl
      }
    })
  }
  parameterSensitivity = [ordered]@{
    detected = $parameterSensitivity
  }
  files = $expectedFiles
  notAVisualAcceptance = $true
}
$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $summaryPath

$metricLineCount = @(Get-Content -LiteralPath $metricsPath).Count
$actualFiles = @(Get-ChildItem -LiteralPath $OutputDirectory -File | ForEach-Object Name | Sort-Object)
$missingFiles = @($expectedFiles | Where-Object { $_ -notin $actualFiles })
$unexpectedFiles = @($actualFiles | Where-Object { $_ -notin $expectedFiles })
if ($rows.Count -ne 9 -or $metricLineCount -ne 9 -or $missingFiles.Count -ne 0 -or $unexpectedFiles.Count -ne 0) {
  throw "Batch output validation failed: groups=$($rows.Count) metricLines=$metricLineCount missing=$($missingFiles -join ',') unexpected=$($unexpectedFiles -join ',')."
}

Write-BatchLog "BATCH_SUMMARY successfulGroups=$($rows.Count) metricLines=$metricLineCount sweep=DISK_OUTER parameterSensitivity=$parameterSensitivity notAVisualAcceptance=true"
Write-BatchLog "BATCH_OK processRuns=9 exeSha256=$exeDigest"
