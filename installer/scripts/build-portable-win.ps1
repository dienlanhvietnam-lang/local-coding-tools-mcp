# Build portable zip for winget / offline install
param(
  [string]$Version = "0.7.0"
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$OutDir = Join-Path $Root "dist-portable"
$ZipName = "local-coding-tools-mcp-$Version-win-x64.zip"

Push-Location $Root
try {
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build failed" }

  if (Test-Path $OutDir) { Remove-Item $OutDir -Recurse -Force }
  New-Item -ItemType Directory -Path $OutDir | Out-Null

  Copy-Item -Recurse (Join-Path $Root "dist") (Join-Path $OutDir "dist")
  Copy-Item (Join-Path $Root "package.json") $OutDir
  Copy-Item (Join-Path $Root "LICENSE") $OutDir
  Copy-Item (Join-Path $Root "README.md") $OutDir

  @"
@echo off
node "%~dp0dist\server.js" %*
"@ | Set-Content (Join-Path $OutDir "local-coding-tools-mcp.cmd") -Encoding ASCII

  $ZipPath = Join-Path $Root $ZipName
  if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
  Compress-Archive -Path (Join-Path $OutDir "*") -DestinationPath $ZipPath

  $hash = Get-FileHash $ZipPath -Algorithm SHA256
  Write-Host "Created: $ZipPath" -ForegroundColor Green
  Write-Host "SHA256: $($hash.Hash)" -ForegroundColor Yellow
  Write-Host "Update installer/winget/DevGOL.LocalCodingToolsMcp.yaml InstallerSha256" -ForegroundColor Cyan
} finally {
  Pop-Location
}
