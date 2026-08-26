param(
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-crossing-diagnostic",
  [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

function Assert-Close([double]$Actual, [double]$Expected, [string]$Name) {
  if (-not [double]::IsFinite($Actual) -or [Math]::Abs($Actual - $Expected) -gt 0.000001) {
    throw "$Name mismatch: expected=$Expected actual=$Actual"
  }
}

function Read-DiagnosticReceipt([string]$Title) {
  $pattern = 'effectiveSource=(gpu-uniform-readback);effectiveExperimentId=([^;|]+);effectiveEnabled=([01]);effectiveFilmDiskExposure=([0-9.]+);effectiveDiskOuter=([0-9.]+);crossingSource=(gpu-uniform-readback);requestedVisualMode=([^;|]+);effectiveVisualCompare=([0-9.]+);effectiveCrossingOrder=([^;|]+)'
  if ($Title -notmatch $pattern) {
    throw "Malformed or incomplete GPU crossing diagnostic receipt: $Title"
  }
  [pscustomobject]@{
    visualSource = $Matches[1]
    experimentId = [uri]::UnescapeDataString($Matches[2])
    enabled = $Matches[3] -eq '1'
    filmDiskExposure = [double]::Parse($Matches[4], [System.Globalization.CultureInfo]::InvariantCulture)
    diskOuter = [double]::Parse($Matches[5], [System.Globalization.CultureInfo]::InvariantCulture)
    crossingSource = $Matches[6]
    requestedVisualMode = [uri]::UnescapeDataString($Matches[7])
    visualCompare = [double]::Parse($Matches[8], [System.Globalization.CultureInfo]::InvariantCulture)
    crossingOrder = [uri]::UnescapeDataString($Matches[9])
  }
}

function Assert-DiagnosticReceipt($Receipt, $Case) {
  if ($Receipt.visualSource -ne "gpu-uniform-readback" -or $Receipt.crossingSource -ne "gpu-uniform-readback") {
    throw "Diagnostic receipt must come from GPU uniform readback."
  }
  if ($Receipt.enabled) { throw "Crossing diagnostics must not enable visual parameter experiments." }
  if ($Receipt.experimentId -ne "accepted-571") { throw "Unexpected production experiment id: $($Receipt.experimentId)" }
  Assert-Close $Receipt.filmDiskExposure 1.55 "$($Case.id) filmDiskExposure"
  Assert-Close $Receipt.diskOuter 35.0 "$($Case.id) diskOuter"
  if ($Receipt.requestedVisualMode -ne $Case.visualMode) { throw "requestedVisualMode mismatch for $($Case.id)" }
  Assert-Close $Receipt.visualCompare $Case.shaderMode "$($Case.id) visualCompare"
  if ($Receipt.crossingOrder -ne $Case.crossingOrder) { throw "crossingOrder mismatch for $($Case.id)" }
}

if ($SelfTest) {
  $good = '黑洞任务|renderer=webgl2|frame=ready|energy=200|size=920x700|diag=a1-m1-am255-sr1-e0-f36053;effectiveSource=gpu-uniform-readback;effectiveExperimentId=accepted-571;effectiveEnabled=0;effectiveFilmDiskExposure=1.550000;effectiveDiskOuter=35.000000;crossingSource=gpu-uniform-readback;requestedVisualMode=crossing-second;effectiveVisualCompare=4.000000;effectiveCrossingOrder=second'
  $case = [pscustomobject]@{ id="second"; visualMode="crossing-second"; shaderMode=4.0; crossingOrder="second" }
  Assert-DiagnosticReceipt (Read-DiagnosticReceipt $good) $case
  foreach ($bad in @(
    $good.Replace('crossingSource=gpu-uniform-readback;', ''),
    $good.Replace('effectiveDiskOuter=35.000000', 'effectiveDiskOuter=14.000000'),
    $good.Replace('effectiveCrossingOrder=second', 'effectiveCrossingOrder=first')
  )) {
    $failed = $false
    try { Assert-DiagnosticReceipt (Read-DiagnosticReceipt $bad) $case } catch { $failed = $true }
    if (-not $failed) { throw "Crossing diagnostic contract accepted invalid evidence." }
  }
  "CROSSING_DIAGNOSTIC_SELF_TEST_OK"
  return
}

if (-not $ExePath) { throw "ExePath is required unless -SelfTest is used." }
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$logPath = Join-Path $OutputDirectory "diagnostic.log"
$jsonlPath = Join-Path $OutputDirectory "diagnostic.jsonl"
$summaryPath = Join-Path $OutputDirectory "diagnostic-summary.json"
$contactSheetPath = Join-Path $OutputDirectory "contact-sheet.png"
$exeSha = (Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()
$headSha = if ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { "local" }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local" }

function Write-DiagnosticLog([string]$Message) {
  ("{0:o} {1}" -f [DateTime]::UtcNow, $Message) | Tee-Object -FilePath $logPath -Append
}

$cases = @(
  [pscustomobject]@{id="normal";visualMode="candidate";shaderMode=1.0;crossingOrder="normal"},
  [pscustomobject]@{id="first";visualMode="crossing-first";shaderMode=3.0;crossingOrder="first"},
  [pscustomobject]@{id="second";visualMode="crossing-second";shaderMode=4.0;crossingOrder="second"},
  [pscustomobject]@{id="third-plus";visualMode="crossing-third-plus";shaderMode=5.0;crossingOrder="third-plus"}
)
$rows = [System.Collections.Generic.List[object]]::new()
Write-DiagnosticLog "DIAGNOSTIC_START headSha=$headSha runId=$runId exeSha256=$exeSha cases=4 diskOuter=35 exposure=1.55"

foreach ($case in $cases) {
  $caseDirectory = Join-Path $env:TEMP "blackhole-crossing-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
  try {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    Write-DiagnosticLog "CAPTURE_START id=$($case.id) visualMode=$($case.visualMode) requestedCrossing=$($case.crossingOrder) exeSha256=$exeSha"
    & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") `
      -ExePath $resolvedExePath `
      -OutputDirectory $caseDirectory `
      -VisualOnly `
      -CandidateOnly `
      -VisualMode $case.visualMode
    $receiptPath = Join-Path $caseDirectory "visual-candidate-effective.txt"
    if (-not (Test-Path -LiteralPath $receiptPath)) { throw "Missing GPU receipt for $($case.id)." }
    $receipt = Read-DiagnosticReceipt (Get-Content -LiteralPath $receiptPath -Raw)
    Assert-DiagnosticReceipt $receipt $case

    $sourceImage = Join-Path $caseDirectory "visual-candidate.png"
    if (-not (Test-Path -LiteralPath $sourceImage) -or (Get-Item -LiteralPath $sourceImage).Length -eq 0) {
      throw "Missing native WebView2 image for $($case.id)."
    }
    $imageName = "$($case.id).png"
    $imagePath = Join-Path $OutputDirectory $imageName
    Copy-Item -LiteralPath $sourceImage -Destination $imagePath -Force
    $imageSha = (Get-FileHash -LiteralPath $imagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $row = [ordered]@{
      schemaVersion="1.0"; headSha=$headSha; runId=$runId; id=$case.id; imagePath=$imageName; imageSha256=$imageSha; exeSha256=$exeSha
      requested=[ordered]@{visualMode=$case.visualMode;crossingOrder=$case.crossingOrder;filmDiskExposure=1.55;diskOuter=35.0}
      effective=[ordered]@{source=$receipt.crossingSource;visualMode=$receipt.requestedVisualMode;visualCompare=[double]$receipt.visualCompare;crossingOrder=$receipt.crossingOrder;filmDiskExposure=[double]$receipt.filmDiskExposure;diskOuter=[double]$receipt.diskOuter}
    }
    ($row | ConvertTo-Json -Compress -Depth 6) | Add-Content -LiteralPath $jsonlPath
    $rows.Add([pscustomobject]$row)
    Write-DiagnosticLog "CAPTURE_OK id=$($case.id) processRun=$($rows.Count)/4 source=$($receipt.crossingSource) crossing=$($receipt.crossingOrder) imageSha256=$imageSha exeSha256=$exeSha"
  } finally {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if ($rows.Count -ne 4 -or @(Get-Content -LiteralPath $jsonlPath).Count -ne 4) {
  throw "Crossing diagnostic must produce exactly four evidence rows."
}
if (@($rows | Where-Object { $_.effective.source -ne "gpu-uniform-readback" }).Count -ne 0) {
  throw "All crossing diagnostic modes must be proven by GPU uniform readback."
}
if (@($rows | Where-Object { $_.exeSha256 -ne $exeSha }).Count -ne 0) { throw "EXE SHA mismatch across diagnostic cases." }

Add-Type -AssemblyName System.Drawing
$thumbWidth=460; $thumbHeight=350; $labelHeight=42
$sheet=[System.Drawing.Bitmap]::new($thumbWidth*2,($thumbHeight+$labelHeight)*2)
$graphics=[System.Drawing.Graphics]::FromImage($sheet)
$font=[System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif,14)
try {
  $graphics.Clear([System.Drawing.Color]::Black)
  for ($index=0; $index -lt $rows.Count; $index++) {
    $row=$rows[$index]; $source=[System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath (Join-Path $OutputDirectory $row.imagePath)))
    try {
      $column=$index%2; $gridRow=[Math]::Floor($index/2); $left=$column*$thumbWidth; $top=$gridRow*($thumbHeight+$labelHeight)
      $graphics.DrawImage($source,[System.Drawing.Rectangle]::new($left,$top,$thumbWidth,$thumbHeight))
      $graphics.DrawString("$($row.id)  crossing=$($row.effective.crossingOrder)",$font,[System.Drawing.Brushes]::White,[single]($left+8),[single]($top+$thumbHeight+8))
    } finally { $source.Dispose() }
  }
  $sheet.Save($contactSheetPath,[System.Drawing.Imaging.ImageFormat]::Png)
} finally { $font.Dispose(); $graphics.Dispose(); $sheet.Dispose() }

$expectedFiles=@("normal.png","first.png","second.png","third-plus.png","diagnostic.jsonl","diagnostic-summary.json","contact-sheet.png","diagnostic.log")
$summary=[ordered]@{
  schemaVersion="1.0";headSha=$headSha;runId=$runId;totalGroups=4;successfulGroups=$rows.Count;sameExeSha256=$exeSha
  diskOuter=35.0;filmDiskExposure=1.55;effectiveSource="gpu-uniform-readback";mode="crossing-order-manual-diagnostic";notAVisualAcceptance=$true;files=$expectedFiles
}
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath
$actual=@(Get-ChildItem -LiteralPath $OutputDirectory -File | ForEach-Object Name | Sort-Object)
$missing=@($expectedFiles | Where-Object { $_ -notin $actual }); $unexpected=@($actual | Where-Object { $_ -notin $expectedFiles })
if ($missing.Count -ne 0 -or $unexpected.Count -ne 0) {
  throw "Diagnostic output mismatch missing=$($missing -join ',') unexpected=$($unexpected -join ',')"
}
Write-DiagnosticLog "DIAGNOSTIC_OK processRuns=4 exeSha256=$exeSha source=gpu-uniform-readback notAVisualAcceptance=true"
