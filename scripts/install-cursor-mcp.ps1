#Requires -Version 5.1
<#
.SYNOPSIS
  Install local-coding-tools MCP config for Cursor (.cursor/mcp.json)
#>
param(
  [string]$WorkspaceRoot = (Get-Location).Path,
  [string]$ServerRoot = "E:\MCP\local-coding-tools-mcp",
  [switch]$EnableAllowlist
)

$ErrorActionPreference = "Stop"

function Write-Result([string]$Name, [bool]$Pass, [string]$Detail = "") {
  $status = if ($Pass) { "PASS" } else { "FAIL" }
  $color = if ($Pass) { "Green" } else { "Red" }
  $msg = "[$status] $Name"
  if ($Detail) { $msg += " — $Detail" }
  Write-Host $msg -ForegroundColor $color
  return $Pass
}

Write-Host "`n=== install-cursor-mcp.ps1 ===" -ForegroundColor Cyan
Write-Host "WorkspaceRoot:     $WorkspaceRoot"
Write-Host "ServerRoot:        $ServerRoot"
Write-Host "EnableAllowlist:   $EnableAllowlist"

$allPass = $true

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$allPass = (Write-Result "node available" ($null -ne $nodeCmd)) -and $allPass

$serverJs = Join-Path $ServerRoot "dist\server.js"
$allPass = (Write-Result "dist/server.js exists" (Test-Path $serverJs) $serverJs) -and $allPass

if (-not $allPass) {
  Write-Host "`nINSTALL FAILED" -ForegroundColor Red
  exit 1
}

$serverRootResolved = (Resolve-Path $ServerRoot).Path
$serverJsPath = Join-Path $serverRootResolved "dist\server.js"
$serverJsJson = $serverJsPath -replace '\\', '\\'
$serverRootJson = $serverRootResolved -replace '\\', '\\'

$cursorDir = Join-Path $WorkspaceRoot ".cursor"
$mcpFile = Join-Path $cursorDir "mcp.json"
$permFile = Join-Path $cursorDir "permissions.json"

if (-not (Test-Path $cursorDir)) {
  New-Item -ItemType Directory -Path $cursorDir -Force | Out-Null
}

if (Test-Path $mcpFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  Copy-Item $mcpFile "$mcpFile.bak-$stamp" -Force
  Write-Host "Backed up mcp.json" -ForegroundColor Yellow
}

$mcpJson = @"
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "node",
      "args": [
        "$serverJsJson"
      ],
      "cwd": "$serverRootJson"
    }
  }
}
"@

Set-Content -Path $mcpFile -Value $mcpJson -Encoding UTF8
$allPass = (Write-Result "write .cursor/mcp.json" (Test-Path $mcpFile) $mcpFile) -and $allPass

try {
  $null = Get-Content $mcpFile -Raw | ConvertFrom-Json
  $allPass = (Write-Result "mcp.json valid JSON" $true) -and $allPass
} catch {
  $allPass = (Write-Result "mcp.json valid JSON" $false $_.Exception.Message) -and $allPass
}

if ($EnableAllowlist) {
  if (Test-Path $permFile) {
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    Copy-Item $permFile "$permFile.bak-$stamp" -Force
    Write-Host "Backed up permissions.json" -ForegroundColor Yellow
  }
  $permJson = @"
{
  "mcpAllowlist": [
    "local-coding-tools:*"
  ]
}
"@
  Set-Content -Path $permFile -Value $permJson -Encoding UTF8
  $allPass = (Write-Result "write .cursor/permissions.json (allowlist)" (Test-Path $permFile)) -and $allPass
  Write-Host "Allowlist enabled. Set Run Mode = Allowlist in Cursor Settings." -ForegroundColor Yellow
} else {
  Write-Result "permissions.json skipped" $true "use -EnableAllowlist to auto-approve MCP tools"
}

Write-Host ""
Write-Host "WARNING: Do NOT use Run Everything unless you fully trust this MCP server." -ForegroundColor Yellow
Write-Host "Recommended: Settings -> Agent -> Run Mode -> Allowlist (with -EnableAllowlist)" -ForegroundColor Yellow

if ($allPass) {
  Write-Host "`nINSTALL PASS — Reload Cursor window." -ForegroundColor Green
  exit 0
}

Write-Host "`nINSTALL FAIL" -ForegroundColor Red
exit 1
