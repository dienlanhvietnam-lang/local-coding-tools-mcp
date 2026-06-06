#Requires -Version 5.1
<#
.SYNOPSIS
  Verify MCP + PowerShell runtime stability (no internet required).
#>
param(
  [string]$ServerRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$WorkspaceRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent)
)

$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FAIL] verify-mcp-powershell-runtime at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

$results = @()
function Add-Result([string]$Name, [bool]$Pass, [string]$Detail = "") {
  $script:results += [PSCustomObject]@{
    Check  = $Name
    Status = if ($Pass) { "PASS" } else { "FAIL" }
    Detail = $Detail
  }
  $color = if ($Pass) { "Green" } else { "Red" }
  $detailSuffix = if ($Detail) { " - $Detail" } else { "" }
  Write-Host "[$(if ($Pass){'PASS'}else{'FAIL'})] $Name$detailSuffix" -ForegroundColor $color
}

Write-Host "`n=== verify-mcp-powershell-runtime.ps1 ===" -ForegroundColor Cyan
Write-Host "ServerRoot:    $ServerRoot"
Write-Host "WorkspaceRoot: $WorkspaceRoot"

# Phase 1: Node + build artifacts
Write-Host "`n[PHASE] node + build" -ForegroundColor Cyan
$node = Get-Command node -ErrorAction SilentlyContinue
Add-Result "node in PATH" ($null -ne $node) $(if ($node) { & node --version } else { "missing" })
Add-Result "dist/server.js" (Test-Path (Join-Path $ServerRoot "dist\server.js"))

Push-Location $ServerRoot
try {
  if (Test-Path "package.json") {
    Write-Host "[START] npm run build"
    npm run build 2>&1 | Out-Host
    $buildExit = $LASTEXITCODE
    if ($null -eq $buildExit) { $buildExit = 0 }
    Add-Result "npm run build" ($buildExit -eq 0) "exit $buildExit"
  }
} finally {
  Pop-Location
}

# Phase 2: PowerShell direct smoke
Write-Host "`n[PHASE] powershell direct" -ForegroundColor Cyan
$heartbeatScript = Join-Path $ServerRoot "scripts\long-command-heartbeat.ps1"
Write-Host "[START] long-command-heartbeat.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $heartbeatScript -Seconds 24 -IntervalSec 2
$hbExit = $LASTEXITCODE
if ($null -eq $hbExit) { $hbExit = 0 }
Add-Result "long-command heartbeat (direct)" ($hbExit -eq 0) "exit $hbExit"

# Phase 3: Node powershell-runner smoke
Write-Host "`n[PHASE] node powershell-runner" -ForegroundColor Cyan
$runnerTest = @"
import { runPowerShellScript } from './powershell-runner.mjs';
const r = await runPowerShellScript('scripts/long-command-heartbeat.ps1', ['-Seconds','20','-IntervalSec','2'], { cwd: process.cwd(), timeoutMs: 0 });
console.log(JSON.stringify({ ok: r.ok, exitCode: r.exitCode, durationMs: r.durationMs, logPath: r.logPath }));
process.exit(r.ok ? 0 : 1);
"@
$runnerTestPath = Join-Path $ServerRoot "scripts\.runner-heartbeat-test.mjs"
Set-Content -Path $runnerTestPath -Value $runnerTest -Encoding UTF8
Push-Location $ServerRoot
try {
  Write-Host "[START] node .runner-heartbeat-test.mjs"
  node $runnerTestPath 2>&1 | Out-Host
  $runnerExit = $LASTEXITCODE
  if ($null -eq $runnerExit) { $runnerExit = 0 }
  Add-Result "powershell-runner heartbeat" ($runnerExit -eq 0) "exit $runnerExit"
} finally {
  Pop-Location
  Remove-Item $runnerTestPath -Force -ErrorAction SilentlyContinue
}

# Phase 4: MCP stdio smoke
Write-Host "`n[PHASE] MCP stdio smoke" -ForegroundColor Cyan
if (Test-Path (Join-Path $ServerRoot "scripts\pilot-stdio.mjs")) {
  Write-Host "[START] node scripts/pilot-stdio.mjs"
  Push-Location $ServerRoot
  try {
    node scripts\pilot-stdio.mjs $ServerRoot 2>&1 | Out-Host
    $pilotExit = $LASTEXITCODE
    if ($null -eq $pilotExit) { $pilotExit = 0 }
    Add-Result "pilot-stdio.mjs" ($pilotExit -eq 0) "exit $pilotExit"
  } finally {
    Pop-Location
  }
}

# Phase 5: install script smoke (dry)
Write-Host "`n[PHASE] install-vscode-mcp smoke" -ForegroundColor Cyan
$installScript = Join-Path $ServerRoot "scripts\install-vscode-mcp.ps1"
if (Test-Path $installScript) {
  Write-Host "[START] install-vscode-mcp.ps1 -Yes"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installScript `
    -WorkspaceRoot $WorkspaceRoot -ServerRoot $ServerRoot -Yes
  $installExit = $LASTEXITCODE
  if ($null -eq $installExit) { $installExit = 0 }
  Add-Result "install-vscode-mcp.ps1" ($installExit -eq 0) "exit $installExit"
  $mcpJson = Join-Path $WorkspaceRoot ".vscode\mcp.json"
  Add-Result ".vscode/mcp.json exists" (Test-Path $mcpJson) $mcpJson
}

# Phase 6: runtime log file
Write-Host "`n[PHASE] runtime log" -ForegroundColor Cyan
$logPath = Join-Path $WorkspaceRoot ".dmctn\runtime\mcp-powershell-runner.log"
Add-Result "runtime log file" (Test-Path $logPath) $logPath

# Phase 7: exec hardening + tests
Write-Host "`n[PHASE] npm test subset" -ForegroundColor Cyan
Push-Location $ServerRoot
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  if (Test-Path "node_modules") {
    $vitestCli = Join-Path $ServerRoot "node_modules\vitest\vitest.mjs"
    $nodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $nodeExe) { $nodeExe = "node.exe" }
    Write-Host "[START] node vitest.mjs (exec-hardening + mcp-smoke)"
    # Avoid npx.ps1 shim (UTF-8 BOM corruption causes 'ào' parse error in PowerShell)
    & $nodeExe $vitestCli run tests/exec-hardening.test.ts tests/mcp-smoke.test.ts 2>&1 | Out-Host
    $testExit = $LASTEXITCODE
    if ($null -eq $testExit) { $testExit = 0 }
    Add-Result "vitest exec-hardening + mcp-smoke" ($testExit -eq 0) "exit $testExit"
  } else {
    Add-Result "vitest (skipped)" $true "node_modules missing - build-only verify"
  }
} finally {
  $ErrorActionPreference = $prevEap
  Pop-Location
}

Write-Host "`n--- Summary ---"
$results | Format-Table -AutoSize
$failed = @($results | Where-Object { $_.Status -eq "FAIL" })
if ($failed.Count -eq 0) {
  Write-Host "OVERALL: PASS ($($results.Count) checks)" -ForegroundColor Green
  exit 0
}
Write-Host "OVERALL: FAIL ($($failed.Count)/$($results.Count))" -ForegroundColor Red
exit 1
