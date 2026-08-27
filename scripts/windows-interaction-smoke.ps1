param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-smoke",
  [switch]$VisualOnly,
  [switch]$CandidateOnly,
  [switch]$AllowEmptyDiagnosticCapture,
  [ValidateSet("candidate", "crossing-first", "crossing-second", "crossing-third-plus", "crossing-third-reach", "crossing-third-pre-trans", "crossing-termination")]
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
if ($AllowEmptyDiagnosticCapture -and (-not $CandidateOnly -or $VisualMode -eq "candidate")) {
  throw "AllowEmptyDiagnosticCapture is diagnostic-only and requires CandidateOnly."
}

if (-not $VisualOnly) {
  & $fullScriptPath -ExePath $ExePath -OutputDirectory $OutputDirectory
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  return
}

$fullSource = Get-Content -LiteralPath $fullScriptPath -Raw
$fullInteractionBoundary = '$diagnosticMarkerPath = [System.IO.Path]::ChangeExtension($resolvedExePath, ".smoke-diagnostics")'
$boundaryIndex = $fullSource.IndexOf($fullInteractionBoundary, [System.StringComparison]::Ordinal)
if ($boundaryIndex -lt 0) {
  throw "VisualOnly boundary was not found in windows-interaction-smoke-full.ps1."
}

$visualSource = $fullSource.Substring(0, $boundaryIndex)

# Win32 window text must be read at its actual length because the GPU receipt
# can exceed 400 characters. Replace the legacy fixed 256-character probe in
# the executed visual prefix with GetWindowTextLengthW-sized storage.
$getTextAnchor = @'
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maximumCount);
'@.Trim()
$getTextReplacement = @'
    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "GetWindowTextLengthW")]
    private static extern int GetWindowTextLength(IntPtr window);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "GetWindowTextW")]
    private static extern int GetWindowText(IntPtr window, StringBuilder text, int maximumCount);
'@.Trim()
$titleReadAnchor = @'
                var title = new StringBuilder(256);
                GetWindowText(window, title, title.Capacity);
'@.Trim()
$titleReadReplacement = @'
                var titleLength = Math.Max(GetWindowTextLength(window), 0);
                var title = new StringBuilder(titleLength + 1);
                GetWindowText(window, title, title.Capacity);
'@.Trim()
if (-not $visualSource.Contains($getTextAnchor) -or -not $visualSource.Contains($titleReadAnchor)) {
  throw "Dynamic Win32 title-read anchors were not found in windows-interaction-smoke-full.ps1."
}
$visualSource = $visualSource.Replace($getTextAnchor, $getTextReplacement).Replace($titleReadAnchor, $titleReadReplacement)

$hardcodedCandidateCapture = '  Capture-VisualComparisonFrame $resolvedExePath "candidate" $visualCandidatePath'
if (-not $visualSource.Contains($hardcodedCandidateCapture)) {
  throw "Candidate capture anchor was not found in windows-interaction-smoke-full.ps1."
}

# Diagnostic capture normally needs real RGB crossing contribution. For the
# explicit staged observability run only, an all-black GPU-proven diagnostic
# frame is also capturable so zero remains auditable negative evidence. The
# bypass is capture-only and is never visual acceptance.
$readinessAnchor = '[int]$Matches[1] -gt 100 -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180'
$diagnosticReceiptPattern = 'crossingSource=gpu-uniform-readback;requestedCrossingOrder=(first|second|third-plus|third-reach|third-pre-trans|termination);effectiveVisualCompare=[0-9.]+;effectiveCrossingOrder=(first|second|third-plus|third-reach|third-pre-trans|termination)'
$readinessReplacement = '(([int]$Matches[1] -gt 100) -or ([int]$Matches[1] -ge 8 -and $lastTitle -match ''' + $diagnosticReceiptPattern + ''') -or ($script:AllowEmptyDiagnosticCapture -and [int]$Matches[1] -eq 0 -and $lastTitle -match ''' + $diagnosticReceiptPattern + ''')) -and [int]$Matches[2] -ge 240 -and [int]$Matches[3] -ge 180'
if (-not $visualSource.Contains($readinessAnchor)) {
  throw "Crossing diagnostic readiness anchor was not found in windows-interaction-smoke-full.ps1."
}
$visualSource = $visualSource.Replace($readinessAnchor, $readinessReplacement)

$receiptAnchor = '$orbWindow = Wait-OrbRenderReady $visualProcess.Id'
$receiptBlock = @'
$orbWindow = Wait-OrbRenderReady $visualProcess.Id
if ($Mode -eq "candidate") {
  $receiptDeadline = [DateTime]::UtcNow.AddSeconds(8)
  $receiptWindow = $null
  do {
    $receiptMatch = @(Get-AppWindows $visualProcess.Id | Where-Object {
      $_.Title.StartsWith("黑洞任务|renderer=webgl2|frame=ready|") -and
      $_.Title -match 'effectiveSource=gpu-uniform-readback;effectiveExperimentId=[^;|]+;effectiveEnabled=[01];effectiveFilmDiskExposure=[0-9.]+;effectiveDiskOuter=[0-9.]+;crossingSource=gpu-uniform-readback;requestedCrossingOrder=[^;|]+;effectiveVisualCompare=[0-9.]+;effectiveCrossingOrder=[^;|]+'
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
$script:AllowEmptyDiagnosticCapture = $AllowEmptyDiagnosticCapture.IsPresent
try {
  & $visualBlock -ExePath $ExePath -OutputDirectory $OutputDirectory -CandidateOnly:$CandidateOnly
} catch {
  @(
    "WINDOWS_VISUAL_CAPTURE_FAILED"
    "error=$($_.Exception.Message)"
  ) | Set-Content -LiteralPath (Join-Path $OutputDirectory "visual-bootstrap-diagnostics.txt")
  throw
} finally {
  $script:AllowEmptyDiagnosticCapture = $false
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

"WINDOWS_VISUAL_ONLY_OK output=$OutputDirectory candidateOnly=$CandidateOnly visualMode=$VisualMode allowEmptyDiagnosticCapture=$($AllowEmptyDiagnosticCapture.IsPresent)"