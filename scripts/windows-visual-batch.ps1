param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-visual-batch"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")

$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$batchLogPath = Join-Path $OutputDirectory "batch.log"
$metricsPath = Join-Path $OutputDirectory "metrics.jsonl"
$summaryPath = Join-Path $OutputDirectory "batch-summary.json"
$contactSheetPath = Join-Path $OutputDirectory "contact-sheet.png"

function Write-BatchLog([string]$Message) {
  ("{0:o} {1}" -f [DateTime]::UtcNow, $Message) | Tee-Object -FilePath $batchLogPath -Append
}
function Assert-Close([double]$Actual, [double]$Expected, [string]$Name) {
  if ([Math]::Abs($Actual - $Expected) -gt 0.000001) { throw "$Name mismatch: expected=$Expected actual=$Actual" }
}
function Read-EffectiveReceipt([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { throw "Missing effective receipt: $Path" }
  $title = Get-Content -LiteralPath $Path -Raw
  if ($title -notmatch 'effectiveExperimentId=([^;|]+);effectiveEnabled=([01]);effectiveFilmDiskExposure=([0-9.]+);effectiveDiskOuter=([0-9.]+)') {
    throw "Malformed effective receipt: $title"
  }
  [pscustomobject]@{
    experimentId = [uri]::UnescapeDataString($Matches[1])
    enabled = $Matches[2] -eq '1'
    filmDiskExposure = [double]::Parse($Matches[3], [System.Globalization.CultureInfo]::InvariantCulture)
    diskOuter = [double]::Parse($Matches[4], [System.Globalization.CultureInfo]::InvariantCulture)
  }
}
function Get-MetricDelta($Metrics, $Control) {
  [ordered]@{
    avg = [double]$Metrics.avg - [double]$Control.avg; median = [double]$Metrics.median - [double]$Control.median
    core = [int]$Metrics.core - [int]$Control.core; columns = [int]$Metrics.columns - [int]$Control.columns
    longest = [int]$Metrics.longest - [int]$Control.longest; span = [int]$Metrics.span - [int]$Control.span
    lower = [int]$Metrics.lower - [int]$Control.lower; warm = [int]$Metrics.warm - [int]$Control.warm
    shadow = [int]$Metrics.shadow - [int]$Control.shadow; dead = [int]$Metrics.dead - [int]$Control.dead
  }
}
function New-ContactSheet($Cases, $Rows) {
  Add-Type -AssemblyName System.Drawing
  $thumbWidth=460; $thumbHeight=350; $labelHeight=42
  $sheet=[System.Drawing.Bitmap]::new($thumbWidth*3,($thumbHeight+$labelHeight)*3)
  $graphics=[System.Drawing.Graphics]::FromImage($sheet)
  $font=[System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif,14)
  try {
    $graphics.Clear([System.Drawing.Color]::Black)
    for($index=0;$index -lt $Cases.Count;$index++){
      $case=$Cases[$index]; $row=$Rows[$index]
      $source=[System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath (Join-Path $OutputDirectory $row.imagePath)))
      try {
        $column=$index%3; $gridRow=[Math]::Floor($index/3); $left=$column*$thumbWidth; $top=$gridRow*($thumbHeight+$labelHeight)
        $graphics.DrawImage($source,[System.Drawing.Rectangle]::new($left,$top,$thumbWidth,$thumbHeight))
        $graphics.DrawString("$($case.id)  effective DISK_OUTER=$($row.effective.diskOuter)",$font,[System.Drawing.Brushes]::White,[single]($left+8),[single]($top+$thumbHeight+8))
      } finally { $source.Dispose() }
    }
    $sheet.Save($contactSheetPath,[System.Drawing.Imaging.ImageFormat]::Png)
  } finally { $font.Dispose(); $graphics.Dispose(); $sheet.Dispose() }
}

