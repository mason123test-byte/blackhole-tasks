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
  $pattern = 'effectiveSource=(gpu-uniform-readback);effectiveExperimentId=([^;|]+);effectiveEnabled=([01]);effectiveFilmDiskExposure=([0-9.]+);effectiveDiskOuter=([0-9.]+);crossingSource=(gpu-uniform-readback);requestedCrossingOrder=([^;|]+);effectiveVisualCompare=([0-9.]+);effectiveCrossingOrder=([^;|]+)'
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
    requestedCrossingOrder = [uri]::UnescapeDataString($Matches[7])
    visualCompare = [double]::Parse($Matches[8], [System.Globalization.CultureInfo]::InvariantCulture)
    crossingOrder = [uri]::UnescapeDataString($Matches[9])
  }
}

# Machine-readable GPU evidence comes from the *offscreen RGBA8 FBO*,
# not from the window screenshot (which includes task UI and desktop pixels).
function Read-GpuFrame([string]$Title) {
  $size=[regex]::Match($Title, 'size=([0-9]+)x([0-9]+)')
  $match=[regex]::Match($Title, ';g1=([0-9]+(?:,[0-9]+){11})(?=;|\||$)')
  if(-not $size.Success -or -not $match.Success){throw 'Missing RGBA8 framebuffer size/g1 evidence in GPU title receipt.'}
  [int64]$width=[int64]::Parse($size.Groups[1].Value)
  [int64]$height=[int64]::Parse($size.Groups[2].Value)
  [int64]$total=$width*$height
  if($width -lt 240 -or $height -lt 180 -or $total -gt 16777216){throw 'Invalid diagnostic GPU framebuffer dimensions.'}
  $v=@($match.Groups[1].Value.Split(',') | ForEach-Object {[int64]::Parse($_,[System.Globalization.CultureInfo]::InvariantCulture)})
  if($v.Count -ne 12 -or $v[0] -gt $total -or $v[1] -gt $v[0] -or $v[3] -gt $total -or $v[2] -gt 765*$total){throw 'Invalid GPU framebuffer metrics bounds.'}
  [int64]$reasonSum=0
  for($j=4;$j -lt 12;$j++){$reasonSum+=$v[$j]}
  if($reasonSum -gt $total){throw 'Invalid termination reason population.'}
  [pscustomobject]@{
    source='webgl2-gl.readPixels-rgba8';width=$width;height=$height;totalPixels=$total
    nonZeroRgbPixels=$v[0];rgbContributionPixels=$v[1];rgbEnergy=$v[2];alphaPixels=$v[3]
    nonZeroRgbCoverage=[double]$v[0]/[double]$total
    rgbCoverage=[double]$v[1]/[double]$total
    terminationReasons=[pscustomobject]@{
      reachedThird=$v[4];horizon=$v[5];escape=$v[6];maxSteps=$v[7]
      transmittanceCutoff=$v[8];integratorReject=$v[9];pretraceCull=$v[10];otherVisible=$v[11]
    }
  }
}

function Assert-DiagnosticReceipt($Receipt, $Case) {
  if ($Receipt.visualSource -ne "gpu-uniform-readback" -or $Receipt.crossingSource -ne "gpu-uniform-readback") {
    throw "Diagnostic receipt must come from GPU uniform readback."
  }
  if ($Receipt.enabled -ne $Case.enabled) { throw "visual experiment enabled mismatch for $($Case.id)" }
  if ($Receipt.experimentId -ne $Case.experimentId) { throw "experimentId mismatch for $($Case.id): $($Receipt.experimentId)" }
  Assert-Close $Receipt.filmDiskExposure 1.55 "$($Case.id) filmDiskExposure"
  Assert-Close $Receipt.diskOuter 35.0 "$($Case.id) diskOuter"
  if ($Receipt.requestedCrossingOrder -ne $Case.crossingOrder) { throw "requestedCrossingOrder mismatch for $($Case.id)" }
  Assert-Close $Receipt.visualCompare $Case.shaderMode "$($Case.id) visualCompare"
  if ($Receipt.crossingOrder -ne $Case.crossingOrder) { throw "crossingOrder mismatch for $($Case.id)" }
}

function Get-Finding([int64]$ReachPixels, [int64]$PreTransPixels, [int64]$PostTransPixels) {
  if ($ReachPixels -eq 0) { return "third-valid-crossing-not-reached" }
  if ($PreTransPixels -eq 0) { return "third-reached-but-emission-zero" }
  if ($PostTransPixels -eq 0) { return "third-emission-present-but-post-transmittance-zero" }
  return "third-post-transmittance-contribution-present"
}

