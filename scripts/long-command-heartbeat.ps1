#Requires -Version 5.1
<#
.SYNOPSIS
  Long-running smoke: prints heartbeat every 2s for ~24s.
#>
param(
  [int]$Seconds = 24,
  [int]$IntervalSec = 2
)

$ErrorActionPreference = "Stop"

try {
  Write-Host "[START] long-command-heartbeat Seconds=$Seconds IntervalSec=$IntervalSec"
  $elapsed = 0
  while ($elapsed -lt $Seconds) {
    Start-Sleep -Seconds $IntervalSec
    $elapsed += $IntervalSec
    Write-Host "[HEARTBEAT] elapsed=${elapsed}s / ${Seconds}s"
  }
  Write-Host "[PASS] long-command-heartbeat completed"
  exit 0
} catch {
  Write-Host "[FAIL] $($_.Exception.Message) at line $($_.InvocationInfo.ScriptLineNumber)" -ForegroundColor Red
  exit 1
}
