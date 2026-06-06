#Requires -Version 5.1
<#
.SYNOPSIS
  Validate MCP server build and optional IDE config files.
#>
param(
  [string]$ServerRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$VscodeWorkspace = "",
  [string]$CursorWorkspace = ""
)

$ErrorActionPreference = "Continue"

trap {
  Write-Host "[FAIL] Unhandled error at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

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
      Write-Host "[START] npm run smoke" -ForegroundColor Gray
      npm run smoke 2>&1 | Out-Host
      $smokeExit = $LASTEXITCODE
      if ($null -eq $smokeExit) { $smokeExit = 0 }
      Add-Check "npm run smoke" ($smokeExit -eq 0) "exit $smokeExit"
      Write-Host "[$(if ($smokeExit -eq 0) { 'PASS' } else { 'FAIL' })] npm run smoke" -ForegroundColor $(if ($smokeExit -eq 0) { 'Green' } else { 'Red' })
    } else {
      Add-Check "npm run smoke" $false "script missing"
    }
    if ($pkg.scripts.verify) {
      Write-Host "[START] npm run verify" -ForegroundColor Gray
      npm run verify 2>&1 | Out-Host
      $verifyExit = $LASTEXITCODE
      if ($null -eq $verifyExit) { $verifyExit = 0 }
      Add-Check "npm run verify" ($verifyExit -eq 0) "exit $verifyExit"
      Write-Host "[$(if ($verifyExit -eq 0) { 'PASS' } else { 'FAIL' })] npm run verify" -ForegroundColor $(if ($verifyExit -eq 0) { 'Green' } else { 'Red' })
    }
  }
} finally {
  Pop-Location
}

# VS Code mcp.json + optional Copilot policy
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

  $agentFile = Join-Path $VscodeWorkspace ".github\agents\DMCTN-MCP.agent.md"
  $instrFile = Join-Path $VscodeWorkspace ".github\copilot-instructions.md"
  if (Test-Path $agentFile) {
    $agentText = Get-Content $agentFile -Raw
    Add-Check "DMCTN-MCP.agent.md exists" $true $agentFile
    Add-Check "agent tools local-coding-tools/*" ($agentText -match 'local-coding-tools/\*')
  }
  if (Test-Path $instrFile) {
    $instrText = Get-Content $instrFile -Raw
    Add-Check "copilot-instructions.md exists" $true $instrFile
    Add-Check "instructions map run_project_script" ($instrText -match 'run_project_script')
  }

  $verifyScript = Join-Path $ServerRoot "scripts\verify-copilot-mcp-policy.mjs"
  if ((Test-Path $agentFile) -and (Test-Path $instrFile) -and (Test-Path $verifyScript)) {
    Write-Host "Running verify-copilot-mcp-policy.mjs..." -ForegroundColor Gray
    node $verifyScript $VscodeWorkspace 2>&1 | Out-Host
    Add-Check "verify-copilot-mcp-policy.mjs" ($LASTEXITCODE -eq 0) "exit $LASTEXITCODE"
  }
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
