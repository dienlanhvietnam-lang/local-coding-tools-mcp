#Requires -Version 5.1
<#
.SYNOPSIS
  Phase 1.0 — Full customer release pipeline: build, test, package, SHA256, ZIP audit.
#>
param(
  [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"

function Add-Step([string]$Name, [bool]$Pass, [string]$Detail = "") {
  $script:steps += [PSCustomObject]@{
    Step   = $Name
    Status = if ($Pass) { "PASS" } else { "FAIL" }
    Detail = $Detail
  }
  if (-not $Pass) { $script:allPass = $false }
}

function Invoke-NpmStep([string]$Name, [string]$NpmArgs) {
  Write-Host "`n>> $Name ($NpmArgs)" -ForegroundColor Cyan
  Push-Location $ProjectRoot
  try {
    npm $NpmArgs.Split(' ')
    Add-Step $Name ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"
  } finally {
    Pop-Location
  }
}

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

function Test-ZipForbidden([string]$ZipPath) {
  $bytes = [System.IO.File]::ReadAllBytes($ZipPath)
  $text = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)
  $patterns = @(
    @{ Name = "node_modules"; Regex = "node_modules" },
    @{ Name = "logs/"; Regex = "[/\\]logs[/\\]" },
    @{ Name = ".mcp-debug"; Regex = "\.mcp-debug" },
    @{ Name = ".git/"; Regex = "[/\\]\.git[/\\]" },
    @{ Name = ".env"; Regex = "[/\\][^/\\]*\.env($|\.)" },
    @{ Name = "credentials/"; Regex = "[/\\]credentials[/\\]" },
    @{ Name = "credentials.*"; Regex = "[/\\]credentials\.(json|txt|pem)" },
    @{ Name = "token.*"; Regex = "[/\\]token\.(json|txt|key|pem)" },
    @{ Name = "secrets/"; Regex = "[/\\]secrets?[/\\]" },
    @{ Name = "secret.*"; Regex = "[/\\]secret\.(json|txt|key|pem)" }
  )
  $found = @()
  foreach ($p in $patterns) {
    if ([regex]::IsMatch($text, $p.Regex)) { $found += $p.Name }
  }
  return $found
}

$steps = @()
$allPass = $true

Write-Host "`n=== release-customer-pack.ps1 ===" -ForegroundColor Cyan
Write-Host "ProjectRoot: $ProjectRoot"

# Version from package.json
$pkgPath = Join-Path $ProjectRoot "package.json"
$pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
$version = $pkg.version
Add-Step "read package.json version" $true $version

$releaseDir = Join-Path $ProjectRoot "release"
if (-not (Test-Path $releaseDir)) {
  New-Item -ItemType Directory -Path $releaseDir -Force | Out-Null
}

# Pipeline
Invoke-NpmStep "npm run build" "run build"
Invoke-NpmStep "npm test" "test"
Invoke-NpmStep "npm run smoke" "run smoke"
Invoke-NpmStep "npm run verify" "run verify"

Write-Host "`n>> package-customer-zip.ps1" -ForegroundColor Cyan
& (Join-Path $ProjectRoot "scripts\package-customer-zip.ps1") -ProjectRoot $ProjectRoot -Version $version
Add-Step "package-customer-zip.ps1" ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"

$zipName = "local-coding-tools-mcp-v$version-customer.zip"
$zipPath = Join-Path $releaseDir $zipName
$zipExists = Test-Path $zipPath
Add-Step "customer ZIP exists" $zipExists $zipPath

if ($zipExists) {
  $hashHex = Get-Sha256Hex $zipPath
  $hashLine = "$hashHex  $zipName"
  $sumsPath = Join-Path $releaseDir "SHA256SUMS.txt"
  @(
    "# local-coding-tools-mcp customer pack checksums",
    "# Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "# Version: $version",
    $hashLine,
    ""
  ) | Set-Content -Path $sumsPath -Encoding UTF8
  Add-Step "SHA256SUMS.txt created" (Test-Path $sumsPath) $sumsPath
  Add-Step "SHA256 recorded" $true $hashHex

  $forbidden = Test-ZipForbidden $zipPath
  $zipClean = ($forbidden.Count -eq 0)
  Add-Step "ZIP forbidden scan" $zipClean $(if ($zipClean) { "clean" } else { ($forbidden -join ", ") })
} else {
  Add-Step "SHA256SUMS.txt created" $false "ZIP missing"
  Add-Step "ZIP forbidden scan" $false "ZIP missing"
}

Write-Host "`n--- RELEASE SUMMARY ---" -ForegroundColor Cyan
$steps | Format-Table -AutoSize

if ($allPass) {
  Write-Host "OVERALL: PASS" -ForegroundColor Green
  Write-Host "ZIP:     $zipPath"
  if ($zipExists) {
    Write-Host "SHA256:  $hashHex"
    Write-Host "SUMS:    $(Join-Path $releaseDir 'SHA256SUMS.txt')"
  }
  exit 0
}

Write-Host "OVERALL: FAIL" -ForegroundColor Red
exit 1
