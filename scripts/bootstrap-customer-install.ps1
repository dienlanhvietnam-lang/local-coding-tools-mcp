#Requires -Version 5.1
<#
.SYNOPSIS
  Interactive customer bootstrap: choose IDE target and install MCP (+ optional DMCTN-MCP policy).
#>
param(
  [string]$ServerRoot = (Split-Path $PSScriptRoot -Parent),
  [string]$WorkspaceRoot = (Get-Location).Path,
  [ValidateSet("vscode", "cursor", "")]
  [string]$Target = "",
  [switch]$Yes
)

$ErrorActionPreference = "Stop"

trap {
  Write-Host "[FAIL] Unhandled error at line $($_.InvocationInfo.ScriptLineNumber): $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host "`n=== bootstrap-customer-install.ps1 ===" -ForegroundColor Cyan
Write-Host "ServerRoot:    $ServerRoot"
Write-Host "WorkspaceRoot: $WorkspaceRoot"

if (-not $Target) {
  Write-Host ""
  Write-Host "Chọn IDE target:"
  Write-Host "  1) vscode  — VS Code + Copilot"
  Write-Host "  2) cursor  — Cursor IDE"
  $choice = Read-Host "Nhập 1 hoặc 2 (mặc định 1)"
  if ($choice -eq "2") { $Target = "cursor" } else { $Target = "vscode" }
}

$installAgent = $false
if ($Target -eq "vscode") {
  if ($Yes) {
    $installAgent = $true
    Write-Host "Cài DMCTN-MCP Custom Agent: Yes (-Yes)" -ForegroundColor Gray
  } else {
    $ans = Read-Host "Cài DMCTN-MCP Custom Agent để ép Copilot dùng MCP? [Y/n]"
    $installAgent = ($ans -eq "" -or $ans -match '^[Yy]')
  }
}

if ($Target -eq "vscode") {
  $args = @(
    "-ExecutionPolicy", "Bypass",
    "-File", (Join-Path $ServerRoot "scripts\install-vscode-mcp.ps1"),
    "-WorkspaceRoot", $WorkspaceRoot,
    "-ServerRoot", $ServerRoot,
    "-Yes"
  )
  if ($installAgent) {
    $args += "-InstallCopilotAgent", "-ForceMcpPolicy", "-BackupExistingAgent"
  }
  & powershell.exe -NoProfile @args
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  if ($installAgent -and $code -eq 0) {
    Write-Host ""
    Write-Host "Sau khi cài DMCTN-MCP policy:" -ForegroundColor Cyan
    Write-Host "  1. Reload VS Code"
    Write-Host "  2. Mở Copilot Chat"
    Write-Host "  3. Chọn Agent: DMCTN-MCP"
    Write-Host "  4. Chạy prompt test: Gọi check_system qua MCP local-coding-tools"
  }
  exit $code
}

if ($Target -eq "cursor") {
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $ServerRoot "scripts\install-cursor-mcp.ps1") `
    -WorkspaceRoot $WorkspaceRoot -ServerRoot $ServerRoot
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  exit $code
}

Write-Host "Unknown target: $Target" -ForegroundColor Red
exit 1
