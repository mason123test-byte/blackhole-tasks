[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'npm was not found. Install Node.js 20 or newer.'
}
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    throw 'cargo was not found. Install the Rust stable MSVC toolchain, reopen PowerShell, and retry.'
}

if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules'))) {
    npm install
    if ($LASTEXITCODE -ne 0) { throw 'npm install failed.' }
}

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'TypeScript typecheck failed.' }
npm run lint
if ($LASTEXITCODE -ne 0) { throw 'ESLint failed.' }
npm run test
if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed.' }
cargo fmt --manifest-path src-tauri\Cargo.toml --check
if ($LASTEXITCODE -ne 0) { throw 'cargo fmt check failed.' }
cargo clippy --manifest-path src-tauri\Cargo.toml --all-targets --all-features -- -D warnings
if ($LASTEXITCODE -ne 0) { throw 'cargo clippy failed.' }
cargo test --manifest-path src-tauri\Cargo.toml
if ($LASTEXITCODE -ne 0) { throw 'Rust tests failed.' }
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw 'Tauri installer build failed.' }

$bundleRoot = Join-Path $projectRoot 'src-tauri\target\release\bundle'
$installers = @(Get-ChildItem -LiteralPath $bundleRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.exe', '.msi' })
if ($installers.Count -eq 0) { throw "Build completed but no installer was found under $bundleRoot" }
Write-Output 'BUILD_OK'
$installers | Select-Object FullName, Length, LastWriteTime

