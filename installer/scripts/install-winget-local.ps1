# Local install script (no winget store required)
# Requires: Node.js 18+

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

Write-Host "=== Local Coding Tools MCP — Local Install ===" -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js not found. Install from https://nodejs.org/"
}

Push-Location $ProjectRoot
try {
  Write-Host "Building..." -ForegroundColor Yellow
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "build failed" }

  Write-Host "Installing globally from source..." -ForegroundColor Yellow
  npm install -g $ProjectRoot
  if ($LASTEXITCODE -ne 0) { throw "global install failed" }

  Write-Host ""
  Write-Host "PASS — installed globally as: local-coding-tools-mcp" -ForegroundColor Green
  Write-Host ""
  Write-Host "Cursor .cursor/mcp.json:" -ForegroundColor Cyan
  Write-Host @'
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "local-coding-tools-mcp",
      "args": []
    }
  }
}
'@
} finally {
  Pop-Location
}
