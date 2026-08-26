param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-smoke",
  [switch]$VisualOnly,
  [switch]$CandidateOnly,
  [ValidateSet("candidate", "crossing-first", "crossing-second", "crossing-third-plus")]
  [string]$VisualMode = "candidate"
)

$ErrorActionPreference = "Stop"
$fullScriptPath = Join-Path $PSScriptRoot "windows-interaction-smoke-full.ps1"
. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")

if ($CandidateOnly -and -not $VisualOnly) {
  throw "CandidateOnly is valid only with VisualOnly."
}
if (-not $CandidateOnly -and $VisualMode -ne "candidate") {
  throw "VisualMode diagnostics require CandidateOnly."
}

if (-not $VisualOnly) {
  & $fullScriptPath -ExePath $ExePath -OutputDirectory $OutputDirectory
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  return
}

# Keep one source of truth for the native WebView2 visual capture helpers. The
# full smoke script deliberately performs all visual A/B captures before the
# native task lifecycle begins. VisualOnly executes exactly that validated
# prefix and stops at the explicit full-interaction boundary below.
$fullSource = Get-Content -LiteralPath $fullScriptPath -Raw
$fullInteractionBoundary = '$diagnosticMarkerPath = [System.IO.Path]::ChangeExtension($resolvedExePath, ".smoke-diagnostics")'
$boundaryIndex = $fullSource.IndexOf($fullInteractionBoundary, [System.StringComparison]::Ordinal)
if ($boundaryIndex -lt 0) {
  throw "VisualOnly boundary was not found in windows-interaction-smoke-full.ps1."
}

$visualSource = $fullSource.Substring(0, $boundaryIndex)
$hardcodedCandidateCapture = '  Capture-VisualComparisonFrame $resolvedExePath "candidate" $visualCandidatePath'
$selectedCandidateCapture = '  Capture-VisualComparisonFrame $resolvedExePath $env:BLACKHOLE_VISUAL_CAPTURE_MODE $visualCandidatePath'
if (-not $visualSource.Contains($hardcodedCandidateCapture)) {
  throw "VisualMode candidate capture anchor was not found in windows-interaction-smoke-full.ps1."
}
$visualSource = $visualSource.Replace($hardcodedCandidateCapture, $selectedCandidateCapture)

# A crossing-isolation frame may correctly contain almost no bright disk pixels.
# In that diagnostic-only case the GPU receipt plus a valid WebGL framebuffer is
# the readiness proof; ordinary visual modes still require the established
# energy > 100 condition.
$readinessAnchor = '[int]$Matches[1] -gt 100 -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180'
$readinessReplacement = '([int]$Matches[1] -gt 100 -or $lastTitle -match ''crossingSource=gpu-uniform-readback;requestedVisualMode=crossing-[^;|]+;effectiveVisualCompare=[0-9.]+;effectiveCrossingOrder=(first|second|third-plus)'') -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180'
if (-not $visualSource.Contains($readinessAnchor)) {
  throw "Crossing diagnostic readiness anchor was not found in windows-interaction-smoke-full.ps1."
}
$visualSource = $visualSource.Replace($readinessAnchor, $readinessReplacement)

$receiptAnchor = '$orbWindow = Wait-OrbRenderReady $visualProcess.Id'
$receiptBlock = @'
$orbWindow = Wait-OrbRenderReady $visualProcess.Id
if ($Mode -in @("candidate", "crossing-first", "crossing-second", "crossing-third-plus")) {
  $receiptDeadline = [DateTime]::UtcNow.AddSeconds(8)
  $receiptWindow = $null
  do {
    $receiptMatch = @(Get-AppWindows $visualProcess.Id | Where-Object {
      $_.Title.StartsWith("黑洞任务|renderer=webgl2|frame=ready|") -and
      $_.Title -match 'effectiveSource=gpu-uniform-readback;effectiveExperimentId=[^;|]+;effectiveEnabled=[01];effectiveFilmDiskExposure=[0-9.]+;effectiveDiskOuter=[0-9.]+;crossingSource=gpu-uniform-readback;requestedVisualMode=[^;|]+;effectiveVisualCompare=[0-9.]+;effectiveCrossingOrder=[^;|]+'
    })
    if ($receiptMatch.Count -gt 0) {
      $receiptWindow = $receiptMatch[0]
      break
    }
    Start-Sleep -Milliseconds 50
  } while ([DateTime]::UtcNow -lt $receiptDeadline)
  if ($null -eq $receiptWindow) {
    throw "Candidate render did not publish GPU-uniform visual experiment and crossing-order receipts before capture."
  }
  $orbWindow = $receiptWindow
  Set-Content -LiteralPath (Join-Path $OutputDirectory "visual-candidate-effective.txt") -Value $orbWindow.Title -NoNewline
}
'@
if (-not $visualSource.Contains($receiptAnchor)) {
  throw "Effective receipt injection anchor was not found in windows-interaction-smoke-full.ps1."
}
$visualSource = $visualSource.Replace($receiptAnchor, $receiptBlock)
$visualBlock = [ScriptBlock]::Create($visualSource)
$env:BLACKHOLE_VISUAL_CAPTURE_MODE = $VisualMode
try {
  & $visualBlock -ExePath $ExePath -OutputDirectory $OutputDirectory -CandidateOnly:$CandidateOnly
} catch {
  @(
    "WINDOWS_VISUAL_CAPTURE_FAILED"
    "error=$($_.Exception.Message)"
  ) | Set-Content -LiteralPath (Join-Path $OutputDirectory "visual-bootstrap-diagnostics.txt")
  throw
} finally {
  Remove-Item Env:BLACKHOLE_VISUAL_CAPTURE_MODE -ErrorAction SilentlyContinue
}

$requiredEvidence = if ($CandidateOnly) {
  @("visual-candidate.png", "visual-candidate-effective.txt")
} else {
  @(
    "visual-baseline.png",
    "visual-candidate.png",
    "visual-candidate-effective.txt",
    "visual-split.png",
    "visual-difference.png",
    "visual-comparison-metrics.txt"
  )
}
foreach ($name in $requiredEvidence) {
  $path = Join-Path $OutputDirectory $name
  if (-not (Test-Path -LiteralPath $path) -or (Get-Item -LiteralPath $path).Length -eq 0) {
    throw "VisualOnly did not produce required evidence: $name"
  }
}

if (-not $CandidateOnly) {
  # Candidate is already an expanded real Windows WebView2 scene. Publish an
  # explicit expanded-scene filename so the visual artifact is self-describing.
  Copy-Item -LiteralPath (Join-Path $OutputDirectory "visual-candidate.png") `
    -Destination (Join-Path $OutputDirectory "02-single-scene-expanded.png") -Force

  $metrics = Get-Content -LiteralPath (Join-Path $OutputDirectory "visual-comparison-metrics.txt") -Raw
  $logPath = Join-Path $OutputDirectory "visual-only.log"
  @(
    "WINDOWS_VISUAL_ONLY_OK"
    "renderer=webgl2"
    "interactionLifecycleExecuted=false"
    $metrics.Trim()
  ) | Set-Content -LiteralPath $logPath
}

"WINDOWS_VISUAL_ONLY_OK output=$OutputDirectory candidateOnly=$CandidateOnly visualMode=$VisualMode"