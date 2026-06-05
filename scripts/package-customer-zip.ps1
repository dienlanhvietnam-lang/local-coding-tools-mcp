#Requires -Version 5.1
<#
.SYNOPSIS
  Package customer install ZIP (no node_modules, no secrets).
#>
param(
  [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$Version = "0.7.0"
)

$ErrorActionPreference = "Stop"

$zipName = "local-coding-tools-mcp-v$Version-customer.zip"
$releaseDir = Join-Path $ProjectRoot "release"
$zipPath = Join-Path $releaseDir $zipName
$staging = Join-Path $releaseDir "staging-$Version"

$excludeDirNames = @('node_modules', 'logs', '.mcp-debug', '.git', 'release', 'staging')

function Test-ForbiddenPath([string]$RelPath) {
  $norm = $RelPath -replace '\\', '/'
  $base = Split-Path $RelPath -Leaf
  if ($norm -match '/node_modules/|/logs/|\.mcp-debug|/\.git/') { return $true }
  if ($base -match '\.env($|\.)') { return $true }
  if ($base -match '^credentials(\.|$)' -or $norm -match '/credentials/') { return $true }
  if ($base -match '^token\.(json|txt|key|pem)$' -or $norm -match '/token/') { return $true }
  if ($base -match '^secret\.(json|txt|key|pem)$' -or $norm -match '/secrets?/') { return $true }
  return $false
}

Write-Host "`n=== package-customer-zip.ps1 ===" -ForegroundColor Cyan
Write-Host "Version: $Version"
Write-Host "Output:  $zipPath"

# Build first
Push-Location $ProjectRoot
try {
  if (-not (Test-Path (Join-Path $ProjectRoot "dist\server.js"))) {
    Write-Host "Building..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }
  }
} finally {
  Pop-Location
}

if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging -Force | Out-Null
if (-not (Test-Path $releaseDir)) { New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null }

# Copy dist
Copy-Item -Path (Join-Path $ProjectRoot "dist") -Destination (Join-Path $staging "dist") -Recurse -Force

# Copy root files
foreach ($f in @("package.json", "README.md", "LICENSE", "CHANGELOG.md", "tsconfig.json")) {
  $src = Join-Path $ProjectRoot $f
  if (Test-Path $src) { Copy-Item $src (Join-Path $staging $f) -Force }
}

# Copy src for customer rebuild
$srcDir = Join-Path $ProjectRoot "src"
if (Test-Path $srcDir) {
  Copy-Item $srcDir (Join-Path $staging "src") -Recurse -Force
}

# Smoke fixture (package.json only — no .env / .mcp-debug)
$fixtureSrc = Join-Path $ProjectRoot "tests\fixtures\sample-project\package.json"
if (Test-Path $fixtureSrc) {
  $fixtureDest = Join-Path $staging "tests\fixtures\sample-project"
  New-Item -ItemType Directory -Path $fixtureDest -Force | Out-Null
  Copy-Item $fixtureSrc $fixtureDest -Force
}

# Copy scripts (customer install set)
$scriptsDest = Join-Path $staging "scripts"
New-Item -ItemType Directory -Path $scriptsDest -Force | Out-Null
foreach ($s in @(
    "install-vscode-mcp.ps1",
    "install-cursor-mcp.ps1",
    "test-mcp-install.ps1",
    "package-customer-zip.ps1",
    "check-image-deps.ps1",
    "check-image-deps.mjs",
    "install-image-deps.ps1",
    "verify-full-image-local.ps1",
    "verify-image-profile.mjs",
    "image-deps-smoke.mjs",
    "generate-image-fixtures.mjs",
    "pilot-stdio.mjs",
    "smoke.mjs",
    "verify.mjs",
    "release-gate.mjs",
    "release-gate-lib.mjs",
    "validate-ci-yaml.mjs"
  )) {
  $src = Join-Path $ProjectRoot "scripts\$s"
  if (Test-Path $src) { Copy-Item $src $scriptsDest -Force }
}

# Copy image fixtures for verify-image-profile
$imagesSrc = Join-Path $ProjectRoot "tests\fixtures\images"
if (Test-Path $imagesSrc) {
  $imagesDest = Join-Path $staging "tests\fixtures\images"
  New-Item -ItemType Directory -Path (Split-Path $imagesDest) -Force | Out-Null
  Copy-Item $imagesSrc $imagesDest -Recurse -Force
}

# Copy examples + docs
foreach ($dir in @("examples", "docs")) {
  $srcDir = Join-Path $ProjectRoot $dir
  if (Test-Path $srcDir) {
    Copy-Item $srcDir (Join-Path $staging $dir) -Recurse -Force
  }
}

# Verify staging has no forbidden items
$forbiddenFound = @()
Get-ChildItem $staging -Recurse -Force | ForEach-Object {
  $rel = $_.FullName.Substring($staging.Length + 1)
  if ($_.PSIsContainer -and ($excludeDirNames -contains $_.Name)) {
    $forbiddenFound += $rel
  } elseif (-not $_.PSIsContainer -and (Test-ForbiddenPath $rel)) {
    $forbiddenFound += $rel
  }
}

if ($forbiddenFound.Count -gt 0) {
  Write-Host "FORBIDDEN files in staging:" -ForegroundColor Red
  $forbiddenFound | ForEach-Object { Write-Host "  $_" }
  exit 1
}

if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force

function Get-Sha256Hex([string]$FilePath) {
  if (Get-Command Get-FileHash -ErrorAction SilentlyContinue) {
    return (Get-FileHash $FilePath -Algorithm SHA256).Hash
  }
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $stream = [System.IO.File]::OpenRead($FilePath)
    try {
      $bytes = $sha.ComputeHash($stream)
      return [BitConverter]::ToString($bytes).Replace("-", "")
    } finally {
      $stream.Close()
    }
  } finally {
    $sha.Dispose()
  }
}

$hashHex = Get-Sha256Hex $zipPath
$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)

Remove-Item $staging -Recurse -Force

Write-Host ""
Write-Host "[PASS] ZIP created: $zipPath" -ForegroundColor Green
Write-Host "       Size: ${sizeMb} MB"
Write-Host "       SHA256: $hashHex"
Write-Host ""
Write-Host "Customer install:" -ForegroundColor Cyan
Write-Host "  1. Unzip to e.g. E:\MCP\local-coding-tools-mcp"
Write-Host "  2. cd <folder> && npm install && npm run build"
Write-Host "  3. powershell -File scripts\install-cursor-mcp.ps1 -EnableAllowlist"
Write-Host "  4. powershell -File scripts\test-mcp-install.ps1"

exit 0
