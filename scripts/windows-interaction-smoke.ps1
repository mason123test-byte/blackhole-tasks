param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-smoke",
  [switch]$VisualOnly,
  [switch]$CandidateOnly
)

$ErrorActionPreference = "Stop"
$fullScriptPath = Join-Path $PSScriptRoot "windows-interaction-smoke-full.ps1"
. (Join-Path $PSScriptRoot "windows-fixed-roi-metrics.ps1")

if ($CandidateOnly -and -not $VisualOnly) {
  throw "CandidateOnly is valid only with VisualOnly."
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
$visualBlock = [ScriptBlock]::Create($visualSource)
try {
  & $visualBlock -ExePath $ExePath -OutputDirectory $OutputDirectory -CandidateOnly:$CandidateOnly
} catch {
  @(
    "WINDOWS_VISUAL_CAPTURE_FAILED"
    "error=$($_.Exception.Message)"
  ) | Set-Content -LiteralPath (Join-Path $OutputDirectory "visual-bootstrap-diagnostics.txt")
  throw
}

$requiredEvidence = if ($CandidateOnly) {
  @("visual-candidate.png")
} else {
  @(
    "visual-baseline.png",
    "visual-candidate.png",
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

"WINDOWS_VISUAL_ONLY_OK output=$OutputDirectory candidateOnly=$CandidateOnly"
