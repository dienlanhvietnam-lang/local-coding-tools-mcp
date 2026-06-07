# Hướng dẫn UI Design profile

## Yêu cầu tối thiểu (ui-design-core)

- Node 20+ (WebSocket cho CDP)
- Chrome hoặc Edge đã cài
- `pixelmatch` + `pngjs` (npm install mặc định)

```powershell
npm install
npm run build
npm run verify:ui-design-core
```

## Full profile (Playwright + axe)

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install-ui-design-deps.ps1 -InstallPlaywright
npm run verify:ui-design-full
```

## Kiểm tra deps

```powershell
powershell -ExecutionPolicy Bypass -File scripts\check-ui-design-deps.ps1 -Profile ui-design-core
```

## Agent UI_DESIGN_LOOP

Agent **DMCTN-MCP** (policy v4) bắt buộc gọi screenshot + audit trước khi báo xong task UI.

Extension **dmctn-mcp v0.5.2** tự sync policy khi mở workspace.
