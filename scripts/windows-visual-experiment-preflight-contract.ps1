param([switch]$SelfTest)

$ErrorActionPreference = "Stop"

function Read-EffectiveReceipt([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Missing effective visual experiment receipt: $Path"
  }
  $title = Get-Content -LiteralPath $Path -Raw
  if ($title -notmatch 'effectiveSource=(gpu-uniform-readback);effectiveExperimentId=([^;|]+);effectiveEnabled=([01]);effectiveFilmDiskExposure=([0-9.]+);effectiveDiskOuter=([0-9.]+)') {
    throw "Malformed or non-GPU effective visual experiment receipt: $title"
  }
  return [pscustomobject]@{
    source = $Matches[1]
    experimentId = [uri]::UnescapeDataString($Matches[2])
    enabled = $Matches[3] -eq '1'
    filmDiskExposure = [double]::Parse($Matches[4], [System.Globalization.CultureInfo]::InvariantCulture)
    diskOuter = [double]::Parse($Matches[5], [System.Globalization.CultureInfo]::InvariantCulture)
    rawTitle = $title
  }
}

function Assert-Close([double]$Actual, [double]$Expected, [string]$Name) {
  if (-not [double]::IsFinite($Actual) -or [Math]::Abs($Actual - $Expected) -gt 0.000001) {
    throw "$Name mismatch: expected=$Expected actual=$Actual"
  }
}

function Assert-RequiredImage([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path) -or (Get-Item -LiteralPath $Path).Length -eq 0) {
    throw "Missing required preflight image: $Path"
  }
}

if ($SelfTest) {
  $directory = Join-Path ([System.IO.Path]::GetTempPath()) "blackhole-preflight-contract-$([Guid]::NewGuid().ToString('N'))"
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  try {
    $missingImageFailed = $false
    try { Assert-RequiredImage (Join-Path $directory "missing.png") } catch { $missingImageFailed = $true }
    if (-not $missingImageFailed) { throw "Contract self-test accepted a missing image." }

    $missingReceiptFailed = $false
    try { Read-EffectiveReceipt (Join-Path $directory "missing.txt") | Out-Null } catch { $missingReceiptFailed = $true }
    if (-not $missingReceiptFailed) { throw "Contract self-test accepted a missing receipt." }

    $badReceipt = Join-Path $directory "bad.txt"
    Set-Content -LiteralPath $badReceipt -Value 'effectiveSource=js-config;effectiveExperimentId=x;effectiveEnabled=1;effectiveFilmDiskExposure=1.55;effectiveDiskOuter=14' -NoNewline
    $badSourceFailed = $false
    try { Read-EffectiveReceipt $badReceipt | Out-Null } catch { $badSourceFailed = $true }
    if (-not $badSourceFailed) { throw "Contract self-test accepted a non-GPU receipt." }

    "PREFLIGHT_CONTRACT_SELF_TEST_OK"
  } finally {
    Remove-Item -LiteralPath $directory -Recurse -Force -ErrorAction SilentlyContinue
  }
}
