# local-coding-tools-mcp v0.9.0

## Highlights

- **37 MCP tools** (was 28) — 9 new tools to close agent capability gaps
- Release gate, E2E, pilot-stdio, and hard-test updated for 37 tools

## New tools

| Tool | Purpose |
|------|---------|
| `delete_workspace_file` | Delete files / directories in workspace |
| `move_workspace_file` | Rename or move files within workspace |
| `git_init` | Initialize git repository |
| `git_add` | Stage files (no force add) |
| `git_commit` | Commit with message (no push) |
| `fetch_url` | HTTP GET with response body (truncated) |
| `run_safe_command` | Allowlisted exec (node, npm, pnpm, git, python, powershell) |
| `search_web` | Web search (DuckDuckGo Lite or Brave/Serper API key) |
| `chrome_load_extension` | Dev sideload unpacked Chrome/Edge extension |

## Install

1. Download `local-coding-tools-mcp-v0.9.0-customer.zip`
2. Verify SHA256 in `SHA256SUMS.txt`
3. Extract → `npm install && npm run build`
4. Point Cursor/VS Code MCP to `dist/server.js`

## Optional env

- `BRAVE_SEARCH_API_KEY` / `SERPER_API_KEY` — reliable `search_web`
- `REPLICATE_API_TOKEN` — `image_upscale_ai` API mode
