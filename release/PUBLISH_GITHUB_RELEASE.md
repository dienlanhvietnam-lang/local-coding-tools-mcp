# Publish GitHub Release — local-coding-tools-mcp

## Chuẩn bị

```powershell
cd E:\MCP\local-coding-tools-mcp
npm run build
powershell -ExecutionPolicy Bypass -File scripts/package-customer-zip.ps1 -Version 0.7.0
```

Ghi SHA256 từ output script vào `release/SHA256SUMS.txt`.

## Cách A — GitHub Actions (khuyên dùng)

Sau khi `gh auth login` và push tag, workflow tự build + upload ZIP:

```powershell
gh auth login
cd E:\MCP\local-coding-tools-mcp
git push origin main
git push origin v0.7.0
```

Theo dõi: **Actions → Release Customer ZIP**

## Cách B — Publish thủ công (gh CLI)

```powershell
gh auth login
# hoặc: $env:GH_TOKEN = "<token có quyền repo>"

cd E:\MCP\scripts
powershell -ExecutionPolicy Bypass -File publish-all.ps1 -Version 0.7.0
```

URL sau publish:

`https://github.com/devgol/local-coding-tools-mcp/releases/download/v0.7.0/local-coding-tools-mcp-v0.7.0-customer.zip`

## Xác nhận

```powershell
curl -I "https://github.com/devgol/local-coding-tools-mcp/releases/download/v0.7.0/local-coding-tools-mcp-v0.7.0-customer.zip"
```

HTTP 200 hoặc 302 → extension có thể tải được.
