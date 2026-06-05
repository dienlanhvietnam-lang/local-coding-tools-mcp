#Requires -Version 5.1
<#
.SYNOPSIS
  Check image toolchain dependencies by profile (coding | image-core | full-image).
.PARAMETER Json
  Output JSON only (for CI).
#>
param(
  [ValidateSet("coding", "image-core", "full-image")]
  [string]$Profile = "image-core",
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$mjs = Join-Path $PSScriptRoot "check-image-deps.mjs"

function Fail-Internal([string]$Msg) {
  if ($Json) {
    @{ profile = $Profile; error = $Msg; exitCode = 2 } | ConvertTo-Json -Depth 5 | Write-Output
  } else {
    Write-Host "[FAIL] $Msg" -ForegroundColor Red
  }
  exit 2
}

if (-not (Test-Path (Join-Path $root "dist\utils\imageDependencies.js"))) {
  Fail-Internal "dist not built — run: npm run build"
}

$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $nodeOut = & node $mjs --profile $Profile --json 2>&1
} finally {
  $ErrorActionPreference = $prevEap
}

$text = ($nodeOut | Out-String).Trim()
if (-not $text) {
  Fail-Internal "check-image-deps.mjs produced no output"
}

$jsonStart = $text.IndexOf("{")
if ($jsonStart -lt 0) {
  Fail-Internal "check-image-deps.mjs produced no JSON"
}

try {
  $report = $text.Substring($jsonStart) | ConvertFrom-Json
} catch {
  Fail-Internal "Invalid JSON from check-image-deps.mjs: $($_.Exception.Message)"
}

if ($report.error) {
  Fail-Internal $report.error
}

if ($Json) {
  $report | ConvertTo-Json -Depth 8
  exit [int]$report.exitCode
}

Write-Host "`n=== check-image-deps.ps1 ===" -ForegroundColor Cyan
Write-Host "Profile: $Profile"
Write-Host "Overall: $($report.status) (exit $($report.exitCode))`n"

$table = @()
foreach ($c in $report.components) {
  $color = switch ($c.status) {
    "READY" { "Green" }
    "CONFIGURED" { "Green" }
    "MISSING" { if ($Profile -eq "full-image") { "Red" } else { "Yellow" } }
    "FAIL" { "Red" }
    default { "White" }
  }
  $table += [PSCustomObject]@{
    Component = $c.component
    Status    = $c.status
    Detail    = $c.detail
    Fix       = $c.fix
  }
}

$table | Format-Table -AutoSize -Wrap

Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "  coreImageReady:         $($report.coreImageReady)"
Write-Host "  removeBackgroundReady:  $($report.removeBackgroundReady)"
Write-Host "  aiUpscaleReady:         $($report.aiUpscaleReady)"

if ($report.installHints -and $report.installHints.Count -gt 0) {
  Write-Host "`nInstall hints:" -ForegroundColor Yellow
  $report.installHints | ForEach-Object { Write-Host "  $_" }
}

if ([int]$report.exitCode -eq 0) {
  Write-Host "`nOVERALL: PASS (profile $Profile)" -ForegroundColor Green
} else {
  Write-Host "`nOVERALL: FAIL (exit $($report.exitCode))" -ForegroundColor Red
}

exit [int]$report.exitCode