if ($SelfTest) {
  $good = '黑洞任务|renderer=webgl2|frame=ready|energy=200|size=920x700|diag=a1-m1-am255-sr1-e0-f36053;effectiveSource=gpu-uniform-readback;effectiveExperimentId=crossing-third-reach;effectiveEnabled=1;effectiveFilmDiskExposure=1.550000;effectiveDiskOuter=35.000000;crossingSource=gpu-uniform-readback;requestedCrossingOrder=third-reach;effectiveVisualCompare=6.000000;effectiveCrossingOrder=third-reach'
  $longGood = $good + ';receiptPadding=' + ('x' * 160)
  if ($longGood.Length -le 400) { throw "Long GPU receipt fixture must exceed 400 characters." }
  $case = [pscustomobject]@{ id="third-reach"; experimentId="crossing-third-reach"; enabled=$true; shaderMode=6.0; crossingOrder="third-reach" }
  Assert-DiagnosticReceipt (Read-DiagnosticReceipt $longGood) $case
  $gpuTest=Read-GpuFrame ($longGood+';g1=2,1,13,2,0,1,0,0,0,0,0,0')
  if($gpuTest.nonZeroRgbPixels -ne 2 -or $gpuTest.terminationReasons.horizon -ne 1){throw 'GPU metrics fixture failed'}
  $invalidGpu=$false
  try { Read-GpuFrame ($longGood+';g1=644001,1,13,2,0,1,0,0,0,0,0,0')|Out-Null } catch { $invalidGpu=$true }
  if(-not $invalidGpu){throw 'GPU metrics bounds not enforced'}
  if ((Get-Finding 0 0 0) -ne 'third-valid-crossing-not-reached') { throw 'reachability finding failed' }
  if ((Get-Finding 12 0 0) -ne 'third-reached-but-emission-zero') { throw 'emission finding failed' }
  if ((Get-Finding 12 9 0) -ne 'third-emission-present-but-post-transmittance-zero') { throw 'transmittance finding failed' }
  if ((Get-Finding 12 9 3) -ne 'third-post-transmittance-contribution-present') { throw 'post-trans finding failed' }
  foreach ($bad in @(
    $good.Replace('crossingSource=gpu-uniform-readback;', ''),
    $good.Replace('effectiveDiskOuter=35.000000', 'effectiveDiskOuter=14.000000'),
    $good.Replace('effectiveCrossingOrder=third-reach', 'effectiveCrossingOrder=third-plus'),
    $good.Replace('effectiveExperimentId=crossing-third-reach', 'effectiveExperimentId=accepted-571')
  )) {
    $failed = $false
    try { Assert-DiagnosticReceipt (Read-DiagnosticReceipt $bad) $case } catch { $failed = $true }
    if (-not $failed) { throw "Crossing diagnostic contract accepted invalid evidence." }
  }
  "CROSSING_DIAGNOSTIC_SELF_TEST_OK longReceiptLength=$($longGood.Length) stagedFindings=4"
  return
}

