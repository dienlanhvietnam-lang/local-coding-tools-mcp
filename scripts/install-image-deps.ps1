#Requires -Version 5.1
<#
.SYNOPSIS
  Install or check optional full-image dependencies (rembg, Replicate hint, Real-ESRGAN PATH).
.PARAMETER CheckOnly
  Only check current state — no pip install.
.PARAMETER Yes
  Skip confirmation for pip install rembg.
#>
param(
  [switch]$InstallRembg,
  [switch]$UseReplicate,
  [switch]$InstallRealEsrgan,
  [switch]$FullImage,
  [switch]$CheckOnly,
  [switch]$Yes
)

$ErrorActionPreference = "Continue"
$root = Split-Path $PSScriptRoot -Parent
$checkScript = Join-Path $PSScriptRoot "check-image-deps.ps1"

function Write-Step([string]$Name, [string]$Status, [string]$Detail = "") {
  $color = switch ($Status) {
    "PASS" { "Green" }
    "FAIL" { "Red" }
    "SKIP" { "Yellow" }
    default { "White" }
  }
  $msg = "[$Status] $Name"
  if ($Detail) { $msg += " — $Detail" }
  Write-Host $msg -ForegroundColor $color
}

Write-Host "`n=== install-image-deps.ps1 ===" -ForegroundColor Cyan
if ($CheckOnly) {
  Write-Host "Mode: CheckOnly (no installs)" -ForegroundColor Gray
}

$anyAction = $InstallRembg -or $UseReplicate -or $InstallRealEsrgan -or $FullImage
if (-not $anyAction -and -not $CheckOnly) {
  Write-Host @"

Usage:
  -InstallRembg       pip install rembg (needs Python/pip)
  -UseReplicate       show setx REPLICATE_API_TOKEN instructions
  -InstallRealEsrgan  detect realesrgan-ncnn-vulkan on PATH + manual guide
  -FullImage          post-check with check-image-deps -Profile full-image
  -CheckOnly          check only, no install
  -Yes                skip pip install confirmation

Examples:
  powershell -File scripts\install-image-deps.ps1 -CheckOnly
  powershell -File scripts\install-image-deps.ps1 -InstallRembg -Yes
  powershell -File scripts\install-image-deps.ps1 -InstallRembg -FullImage -Yes

"@
  & $checkScript -Profile image-core
  exit $LASTEXITCODE
}

if ($CheckOnly -or (-not $InstallRembg -and -not $UseReplicate -and -not $InstallRealEsrgan -and -not $FullImage)) {
  & $checkScript -Profile $(if ($FullImage) { "full-image" } else { "image-core" })
  exit $LASTEXITCODE
}

$hadFail = $false

if ($InstallRembg) {
  Write-Host "`n[rembg]" -ForegroundColor Cyan
  $py = Get-Command python -ErrorAction SilentlyContinue
  if (-not $py) {
    Write-Step "python" "FAIL" "Not found — install Python 3.10+ from https://python.org (script does NOT auto-install Python)"
    $hadFail = $true
  } else {
    Write-Step "python" "PASS" $py.Source
    $pipTest = & python -m pip --version 2>&1
    if ($LASTEXITCODE -ne 0) {
      Write-Step "pip" "FAIL" "python -m pip failed — ensure pip is installed"
      $hadFail = $true
    } else {
      Write-Step "pip" "PASS" ($pipTest -join " ")
      if ($CheckOnly) {
        $rembgCmd = Get-Command rembg -ErrorAction SilentlyContinue
        Write-Step "rembg" $(if ($rembgCmd) { "PASS" } else { "SKIP" }) $(if ($rembgCmd) { "on PATH" } else { "not installed yet" })
      } else {
        if (-not $Yes) {
          $confirm = Read-Host "Run 'python -m pip install rembg'? [y/N]"
          if ($confirm -notmatch '^[yY]') {
            Write-Step "rembg install" "SKIP" "user declined"
          } else {
            $Yes = $true
          }
        }
        if ($Yes) {
          Write-Host "  Running: python -m pip install --upgrade pip" -ForegroundColor Gray
          python -m pip install --upgrade pip
          Write-Host "  Running: python -m pip install rembg" -ForegroundColor Gray
          python -m pip install rembg
          if ($LASTEXITCODE -eq 0) {
            Write-Step "rembg install" "PASS" "pip install rembg OK"
          } else {
            Write-Step "rembg install" "FAIL" "exit $LASTEXITCODE"
            $hadFail = $true
          }
        }
      }
    }
  }
}

if ($UseReplicate) {
  Write-Host "`n[Replicate]" -ForegroundColor Cyan
  Write-Host '  setx REPLICATE_API_TOKEN "your-token-here"'
  Write-Host "  Restart terminal. Script does NOT prompt for or store tokens."
  Write-Host "  Do NOT paste token in chat, logs, or screenshots."
  if ($env:REPLICATE_API_TOKEN) {
    Write-Step "REPLICATE_API_TOKEN" "PASS" "CONFIGURED (value hidden)"
  } else {
    Write-Step "REPLICATE_API_TOKEN" "SKIP" "MISSING — set manually with setx"
  }
}

if ($InstallRealEsrgan) {
  Write-Host "`n[Real-ESRGAN]" -ForegroundColor Cyan
  Write-Host "  No automatic binary download — official source only." -ForegroundColor Gray
  $found = $false
  foreach ($cmd in @("realesrgan-ncnn-vulkan", "realesrgan-ncnn-vulkan.exe")) {
    if (Get-Command $cmd -ErrorAction SilentlyContinue) {
      Write-Step "realesrgan-ncnn-vulkan" "PASS" "Found: $cmd"
      $found = $true
    }
  }
  if (-not $found) {
    Write-Step "realesrgan-ncnn-vulkan" "SKIP" "not in PATH"
    Write-Host "  Manual: https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases"
    Write-Host "  Extract zip, add folder containing realesrgan-ncnn-vulkan.exe to PATH."
    if ($FullImage) { $hadFail = $true }
  }
}

if ($FullImage) {
  Write-Host "`n[Full-image post-check]" -ForegroundColor Cyan
  & $checkScript -Profile full-image
  exit $LASTEXITCODE
}

if ($hadFail) {
  Write-Host "`nOVERALL: FAIL (see steps above)" -ForegroundColor Red
  exit 1
}

Write-Host "`nDone. Verify: powershell -File scripts\check-image-deps.ps1 -Profile image-core" -ForegroundColor Cyan
exit 0
