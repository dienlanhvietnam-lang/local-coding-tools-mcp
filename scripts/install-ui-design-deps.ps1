param(
  [switch]$InstallPlaywright,
  [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Push-Location $root

Write-Host "UI design deps — root: $root"

if ($CheckOnly) {
  & "$PSScriptRoot\check-ui-design-deps.ps1" -Profile ui-design-core
  exit $LASTEXITCODE
}

npm install pixelmatch pngjs --save 2>&1 | Write-Host

if ($InstallPlaywright) {
  Write-Host "Installing optional Playwright + axe..."
  npm install playwright-core @axe-core/playwright --save-optional 2>&1 | Write-Host
  npx playwright install chromium 2>&1 | Write-Host
}

npm run build 2>&1 | Write-Host
& "$PSScriptRoot\check-ui-design-deps.ps1" -Profile $(if ($InstallPlaywright) { "ui-design-full" } else { "ui-design-core" })
exit $LASTEXITCODE
