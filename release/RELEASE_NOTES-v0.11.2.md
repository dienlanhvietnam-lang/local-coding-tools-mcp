# local-coding-tools-mcp v0.11.2

## Highlights

Fix customer ZIP thiếu `expected-tools.mjs` — **Kiểm tra MCP** (`pilot-stdio`) không còn fail.

## Changes

- `package-customer-zip.ps1`: include `expected-tools.mjs`, `hard-test-all-tools.mjs`
- `verify.mjs`: require `scripts/expected-tools.mjs`

## Verify

```bash
npm test && npm run verify:customer-zip
```
