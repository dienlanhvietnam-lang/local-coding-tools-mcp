#Requires -Version 5.1
<#
.SYNOPSIS
  Validate MCP server build and optional IDE config files.
#>
param(
  [string]$ServerRoot = "E:\MCP\local-coding-tools-mcp",
  [string]$VscodeWorkspace = "",
  [string]$CursorWorkspace = ""
)

$ErrorActionPreference = "Continue"

$results = @()

function Add-Check([string]$Name, [bool]$Pass, [string]$Detail = "") {
  $script:results += [PSCustomObject]@{
    Check  = $Name
    Status = if ($Pass) { "PASS" } else { "FAIL" }
    Detail = $Detail
  }
}

Write-Host "`n=== test-mcp-install.ps1 ===" -ForegroundColor Cyan
Write-Host "ServerRoot: $ServerRoot`n"

# Node
$node = Get-Command node -ErrorAction SilentlyContinue
Add-Check "node in PATH" ($null -ne $node) $(if ($node) { & node --version } else { "not found" })

# dist/server.js
$serverJs = Join-Path $ServerRoot "dist\server.js"
Add-Check "dist/server.js" (Test-Path $serverJs) $serverJs

# npm smoke
Push-Location $ServerRoot
try {
  if (Test-Path (Join-Path $ServerRoot "package.json")) {
    $pkg = Get-Content (Join-Path $ServerRoot "package.json") -Raw | ConvertFrom-Json
    if ($pkg.scripts.smoke) {
      Write-Host "Running npm run smoke..." -ForegroundColor Gray
      npm run smoke 2>&1 | Out-Host
      Add-Check "npm run smoke" ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"
    } else {
      Add-Check "npm run smoke" $false "script missing"
    }
    if ($pkg.scripts.verify) {
      Write-Host "Running npm run verify..." -ForegroundColor Gray
      npm run verify 2>&1 | Out-Host
      Add-Check "npm run verify" ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"
    }
  }
} finally {
  Pop-Location
}

# VS Code mcp.json
if ($VscodeWorkspace) {
  $vf = Join-Path $VscodeWorkspace ".vscode\mcp.json"
  $exists = Test-Path $vf
  $valid = $false
  $hasServer = $false
  if ($exists) {
    try {
      $j = Get-Content $vf -Raw | ConvertFrom-Json
      $valid = $true
      $hasServer = $null -ne $j.servers."local-coding-tools"
    } catch { }
  }
  Add-Check "VS Code .vscode/mcp.json exists" $exists $vf
  Add-Check "VS Code mcp.json valid + server key" ($valid -and $hasServer)
}

# Cursor mcp.json
if ($CursorWorkspace) {
  $cf = Join-Path $CursorWorkspace ".cursor\mcp.json"
  $exists = Test-Path $cf
  $valid = $false
  $hasServer = $false
  if ($exists) {
    try {
      $j = Get-Content $cf -Raw | ConvertFrom-Json
      $valid = $true
      $hasServer = $null -ne $j.mcpServers."local-coding-tools"
    } catch { }
  }
  Add-Check "Cursor .cursor/mcp.json exists" $exists $cf
  Add-Check "Cursor mcp.json valid + server key" ($valid -and $hasServer)
}

Write-Host ""
$results | Format-Table -AutoSize

$failed = @($results | Where-Object { $_.Status -eq "FAIL" })
if ($failed.Count -eq 0) {
  Write-Host "OVERALL: PASS ($($results.Count) checks)" -ForegroundColor Green
  exit 0
}

Write-Host "OVERALL: FAIL ($($failed.Count)/$($results.Count) checks failed)" -ForegroundColor Red
exit 1
