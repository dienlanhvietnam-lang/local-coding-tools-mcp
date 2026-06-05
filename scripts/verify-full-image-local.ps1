#Requires -Version 5.1
<#
.SYNOPSIS
  Verify full-image profile locally: dependency check first, then image profile tests.
.PARAMETER RequireFullImage
  Fail immediately if full-image dependencies are missing (no heavy image processing).
.PARAMETER Json
  Output JSON summary.

Usage:
  powershell -ExecutionPolicy Bypass -File scripts\verify-full-image-local.ps1 [-RequireFullImage] [-Json]
#>
param(
  [switch]$RequireFullImage,
  [switch]$Json
)

$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$mjs = Join-Path $PSScriptRoot "check-image-deps.mjs"

$results = [ordered]@{}
$overall = "PASS"
$missing = @()

function Set-Result([string]$Name, [string]$Status, [string]$Detail = "") {
  $script:results[$Name] = @{ status = $Status; detail = $Detail }
  if ($Status -eq "FAIL") { $script:overall = "FAIL" }
}

if (-not (Test-Path (Join-Path $root "dist\utils\imageDependencies.js"))) {
  Set-Result "dist built" "FAIL" "run npm run build"
  if ($Json) {
    @{ overall = "FAIL"; results = $results } | ConvertTo-Json -Depth 5
  } else {
    Write-Host "[FAIL] dist not built" -ForegroundColor Red
  }
  exit 2
}

# Step 1: dependency check
$prevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $depRaw = & node $mjs --profile full-image --json 2>&1
} finally {
  $ErrorActionPreference = $prevEap
}
$depText = ($depRaw | Out-String).Trim()
$depJsonStart = $depText.IndexOf("{")
if ($depJsonStart -lt 0) {
  Set-Result "dependency check" "FAIL" "no JSON from check-image-deps.mjs"
  exit 2
}
try {
  $dep = $depText.Substring($depJsonStart) | ConvertFrom-Json
} catch {
  Set-Result "dependency check" "FAIL" "invalid JSON"
  exit 2
}

$depsOk = $dep.removeBackgroundReady -and $dep.aiUpscaleReady
Set-Result "full-image deps" $(if ($depsOk) { "PASS" } else { "FAIL" }) `
  "removeBackground=$($dep.removeBackgroundReady) aiUpscale=$($dep.aiUpscaleReady)"

if (-not $depsOk) {
  $missing = @()
  if (-not $dep.removeBackgroundReady) {
    $missing += "removeBackground (rembg|imgly|REMOVE_BG_API_KEY)"
  }
  if (-not $dep.aiUpscaleReady) {
    $missing += "aiUpscale (realesrgan-ncnn-vulkan|REPLICATE_API_TOKEN)"
  }
  Set-Result "missing dependency" "FAIL" ($missing -join "; ")
}

if ($RequireFullImage -and -not $depsOk) {
  if ($Json) {
    @{
      overall      = "FAIL"
      reason       = "missing required dependency"
      missing      = $missing
      exitCode     = 1
      dependencies = $dep
      results      = $results
    } | ConvertTo-Json -Depth 8
  } else {
    Write-Host "`n=== verify-full-image-local.ps1 ===" -ForegroundColor Cyan
    Write-Host "FAIL — missing required dependency (no image tools run)" -ForegroundColor Red
    Write-Host "Missing: $($missing -join ', ')" -ForegroundColor Yellow
    if ($dep.installHints) {
      $dep.installHints | ForEach-Object { Write-Host "  $_" }
    }
  }
  exit 1
}

if ($depsOk) {
  Push-Location $root
  try {
    Write-Host "Running npm run verify:image-core ..." -ForegroundColor Gray
    npm run verify:image-core
    Set-Result "verify:image-core" $(if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }) "exit $LASTEXITCODE"

    if ($LASTEXITCODE -eq 0) {
      Write-Host "Running verify-image-profile full-image ..." -ForegroundColor Gray
      node (Join-Path $PSScriptRoot "verify-image-profile.mjs") --profile full-image
      Set-Result "verify-image-profile full-image" $(if ($LASTEXITCODE -eq 0) { "PASS" } else { "FAIL" }) "exit $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

if ($Json) {
  @{
    overall = $overall
    depsOk  = $depsOk
    results = $results
    dependencies = @{
      removeBackgroundReady = $dep.removeBackgroundReady
      aiUpscaleReady        = $dep.aiUpscaleReady
      status                = $dep.status
    }
  } | ConvertTo-Json -Depth 8
} else {
  Write-Host "`n=== verify-full-image-local.ps1 ===" -ForegroundColor Cyan
  foreach ($kv in $results.GetEnumerator()) {
    $c = if ($kv.Value.status -eq "PASS") { "Green" } else { "Red" }
    Write-Host "[$($kv.Value.status)] $($kv.Key) $($kv.Value.detail)" -ForegroundColor $c
  }
  Write-Host "`nOVERALL: $overall" -ForegroundColor $(if ($overall -eq "PASS") { "Green" } else { "Red" })
}

exit $(if ($overall -eq "PASS") { 0 } else { 1 })
