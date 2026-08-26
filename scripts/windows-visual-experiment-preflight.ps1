param(
  [Parameter(Mandatory = $true)]
  [string]$ExePath,
  [string]$OutputDirectory = "output/windows-visual"
)

$ErrorActionPreference = "Stop"
$resolvedExePath = (Resolve-Path -LiteralPath $ExePath).Path
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Read-EffectiveReceipt([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing effective visual experiment receipt: $Path"
  }
  $title = Get-Content -LiteralPath $Path -Raw
  if ($title -notmatch 'effectiveExperimentId=([^;|]+);effectiveEnabled=([01]);effectiveFilmDiskExposure=([0-9.]+);effectiveDiskOuter=([0-9.]+)') {
    throw "Malformed effective visual experiment receipt: $title"
  }
  return [pscustomobject]@{
    experimentId = [uri]::UnescapeDataString($Matches[1])
    enabled = $Matches[2] -eq '1'
    filmDiskExposure = [double]::Parse($Matches[3], [System.Globalization.CultureInfo]::InvariantCulture)
    diskOuter = [double]::Parse($Matches[4], [System.Globalization.CultureInfo]::InvariantCulture)
    rawTitle = $title
  }
}

function Assert-Close([double]$Actual, [double]$Expected, [string]$Name) {
  if ([Math]::Abs($Actual - $Expected) -gt 0.000001) {
    throw "$Name mismatch: expected=$Expected actual=$Actual"
  }
}

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
      $receipts.Add([pscustomobject]@{
        requested = [ordered]@{
          experimentId = if ($case.enabled) { $case.id } else { "accepted-571" }
          enabled = [bool]$case.enabled
          filmDiskExposure = 1.55
          diskOuter = [double]$case.diskOuter
        }
        effective = [ordered]@{
          experimentId = $receipt.experimentId
          enabled = [bool]$receipt.enabled
          filmDiskExposure = [double]$receipt.filmDiskExposure
          diskOuter = [double]$receipt.diskOuter
        }
      })
      "VISUAL_EXPERIMENT_PREFLIGHT_CASE_OK id=$($case.id) requestedOuter=$($case.diskOuter) effectiveOuter=$($receipt.diskOuter) enabled=$($receipt.enabled)"
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

$summary = [ordered]@{
  schemaVersion = "1.0"
  sameExeSha256 = (Get-FileHash -LiteralPath $resolvedExePath -Algorithm SHA256).Hash.ToLowerInvariant()
  cases = @($receipts)
  verified = $true
}
$summaryPath = Join-Path $OutputDirectory "visual-experiment-preflight.json"
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath
"VISUAL_EXPERIMENT_PREFLIGHT_OK controlEffectiveOuter=35 candidateEffectiveOuter=14 summary=$summaryPath"