$cases=@(
  [pscustomobject]@{id="control";diskOuter=35.0;enabled=$false},
  [pscustomobject]@{id="smoke-01";diskOuter=32.0;enabled=$true}, [pscustomobject]@{id="smoke-02";diskOuter=29.0;enabled=$true},
  [pscustomobject]@{id="smoke-03";diskOuter=26.0;enabled=$true}, [pscustomobject]@{id="smoke-04";diskOuter=23.0;enabled=$true},
  [pscustomobject]@{id="smoke-05";diskOuter=20.0;enabled=$true}, [pscustomobject]@{id="smoke-06";diskOuter=18.0;enabled=$true},
  [pscustomobject]@{id="smoke-07";diskOuter=16.0;enabled=$true}, [pscustomobject]@{id="smoke-08";diskOuter=14.0;enabled=$true}
)
$headSha=if($env:GITHUB_SHA){$env:GITHUB_SHA}else{"local"}; $runId=if($env:GITHUB_RUN_ID){$env:GITHUB_RUN_ID}else{"local"}
$rows=[System.Collections.Generic.List[object]]::new(); $controlMetrics=$null
$exeDigest=(Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()
Write-BatchLog "BATCH_START headSha=$headSha runId=$runId exeSha256=$exeDigest cases=9 sweep=DISK_OUTER receiptRequired=true"
if($env:BLACKHOLE_BATCH_NPM_CI_COUNT -ne "1" -or $env:BLACKHOLE_BATCH_EXE_BUILD_COUNT -ne "1"){throw "Batch build evidence markers must both equal one."}

foreach($case in $cases){
  $caseDirectory=Join-Path $env:TEMP "blackhole-visual-batch-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
  try {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    if($case.enabled){
      $env:BLACKHOLE_VISUAL_EXPERIMENT=([ordered]@{experimentId=$case.id;parameters=[ordered]@{DISK_OUTER=[double]$case.diskOuter}}|ConvertTo-Json -Compress)
    }
    Write-BatchLog "CAPTURE_START id=$($case.id) requestedEnabled=$($case.enabled) requestedDiskOuter=$($case.diskOuter) exeSha256=$exeDigest"
    & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") -ExePath $resolvedExePath -OutputDirectory $caseDirectory -VisualOnly -CandidateOnly
    $receipt=Read-EffectiveReceipt (Join-Path $caseDirectory "visual-candidate-effective.txt")
    if($receipt.enabled -ne $case.enabled){throw "enabled mismatch for $($case.id)"}
    if($case.enabled -and $receipt.experimentId -ne $case.id){throw "experimentId mismatch for $($case.id): $($receipt.experimentId)"}
    if(-not $case.enabled -and $receipt.experimentId -ne "accepted-571"){throw "control experimentId mismatch: $($receipt.experimentId)"}
    Assert-Close $receipt.filmDiskExposure 1.55 "$($case.id) filmDiskExposure"
    Assert-Close $receipt.diskOuter $case.diskOuter "$($case.id) diskOuter"
    Write-BatchLog "EFFECTIVE_RECEIPT_OK id=$($case.id) effectiveId=$($receipt.experimentId) enabled=$($receipt.enabled) exposure=$($receipt.filmDiskExposure) diskOuter=$($receipt.diskOuter)"

    $candidatePath=Join-Path $caseDirectory "visual-candidate.png"; $outputImageName="$($case.id).png"; $outputImagePath=Join-Path $OutputDirectory $outputImageName
    if(-not(Test-Path -LiteralPath $candidatePath) -or (Get-Item -LiteralPath $candidatePath).Length -eq 0){throw "Native WebView2 capture missing for $($case.id)."}
    Copy-Item -LiteralPath $candidatePath -Destination $outputImagePath
    $metrics=Get-FrozenRoiMetrics $outputImagePath; if($null -eq $controlMetrics){$controlMetrics=$metrics}; $delta=Get-MetricDelta $metrics $controlMetrics
    $row=[ordered]@{
      schemaVersion="3.0";headSha=$headSha;runId=$runId;experimentId=$case.id;captureStatus="success";imagePath=$outputImageName
      requested=[ordered]@{experimentId=if($case.enabled){$case.id}else{"accepted-571"};enabled=[bool]$case.enabled;filmDiskExposure=1.55;diskOuter=[double]$case.diskOuter}
      effective=[ordered]@{experimentId=$receipt.experimentId;enabled=[bool]$receipt.enabled;filmDiskExposure=[double]$receipt.filmDiskExposure;diskOuter=[double]$receipt.diskOuter}
      fixedRoiMetrics=$metrics;deltaFromControl=$delta
    }
    ($row|ConvertTo-Json -Compress -Depth 8)|Add-Content -LiteralPath $metricsPath; $rows.Add([pscustomobject]$row)
    Write-BatchLog "CAPTURE_OK id=$($case.id) processRun=$($rows.Count)/9 image=$outputImageName"
  } catch { Write-BatchLog "CAPTURE_FAILED id=$($case.id) error=$($_.Exception.Message)"; throw }
  finally { Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue }
}

$candidateEffective=@($rows|Where-Object{$_.effective.enabled}|ForEach-Object{[double]$_.effective.diskOuter})
if($candidateEffective.Count -ne 8 -or (@($candidateEffective|Sort-Object -Unique)).Count -ne 8){throw "Eight candidate effective DISK_OUTER values must be unique."}
$expected=@(32.0,29.0,26.0,23.0,20.0,18.0,16.0,14.0)
for($i=0;$i -lt 8;$i++){Assert-Close $candidateEffective[$i] $expected[$i] "candidate effective DISK_OUTER index $i"}
New-ContactSheet $cases $rows
$expectedFiles=@("control.png","smoke-01.png","smoke-02.png","smoke-03.png","smoke-04.png","smoke-05.png","smoke-06.png","smoke-07.png","smoke-08.png","metrics.jsonl","batch-summary.json","contact-sheet.png","batch.log")
$summary=[ordered]@{
  schemaVersion="3.0";headSha=$headSha;runId=$runId;totalGroups=9;successfulGroups=$rows.Count
  parameterReceiptVerified=$true
  geometrySweep=[ordered]@{parameter="DISK_OUTER";controlEffective=35.0;candidateEffective=$candidateEffective}
  geometryEvaluation=[ordered]@{mode="manual-exploration";automatedGeometryLoss=$false;reason="upstream binary reference crop SHA256 not yet verified in repository CI"}
  auxiliaryRoiMetricsOnly=$true;files=$expectedFiles;notAVisualAcceptance=$true
}
$summary|ConvertTo-Json -Depth 10|Set-Content -LiteralPath $summaryPath
$metricLineCount=@(Get-Content -LiteralPath $metricsPath).Count; $actual=@(Get-ChildItem -LiteralPath $OutputDirectory -File|ForEach-Object Name|Sort-Object)
$missing=@($expectedFiles|Where-Object{$_ -notin $actual});$unexpected=@($actual|Where-Object{$_ -notin $expectedFiles})
if($rows.Count -ne 9 -or $metricLineCount -ne 9 -or $missing.Count -ne 0 -or $unexpected.Count -ne 0){throw "Batch output validation failed groups=$($rows.Count) metricLines=$metricLineCount missing=$($missing -join ',') unexpected=$($unexpected -join ',')"}
Write-BatchLog "BATCH_SUMMARY successfulGroups=9 metricLines=9 parameterReceiptVerified=true geometryEvaluation=manual-exploration notAVisualAcceptance=true"
Write-BatchLog "BATCH_OK processRuns=9 exeSha256=$exeDigest"
