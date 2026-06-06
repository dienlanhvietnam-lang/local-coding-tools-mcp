# local-coding-tools-mcp v0.10.0

## Highlights

- **56 MCP tools** (was 37) — 19 new tools toward a full-stack dev toolkit
- Release gate / E2E / pilot-stdio / hard-test all updated for 56 tools

## New tools

| Group | Tools |
|-------|-------|
| Quality | `check_js_syntax`, `run_format` |
| FS batch | `read_binary_file`, `copy_workspace_file`, `delete_pattern` (dryRun default), `create_directory`, `file_stats` |
| Search | `glob_workspace`, `semantic_search` |
| Network | `http_request` (GET/POST/PUT/PATCH/DELETE/HEAD, body up to 256KB) |
| Git | `git_push`, `git_pull`, `git_branch`, `git_checkout`, `git_merge` |
| Meta | `edit_notebook`, `todo_write`, `todo_read`, `generate_image` |

`run_safe_command` allowlist expanded: `npx`, `pip`, `go`, `curl`, `docker`, `cargo`, `dotnet`, `yarn`, `bun`, `tsc`, `eslint`, `prettier`.

## Not supported (host-only)

`Task`, `SwitchMode`, `CreatePlan`, `Await`, `AskQuestion` are Cursor agent infrastructure and cannot run as MCP tools.

## Install

1. Download `local-coding-tools-mcp-v0.10.0-customer.zip`
2. Verify SHA256 in `SHA256SUMS.txt`
3. Extract -> `npm install && npm run build`
4. Point Cursor/VS Code MCP to `dist/server.js`

## Optional env

`BRAVE_SEARCH_API_KEY`, `SERPER_API_KEY`, `OPENAI_API_KEY`, `REPLICATE_API_TOKEN`, `VOYAGE_API_KEY`.
