param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-visual"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "windows-visual-experiment-preflight-contract.ps1")
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
$exeSha256 = (Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$cases = @(
  [pscustomobject]@{ id = "preflight-control"; enabled = $false; diskOuter = 35.0 },
  [pscustomobject]@{ id = "preflight-outer-14"; enabled = $true; diskOuter = 14.0 }
)
$receipts = [System.Collections.Generic.List[object]]::new()
try {
  foreach ($case in $cases) {
    Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
    if ($case.enabled) {
      $env:BLACKHOLE_VISUAL_EXPERIMENT = ([ordered]@{
        experimentId = $case.id
        parameters = [ordered]@{ DISK_OUTER = [double]$case.diskOuter }
      } | ConvertTo-Json -Compress)
    }
    $caseDirectory = Join-Path $env:TEMP "blackhole-preflight-$($case.id)-$([Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Force -Path $caseDirectory | Out-Null
    try {
      & (Join-Path $PSScriptRoot "windows-interaction-smoke.ps1") `
        -ExePath $resolvedExePath `
        -OutputDirectory $caseDirectory `
        -VisualOnly `
        -CandidateOnly
      $receipt = Read-EffectiveReceipt (Join-Path $caseDirectory "visual-candidate-effective.txt")
      if ($receipt.source -ne "gpu-uniform-readback") {
        throw "effective source mismatch for $($case.id): $($receipt.source)"
      }
      if ($receipt.enabled -ne $case.enabled) {
        throw "enabled mismatch for $($case.id): requested=$($case.enabled) effective=$($receipt.enabled)"
      }
      if ($case.enabled -and $receipt.experimentId -ne $case.id) {
        throw "experimentId mismatch for $($case.id): effective=$($receipt.experimentId)"
      }
      if (-not $case.enabled -and $receipt.experimentId -ne "accepted-571") {
        throw "control experimentId mismatch: effective=$($receipt.experimentId)"
      }
      Assert-Close $receipt.filmDiskExposure 1.55 "$($case.id) filmDiskExposure"
      Assert-Close $receipt.diskOuter $case.diskOuter "$($case.id) diskOuter"

      $temporaryImagePath = Join-Path $caseDirectory "visual-candidate.png"
      Assert-RequiredImage $temporaryImagePath
      $persistedImagePath = Join-Path $OutputDirectory "$($case.id).png"
      Copy-Item -LiteralPath $temporaryImagePath -Destination $persistedImagePath -Force
      Assert-RequiredImage $persistedImagePath
      $imageSha256 = (Get-FileHash -LiteralPath $persistedImagePath -Algorithm SHA256).Hash.ToLowerInvariant()

      $receipts.Add([pscustomobject]@{
        requested = [ordered]@{
          experimentId = if ($case.enabled) { $case.id } else { "accepted-571" }
          enabled = [bool]$case.enabled
          filmDiskExposure = 1.55
          diskOuter = [double]$case.diskOuter
        }
        effective = [ordered]@{
          source = $receipt.source
          experimentId = $receipt.experimentId
          enabled = [bool]$receipt.enabled
          filmDiskExposure = [double]$receipt.filmDiskExposure
          diskOuter = [double]$receipt.diskOuter
        }
        executable = [ordered]@{
          path = $resolvedExePath
          sha256 = $exeSha256
        }
        image = [ordered]@{
          path = $persistedImagePath
          sha256 = $imageSha256
        }
      })
      "VISUAL_EXPERIMENT_PREFLIGHT_CASE_OK id=$($case.id) source=$($receipt.source) requestedOuter=$($case.diskOuter) effectiveOuter=$($receipt.diskOuter) image=$persistedImagePath imageSha256=$imageSha256 exeSha256=$exeSha256"
    } finally {
      Remove-Item -LiteralPath $caseDirectory -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
} finally {
  Remove-Item Env:BLACKHOLE_VISUAL_EXPERIMENT -ErrorAction SilentlyContinue
}

if ($receipts.Count -ne 2) {
  throw "Visual experiment preflight did not produce exactly two verified receipts."
}
Assert-Close $receipts[0].effective.diskOuter 35.0 "control effective diskOuter"
Assert-Close $receipts[1].effective.diskOuter 14.0 "candidate effective diskOuter"
if ($receipts[0].effective.diskOuter -eq $receipts[1].effective.diskOuter) {
  throw "Visual experiment preflight did not prove distinct effective DISK_OUTER values."
}
foreach ($case in $receipts) {
  if ($case.effective.source -ne "gpu-uniform-readback") {
    throw "Visual experiment preflight accepted a non-GPU receipt source."
  }
  Assert-RequiredImage $case.image.path
  if ($case.executable.sha256 -ne $exeSha256) {
    throw "Visual experiment preflight did not use one identical executable."
  }
}

$summary = [ordered]@{
  schemaVersion = "2.0"
  sameExeSha256 = $exeSha256
  cases = @($receipts)
  verified = $true
  visualAcceptance = $false
}
$summaryPath = Join-Path $OutputDirectory "visual-experiment-preflight.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath
"VISUAL_EXPERIMENT_PREFLIGHT_OK source=gpu-uniform-readback controlEffectiveOuter=35 candidateEffectiveOuter=14 summary=$summaryPath"
