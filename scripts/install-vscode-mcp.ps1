#Requires -Version 5.1
<#
.SYNOPSIS
  Install local-coding-tools MCP config for VS Code / Copilot (.vscode/mcp.json)
#>
param(
  [string]$WorkspaceRoot = (Get-Location).Path,
  [string]$ServerRoot = "E:\MCP\local-coding-tools-mcp"
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

Write-Host "`n=== install-vscode-mcp.ps1 ===" -ForegroundColor Cyan
Write-Host "WorkspaceRoot: $WorkspaceRoot"
Write-Host "ServerRoot:    $ServerRoot"

$allPass = $true

# Node check
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
$allPass = (Write-Result "node available" ($null -ne $nodeCmd) $(if ($nodeCmd) { $nodeCmd.Source } else { "node not in PATH" })) -and $allPass

# Server build check
$serverJs = Join-Path $ServerRoot "dist\server.js"
$serverExists = Test-Path $serverJs
$allPass = (Write-Result "dist/server.js exists" $serverExists $serverJs) -and $allPass

if (-not $allPass) {
  Write-Host "`nINSTALL FAILED — fix errors above (run: npm run build in ServerRoot)" -ForegroundColor Red
  exit 1
}

# Resolve paths for JSON (escape backslashes)
$serverRootResolved = (Resolve-Path $ServerRoot).Path
$serverJsPath = Join-Path $serverRootResolved "dist\server.js"
$serverJsJson = $serverJsPath -replace '\\', '\\'
$serverRootJson = $serverRootResolved -replace '\\', '\\'

$vscodeDir = Join-Path $WorkspaceRoot ".vscode"
$mcpFile = Join-Path $vscodeDir "mcp.json"

if (-not (Test-Path $vscodeDir)) {
  New-Item -ItemType Directory -Path $vscodeDir -Force | Out-Null
}

if (Test-Path $mcpFile) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $bak = "$mcpFile.bak-$stamp"
  Copy-Item $mcpFile $bak -Force
  Write-Host "Backed up existing mcp.json -> $(Split-Path $bak -Leaf)" -ForegroundColor Yellow
}

$mcpJson = @"
{
  "servers": {
    "local-coding-tools": {
      "type": "stdio",
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
$allPass = (Write-Result "write .vscode/mcp.json" (Test-Path $mcpFile) $mcpFile) -and $allPass

# Validate JSON
try {
  $null = Get-Content $mcpFile -Raw | ConvertFrom-Json
  $allPass = (Write-Result "mcp.json valid JSON" $true) -and $allPass
} catch {
  $allPass = (Write-Result "mcp.json valid JSON" $false $_.Exception.Message) -and $allPass
}

$allPass = (Write-Result ".cursor not modified by this script" $true "VS Code only — use install-cursor-mcp.ps1 for Cursor") -and $allPass

if ($allPass) {
  Write-Host "`nINSTALL PASS — Reload VS Code, then check Copilot MCP tools." -ForegroundColor Green
  exit 0
}

Write-Host "`nINSTALL FAIL" -ForegroundColor Red
exit 1
