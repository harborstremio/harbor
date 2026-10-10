#Requires -Version 5.1
<#
  Harbor beta release, end to end.

    pwsh -File scripts/release-beta.ps1                  # build + verify + sign + stage
    pwsh -File scripts/release-beta.ps1 -Publish         # ... and publish to the beta channel
    pwsh -File scripts/release-beta.ps1 -SkipApp         # reuse the existing harbor.exe

  Mac artifacts are optional. Drop Harbor_<version>_aarch64.app.tar.gz(.sig) and
  Harbor_<version>_aarch64.dmg into the staging folder before -Publish to include them.
#>
param(
  [switch]$Publish,
  [switch]$SkipApp,
  [string]$Channel = 'beta',
  [string]$StageRoot = 'D:\harbor-release',
  [string]$NotesFile
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function Step($text) { Write-Host "`n=== $text ===" -ForegroundColor Cyan }
function Fail($text) { throw $text }
function Run($file, $arguments) {
  & $file @arguments
  if ($LASTEXITCODE -ne 0) { Fail "$file $($arguments -join ' ') failed with exit $LASTEXITCODE" }
}

$version = (Get-Content src-tauri/tauri.conf.json -Raw | ConvertFrom-Json).version
if ($version -notmatch '^\d+\.\d+\.\d+$') { Fail "Bad version in tauri.conf.json: $version" }
Step "Harbor $version -> $Channel"

Step 'Version consistency'
$checks = @(
  @{ File = 'package.json';                          Pattern = '"version":\s*"([^"]+)"' }
  @{ File = 'src-tauri/tauri.conf.json';             Pattern = '"version":\s*"([^"]+)"' }
  @{ File = 'src-tauri/Cargo.toml';                  Pattern = '(?m)^version\s*=\s*"([^"]+)"' }
  @{ File = 'installer/package.json';                Pattern = '"version":\s*"([^"]+)"' }
  @{ File = 'installer/src-tauri/tauri.conf.json';   Pattern = '"version":\s*"([^"]+)"' }
  @{ File = 'installer/src-tauri/Cargo.toml';        Pattern = '(?m)^version\s*=\s*"([^"]+)"' }
)
foreach ($check in $checks) {
  $raw = Get-Content $check.File -Raw
  $found = [regex]::Match($raw, $check.Pattern)
  if (-not $found.Success) { Fail "No version found in $($check.File)" }
  if ($found.Groups[1].Value -ne $version) { Fail "$($check.File) is $($found.Groups[1].Value), expected $version" }
  Write-Host "  ok  $($check.File)"
}
foreach ($lock in @(@{ File = 'src-tauri/Cargo.lock'; Name = 'harbor' }, @{ File = 'installer/src-tauri/Cargo.lock'; Name = 'harbor-setup' })) {
  $raw = Get-Content $lock.File -Raw
  $found = [regex]::Match($raw, "(?ms)name\s*=\s*""$($lock.Name)""\s*\r?\nversion\s*=\s*""([^""]+)""")
  if (-not $found.Success) { Fail "No $($lock.Name) entry in $($lock.File)" }
  if ($found.Groups[1].Value -ne $version) { Fail "$($lock.File) has $($lock.Name) $($found.Groups[1].Value), expected $version" }
  Write-Host "  ok  $($lock.File) ($($lock.Name))"
}

if (-not $SkipApp) {
  Step 'App build'
  Run 'pnpm' @('tauri', 'build')
} else {
  Step 'App build skipped'
}

Step 'Uninstaller'
Run 'cargo' @('build', '--manifest-path', 'installer/src-tauri/Cargo.toml', '--release',
  '--no-default-features', '--features', 'tauri/custom-protocol', '--bin', 'harbor-uninstall', '--locked')

Step 'Payload'
Run 'node' @('installer/scripts/make-payload.mjs')
Run 'node' @('scripts/verify-managed-payload.mjs')

Step 'Managed installer'
Run 'cargo' @('build', '--manifest-path', 'installer/src-tauri/Cargo.toml', '--release',
  '--features', 'tauri/custom-protocol', '--bin', 'harbor-setup', '--locked')
Run 'node' @('scripts/verify-managed-payload.mjs', '--embedded')

Step 'Executable versions'
$exes = @(
  'src-tauri/target/release/harbor.exe',
  'installer/src-tauri/target/release/harbor-uninstall.exe',
  'installer/src-tauri/target/release/harbor-setup.exe'
)
foreach ($exe in $exes) {
  if (-not (Test-Path -LiteralPath $exe)) { Fail "Missing $exe" }
  $fileVersion = (Get-Item -LiteralPath $exe).VersionInfo.FileVersion
  if ($fileVersion -ne $version) { Fail "$exe reports $fileVersion, expected $version" }
  Write-Host "  ok  $exe"
}

Step 'Stage artifacts'
$stage = Join-Path $StageRoot $version
New-Item -ItemType Directory -Force -Path $stage | Out-Null
$setup = "src-tauri/target/release/bundle/nsis/Harbor_${version}_x64-setup.exe"
if (-not (Test-Path -LiteralPath $setup)) { Fail "Missing NSIS bundle $setup" }
$staged = @{
  "Harbor_${version}_x64-setup.exe"     = $setup
  "Harbor_${version}_x64-installer.exe" = 'installer/src-tauri/target/release/harbor-setup.exe'
}
foreach ($name in $staged.Keys) {
  Copy-Item -LiteralPath $staged[$name] -Destination (Join-Path $stage $name) -Force
  Write-Host "  staged $name"
}

Step 'Sign (each exe gets its own signature)'
$keyPath = Join-Path $env:USERPROFILE '.tauri\harbor-updater.key'
if (-not (Test-Path -LiteralPath $keyPath)) { Fail "No updater signing key at $keyPath" }
$env:TAURI_SIGNING_PRIVATE_KEY = (Get-Content -LiteralPath $keyPath -Raw).Trim()
if (-not $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD) { $env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = '' }
foreach ($name in $staged.Keys) {
  $target = Join-Path $stage $name
  Remove-Item -LiteralPath "$target.sig" -Force -ErrorAction SilentlyContinue
  Run 'pnpm' @('tauri', 'signer', 'sign', $target)
  if (-not (Test-Path -LiteralPath "$target.sig")) { Fail "Signing produced no $name.sig" }
  Write-Host "  signed $name"
}

Step 'Staging folder'
Get-ChildItem -LiteralPath $stage | Select-Object Name, Length, LastWriteTime | Format-Table -AutoSize

if (-not $Publish) {
  Write-Host "`nBuilt and signed. Nothing was published." -ForegroundColor Yellow
  Write-Host "To publish:  pwsh -File scripts/release-beta.ps1 -SkipApp -Publish" -ForegroundColor Yellow
  exit 0
}

Step "Publish to $Channel"
$envFile = Join-Path $env:USERPROFILE '.harbor\harbor-themes.env'
if (-not $env:HARBOR_THEMES_ADMIN_TOKEN) {
  if (-not (Test-Path -LiteralPath $envFile)) { Fail "No admin token: set HARBOR_THEMES_ADMIN_TOKEN or create $envFile" }
  foreach ($line in Get-Content -LiteralPath $envFile) {
    if ($line -match '^\s*([A-Z0-9_]+)\s*=\s*(.*)$') {
      Set-Item -Path "env:$($Matches[1])" -Value $Matches[2].Trim()
    }
  }
}
if (-not $env:HARBOR_THEMES_ADMIN_TOKEN) { Fail 'HARBOR_THEMES_ADMIN_TOKEN is empty' }

$publishArgs = @('scripts/publish-release.mjs', '--dir', $stage, '--version', $version, '--channel', $Channel)
if (-not $NotesFile) {
  $candidate = Join-Path $stage 'notes.txt'
  if (Test-Path -LiteralPath $candidate) { $NotesFile = $candidate }
}
if ($NotesFile) { $publishArgs += @('--notes-file', $NotesFile) }
Run 'node' $publishArgs

Step 'Done'
Write-Host "Harbor $version is live on $Channel." -ForegroundColor Green