if (-not $ExePath) { throw "ExePath is required unless -SelfTest is used." }
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
if (Test-Path -LiteralPath $OutputDirectory) { Remove-Item -LiteralPath $OutputDirectory -Recurse -Force }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$logPath = Join-Path $OutputDirectory "diagnostic.log"
$jsonlPath = Join-Path $OutputDirectory "diagnostic.jsonl"
$metricsPath = Join-Path $OutputDirectory "diagnostic-metrics.json"
$summaryPath = Join-Path $OutputDirectory "diagnostic-summary.json"
$contactSheetPath = Join-Path $OutputDirectory "contact-sheet.png"
$exeSha = (Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()
# A pull_request job checks out a synthetic merge commit (GITHUB_SHA).
# Record both the actual PR head and the built checkout SHA, never conflate them.
$checkoutSha = (& git rev-parse HEAD 2>$null | Out-String).Trim()
$headSha = if ($env:GITHUB_EVENT_NAME -eq 'pull_request' -and $env:GITHUB_EVENT_PATH) {
  $evt = Get-Content -LiteralPath $env:GITHUB_EVENT_PATH -Raw | ConvertFrom-Json
  [string]$evt.pull_request.head.sha
} elseif ($env:GITHUB_SHA) { $env:GITHUB_SHA } else { "local" }
$runId = if ($env:GITHUB_RUN_ID) { $env:GITHUB_RUN_ID } else { "local" }

function Write-DiagnosticLog([string]$Message) {
  ("{0:o} {1}" -f [DateTime]::UtcNow, $Message) | Tee-Object -FilePath $logPath -Append
}

Add-Type -AssemblyName System.Drawing
function Get-PngMetrics([string]$Path, [bool]$TerminationMap) {
  $source = [System.Drawing.Bitmap]::FromFile((Resolve-Path -LiteralPath $Path))
  $bitmap = [System.Drawing.Bitmap]::new($source.Width, $source.Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try { $graphics.DrawImage($source, 0, 0, $source.Width, $source.Height) } finally { $graphics.Dispose(); $source.Dispose() }
  $rect = [System.Drawing.Rectangle]::new(0,0,$bitmap.Width,$bitmap.Height)
  $data = $bitmap.LockBits($rect,[System.Drawing.Imaging.ImageLockMode]::ReadOnly,[System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  try {
    $byteCount = [Math]::Abs($data.Stride) * $data.Height
    $bytes = [byte[]]::new($byteCount)
    [Runtime.InteropServices.Marshal]::Copy($data.Scan0,$bytes,0,$byteCount)
    [int64]$nonZero = 0; [int64]$contribution = 0; [int64]$alphaPixels = 0; [int64]$energy = 0
    $reasons = [ordered]@{ reachedThird=0; horizon=0; escape=0; maxSteps=0; transmittanceCutoff=0; integratorReject=0; pretraceCull=0; otherVisible=0 }
    for ($y=0; $y -lt $data.Height; $y++) {
      $rowOffset = $y * [Math]::Abs($data.Stride)
      for ($x=0; $x -lt $data.Width; $x++) {
        $offset = $rowOffset + $x * 4
        $b=[int]$bytes[$offset]; $g=[int]$bytes[$offset+1]; $r=[int]$bytes[$offset+2]; $a=[int]$bytes[$offset+3]
        $max=[Math]::Max($r,[Math]::Max($g,$b)); if ($max -gt 0) { $nonZero++ }; if ($max -gt 8) { $contribution++ }; if ($a -gt 8) { $alphaPixels++ }; $energy += $r+$g+$b
        if ($TerminationMap -and $max -ge 64) {
          if ([Math]::Abs($r-$g) -lt 16 -and [Math]::Abs($g-$b) -lt 16) { $reasons.reachedThird++ }
          elseif ($r -ge 64 -and $g -lt 48 -and $b -lt 48) { $reasons.horizon++ }
          elseif ($g -ge 64 -and $r -lt 48 -and $b -lt 48) { $reasons.escape++ }
          elseif ($b -ge 64 -and $r -lt 48 -and $g -lt 48) { $reasons.maxSteps++ }
          elseif ($r -ge 64 -and $g -ge 64 -and $b -lt 48) { $reasons.transmittanceCutoff++ }
          elseif ($r -ge 64 -and $b -ge 64 -and $g -lt 48) { $reasons.integratorReject++ }
          elseif ($g -ge 64 -and $b -ge 64 -and $r -lt 48) { $reasons.pretraceCull++ }
          else { $reasons.otherVisible++ }
        }
      }
    }
    $total=[int64]$bitmap.Width*$bitmap.Height
    [pscustomobject]@{
      width=$bitmap.Width;height=$bitmap.Height;totalPixels=$total;nonZeroRgbPixels=$nonZero;rgbContributionPixels=$contribution
      rgbCoverage=if($total -eq 0){0.0}else{[double]$contribution/[double]$total};rgbEnergy=$energy;alphaPixels=$alphaPixels;terminationReasons=[pscustomobject]$reasons
    }
  } finally { $bitmap.UnlockBits($data); $bitmap.Dispose() }
}

$cases = @(
  [pscustomobject]@{id="normal";experimentId="accepted-571";enabled=$false;visualMode="candidate";shaderMode=1.0;crossingOrder="normal"},
  [pscustomobject]@{id="first";experimentId="crossing-first";enabled=$true;visualMode="crossing-first";shaderMode=3.0;crossingOrder="first"},
  [pscustomobject]@{id="second";experimentId="crossing-second";enabled=$true;visualMode="crossing-second";shaderMode=4.0;crossingOrder="second"},
  [pscustomobject]@{id="third-plus";experimentId="crossing-third-plus";enabled=$true;visualMode="crossing-third-plus";shaderMode=5.0;crossingOrder="third-plus"},
  [pscustomobject]@{id="third-reach";experimentId="crossing-third-reach";enabled=$true;visualMode="crossing-third-reach";shaderMode=6.0;crossingOrder="third-reach"},
  [pscustomobject]@{id="third-pre-trans";experimentId="crossing-third-pre-trans";enabled=$true;visualMode="crossing-third-pre-trans";shaderMode=7.0;crossingOrder="third-pre-trans"},
  [pscustomobject]@{id="termination";experimentId="crossing-termination";enabled=$true;visualMode="crossing-termination";shaderMode=8.0;crossingOrder="termination"}
)
$rows = [System.Collections.Generic.List[object]]::new(); $captureErrors=[System.Collections.Generic.List[string]]::new()
Write-DiagnosticLog "DIAGNOSTIC_START headSha=$headSha runId=$runId checkoutSha=$checkoutSha exeSha256=$exeSha cases=$($cases.Count) diskOuter=35 exposure=1.55 visualAcceptance=false"

foreach ($case in $cases) {
  $caseDirectory = Join-Path $env:TEMP "blackhole-crossing-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
  try {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    if ($case.enabled) { $env:BLACKHOLE_VISUAL_EXPERIMENT = ([ordered]@{experimentId=$case.experimentId;parameters=[ordered]@{DISK_OUTER=35.0}} | ConvertTo-Json -Compress) }
    Write-DiagnosticLog "CAPTURE_START id=$($case.id) experimentId=$($case.experimentId) requestedCrossing=$($case.crossingOrder) exeSha256=$exeSha"
    $smokeArgs=@{ExePath=$resolvedExePath;OutputDirectory=$caseDirectory;VisualOnly=$true;CandidateOnly=$true;VisualMode=$case.visualMode}
    if ($case.id -ne 'normal') { $smokeArgs.AllowEmptyDiagnosticCapture=$true }
    & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") @smokeArgs
    $receiptPath=Join-Path $caseDirectory "visual-candidate-effective.txt"; if(-not(Test-Path $receiptPath)){throw "Missing GPU receipt for $($case.id)."}
    $receiptTitle=Get-Content $receiptPath -Raw
    $receipt=Read-DiagnosticReceipt $receiptTitle
    Assert-DiagnosticReceipt $receipt $case
    if($case.id -ne 'normal' -and $receiptTitle -notmatch 'diag=a[0-9]+-m[0-9]+-am[0-9]+-sr1-e0-f36053;'){
      throw 'GPU framebuffer/scene status invalid in diagnostic receipt.'
    }
    $sourceImage=Join-Path $caseDirectory "visual-candidate.png"; if(-not(Test-Path $sourceImage)){throw "Missing native WebView2 image for $($case.id)."}
    $imageName="$($case.id).png"; $imagePath=Join-Path $OutputDirectory $imageName; Copy-Item $sourceImage $imagePath -Force
    $imageSha=(Get-FileHash $imagePath -Algorithm SHA256).Hash.ToLowerInvariant()
    $screenshot=Get-PngMetrics $imagePath $false
    $gpu=if($case.id -ne 'normal'){Read-GpuFrame $receiptTitle}else{$null}
    $row=[ordered]@{schemaVersion="2.0";headSha=$headSha;checkoutSha=$checkoutSha;runId=$runId;id=$case.id;imagePath=$imageName;imageSha256=$imageSha;exeSha256=$exeSha;dataSource="native-webview2-window-screenshot";framebufferDataSource="webgl2-gl.readPixels-rgba8";visualAcceptance=$false;
      requested=[ordered]@{experimentId=$case.experimentId;enabled=[bool]$case.enabled;crossingOrder=$case.crossingOrder;filmDiskExposure=1.55;diskOuter=35.0};
      effective=[ordered]@{source=$receipt.crossingSource;experimentId=$receipt.experimentId;enabled=[bool]$receipt.enabled;visualCompare=[double]$receipt.visualCompare;crossingOrder=$receipt.crossingOrder;filmDiskExposure=[double]$receipt.filmDiskExposure;diskOuter=[double]$receipt.diskOuter};screenshotMetrics=$screenshot;framebufferMetrics=$gpu}
    ($row|ConvertTo-Json -Compress -Depth 8)|Add-Content $jsonlPath; $rows.Add([pscustomobject]$row)
    Write-DiagnosticLog "CAPTURE_OK id=$($case.id) processRun=$($rows.Count)/$($cases.Count) gpuNonzero=$($gpu.nonZeroRgbPixels) gpuEnergy=$($gpu.rgbEnergy) screenshotRgb=$($screenshot.rgbContributionPixels) imageSha256=$imageSha"
  } catch {
    $message="$($case.id): $($_.Exception.Message)"; $captureErrors.Add($message); Write-DiagnosticLog "CAPTURE_FAILED $message"
  } finally { Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue; Remove-Item $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue }
}

$rows | ConvertTo-Json -Depth 10 | Set-Content $metricsPath
$byId=@{}; foreach($row in $rows){$byId[$row.id]=$row}
$reach=if($byId.ContainsKey('third-reach')){[int64]$byId['third-reach'].framebufferMetrics.nonZeroRgbPixels}else{-1}
$pre=if($byId.ContainsKey('third-pre-trans')){[int64]$byId['third-pre-trans'].framebufferMetrics.nonZeroRgbPixels}else{-1}
$post=if($byId.ContainsKey('third-plus')){[int64]$byId['third-plus'].framebufferMetrics.nonZeroRgbPixels}else{-1}
$finding=if($reach -ge 0 -and $pre -ge 0 -and $post -ge 0){Get-Finding $reach $pre $post}else{'incomplete-diagnostic-evidence'}

$images=@($rows | Where-Object { Test-Path (Join-Path $OutputDirectory $_.imagePath) })
$thumbWidth=360;$thumbHeight=274;$labelHeight=34;$columns=3;$gridRows=[Math]::Ceiling($images.Count/$columns)
$sheet=[System.Drawing.Bitmap]::new($thumbWidth*$columns,($thumbHeight+$labelHeight)*[int]$gridRows);$graphics=[System.Drawing.Graphics]::FromImage($sheet);$font=[System.Drawing.Font]::new([System.Drawing.FontFamily]::GenericSansSerif,11)
try{$graphics.Clear([System.Drawing.Color]::Black);for($i=0;$i-lt$images.Count;$i++){$row=$images[$i];$src=[System.Drawing.Bitmap]::FromFile((Resolve-Path (Join-Path $OutputDirectory $row.imagePath)));try{$c=$i%$columns;$gr=[Math]::Floor($i/$columns);$left=$c*$thumbWidth;$top=$gr*($thumbHeight+$labelHeight);$graphics.DrawImage($src,[System.Drawing.Rectangle]::new($left,$top,$thumbWidth,$thumbHeight));$graphics.DrawString("$($row.id) gpuNonzero=$($row.framebufferMetrics.nonZeroRgbPixels)",$font,[System.Drawing.Brushes]::White,[single]($left+6),[single]($top+$thumbHeight+6))}finally{$src.Dispose()}};$sheet.Save($contactSheetPath,[System.Drawing.Imaging.ImageFormat]::Png)}finally{$font.Dispose();$graphics.Dispose();$sheet.Dispose()}

$terminationReasons=if($byId.ContainsKey('termination')){$byId['termination'].framebufferMetrics.terminationReasons}else{$null}
$expectedFiles=@($cases|ForEach-Object{"$($_.id).png"})+@("diagnostic.jsonl","diagnostic-metrics.json","diagnostic-summary.json","contact-sheet.png","diagnostic.log")
$summary=[ordered]@{schemaVersion="2.0";headSha=$headSha;checkoutSha=$checkoutSha;runId=$runId;requestedGroups=$cases.Count;successfulGroups=$rows.Count;sameExeSha256=$exeSha;diskOuter=35.0;filmDiskExposure=1.55;effectiveSource="gpu-uniform-readback";pixelDataSource="native-webview2-window-screenshot";framebufferDataSource="webgl2-gl.readPixels-rgba8";visualAcceptance=$false;diagnosticFinding=$finding;thirdReachPixels=$reach;thirdPreTransPixels=$pre;thirdPostTransPixels=$post;terminationReasons=$terminationReasons;captureErrors=@($captureErrors);files=$expectedFiles}
$summary|ConvertTo-Json -Depth 10|Set-Content $summaryPath
Write-DiagnosticLog "DIAGNOSTIC_FINDING finding=$finding thirdReachPixels=$reach thirdPreTransPixels=$pre thirdPostTransPixels=$post visualAcceptance=false"
if($captureErrors.Count -gt 0){throw "Diagnostic capture infrastructure errors: $($captureErrors -join ' | ')"}
if($rows.Count -ne $cases.Count){throw "Diagnostic must produce exactly $($cases.Count) evidence rows."}
Write-DiagnosticLog "DIAGNOSTIC_OK processRuns=$($rows.Count) exeSha256=$exeSha source=gpu-uniform-readback finding=$finding visualAcceptance=false"
