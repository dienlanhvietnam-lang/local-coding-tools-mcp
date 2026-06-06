# local-coding-tools-mcp v0.11.1

## Highlights

Patch nâng cấp 3 tool HTTP/Chrome (61 tools — không thêm tool mới).

## Changes

- **HTTP layer:** `probeHttpGet()`, User-Agent thống nhất qua `SERVER_VERSION`, `DEFAULT_FETCH_MAX_BODY` 256KB
- **`check_url`:** headers, `finalUrl`, `contentType`, `privateHost`; option `includeAllHeaders`
- **`fetch_url`:** default 256KB, thêm `headers`, `hint`, `privateHost`
- **`chrome_load_extension`:** `resolveBrowserExecutable`, prefer Chrome, profile timestamp, `--disable-extensions-except`

## Verify

```bash
npm test && npm run smoke && npm run verify
```
