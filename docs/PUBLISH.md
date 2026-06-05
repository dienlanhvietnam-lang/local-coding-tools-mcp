# Publish npm + winget

## 1. Publish npm

### Chuẩn bị

```powershell
cd E:\MCP\local-coding-tools-mcp
npm login
npm run build
npm test
npm run publish:check
```

### Dry-run

```powershell
npm pack --dry-run
```

### Publish

```powershell
npm publish --access public
```

Sau publish, cài global:

```powershell
npm install -g local-coding-tools-mcp
local-coding-tools-mcp   # chạy MCP stdio
```

### Cursor / VS Code sau npm global

```json
{
  "mcpServers": {
    "local-coding-tools": {
      "command": "local-coding-tools-mcp",
      "args": []
    }
  }
}
```

Hoặc dùng đường dẫn đầy đủ tới `%APPDATA%\npm\local-coding-tools-mcp.cmd`.

---

## 2. winget (Windows)

### Cách A — Script cài nhanh (không cần winget store)

```powershell
.\installer\scripts\install-winget-local.ps1
```

### Cách B — Submit manifest lên winget-pkgs

1. Fork https://github.com/microsoft/winget-pkgs
2. Copy `installer/winget/` → `manifests/d/DevGOL/LocalCodingToolsMcp/0.7.0/`
3. Cập nhật `InstallerUrl` trỏ tới GitHub Release zip hoặc npm tarball mirror
4. Mở PR theo [winget submission guidelines](https://github.com/microsoft/winget-pkgs/blob/master/doc/README.md)

### Real-ESRGAN CLI (AI upscale local)

Tải [Real-ESRGAN-ncnn-vulkan](https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases) và thêm vào PATH.

### Replicate API (AI upscale cloud)

```powershell
setx REPLICATE_API_TOKEN "r8_..."
```

---

## Version bump checklist

1. `package.json` + `src/config.ts` version
2. `CHANGELOG.md`
3. `npm run build && npm test && npm run verify`
4. `npm run publish:check`
5. Git tag `v0.7.0`
6. `npm publish`
7. Cập nhật winget manifest version + SHA256
