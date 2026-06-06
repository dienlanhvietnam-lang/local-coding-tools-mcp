#Requires -Version 5.1
<#
.SYNOPSIS
  Install local-coding-tools MCP config for VS Code / Copilot (.vscode/mcp.json)
  and optional DMCTN-MCP custom agent + copilot-instructions policy files.
#>
param(
  [string]$WorkspaceRoot = (Get-Location).Path,
  [string]$ServerRoot = (Split-Path $PSScriptRoot -Parent),
  [switch]$InstallCopilotAgent,
  [switch]$ForceMcpPolicy,
  [switch]$BackupExistingAgent,
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FAIL] Unhandled error at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

function Write-Result([string]$Name, [bool]$Pass, [string]$Detail = "") {
  $status = if ($Pass) { "PASS" } else { "FAIL" }
  $color = if ($Pass) { "Green" } else { "Red" }
  $msg = "[$status] $Name"
  if ($Detail) { $msg += " — $Detail" }
  Write-Host $msg -ForegroundColor $color
  return $Pass
}

function Write-Utf8NoBom([string]$FilePath, [string]$Content) {
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($FilePath, $Content, $utf8)
}

function Backup-IfExists([string]$FilePath, [bool]$DoBackup) {
  if (-not (Test-Path $FilePath)) { return $false }
  if (-not $DoBackup) {
    Write-Host "File exists (no backup): $(Split-Path $FilePath -Leaf)" -ForegroundColor Yellow
    return $true
  }
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $bak = "$FilePath.bak-$stamp"
  Copy-Item $FilePath $bak -Force
  Write-Host "Backed up -> $(Split-Path $bak -Leaf)" -ForegroundColor Yellow
  return $true
}

function Install-PolicyFile([string]$DestPath, [string]$TemplatePath, [bool]$DoBackup) {
  $dir = Split-Path $DestPath -Parent
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  if (-not (Test-Path $TemplatePath)) {
    Write-Result "template exists: $(Split-Path $TemplatePath -Leaf)" $false $TemplatePath | Out-Null
    return $false
  }
  $hadExisting = Backup-IfExists $DestPath $DoBackup
  if ($hadExisting -and -not $Yes -and -not $DoBackup) {
    Write-Host "Skipped overwrite (use -Yes or -BackupExistingAgent): $DestPath" -ForegroundColor Yellow
    return (Test-Path $DestPath)
  }
  Copy-Item $TemplatePath $DestPath -Force
  return (Test-Path $DestPath)
}

$installPolicy = $InstallCopilotAgent -or $ForceMcpPolicy
$doAgentBackup = $BackupExistingAgent -or (-not $PSBoundParameters.ContainsKey('BackupExistingAgent'))

Write-Host "`n=== install-vscode-mcp.ps1 ===" -ForegroundColor Cyan
Write-Host "WorkspaceRoot:        $WorkspaceRoot"
Write-Host "ServerRoot:           $ServerRoot"
Write-Host "InstallCopilotAgent:  $InstallCopilotAgent"
Write-Host "ForceMcpPolicy:       $ForceMcpPolicy"
Write-Host "BackupExistingAgent:  $doAgentBackup"
Write-Host "Yes:                  $Yes"

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

Backup-IfExists $mcpFile $true | Out-Null

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

Write-Utf8NoBom $mcpFile $mcpJson
$allPass = (Write-Result "write .vscode/mcp.json" (Test-Path $mcpFile) $mcpFile) -and $allPass

# Validate JSON
try {
  $null = Get-Content $mcpFile -Raw | ConvertFrom-Json
  $allPass = (Write-Result "mcp.json valid JSON" $true) -and $allPass
} catch {
  $allPass = (Write-Result "mcp.json valid JSON" $false $_.Exception.Message) -and $allPass
}

if ($installPolicy) {
  $agentDest = Join-Path $WorkspaceRoot ".github\agents\DMCTN-MCP.agent.md"
  $instrDest = Join-Path $WorkspaceRoot ".github\copilot-instructions.md"
  $agentTpl = Join-Path $ServerRoot "templates\copilot\DMCTN-MCP.agent.md"
  $instrTpl = Join-Path $ServerRoot "templates\copilot\copilot-instructions.md"

  $agentOk = Install-PolicyFile $agentDest $agentTpl $doAgentBackup
  $allPass = (Write-Result "write .github/agents/DMCTN-MCP.agent.md" $agentOk $agentDest) -and $allPass

  $instrOk = Install-PolicyFile $instrDest $instrTpl $doAgentBackup
  $allPass = (Write-Result "write .github/copilot-instructions.md" $instrOk $instrDest) -and $allPass

  if ($ForceMcpPolicy) {
    $agentText = if (Test-Path $agentDest) { Get-Content $agentDest -Raw } else { "" }
    $hasTools = $agentText -match 'local-coding-tools/\*'
    $allPass = (Write-Result "agent tools local-coding-tools/*" $hasTools) -and $allPass
  }
}

$allPass = (Write-Result ".cursor not modified by this script" $true "VS Code only — use install-cursor-mcp.ps1 for Cursor") -and $allPass

if ($allPass) {
  Write-Host "`nINSTALL PASS — Reload VS Code, then check Copilot MCP tools." -ForegroundColor Green
  if ($installPolicy) {
    Write-Host ""
    Write-Host "DMCTN-MCP policy installed:" -ForegroundColor Cyan
    Write-Host "  1. Reload VS Code (Developer: Reload Window)"
    Write-Host "  2. Open Copilot Chat"
    Write-Host "  3. Select Agent: DMCTN-MCP"
    Write-Host "  4. Test: Gọi check_system qua MCP local-coding-tools"
    Write-Host ""
    Write-Host "Verify: node scripts\verify-copilot-mcp-policy.mjs `"$WorkspaceRoot`""
  }
  exit 0
}

Write-Host "`nINSTALL FAIL" -ForegroundColor Red
exit 1
