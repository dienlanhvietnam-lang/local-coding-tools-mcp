# Copilot instructions — prefer local-coding-tools MCP

This workspace uses **local-coding-tools** MCP. Follow these rules in Copilot Chat.

## MCP first

- **Prefer** tools from MCP server `local-coding-tools` over default terminal or built-in file tools.
- When the **DMCTN-MCP** custom agent is selected, only MCP tools from `local-coding-tools/*` are in scope.

## Task mapping

| User intent | Use MCP tool |
|-------------|--------------|
| build, test, verify, smoke, lint, typecheck | `run_project_script` |
| project audit, health check, debug prep | `run_coding_session` |
| read file | `read_workspace_file` |
| search code | `search_workspace` |
| edit file safely | `apply_patch` or `write_workspace_file` |
| image operations | `image_*` tools |
| image deps profile | `check_image_dependencies` |

## Shell policy

- **No free shell commands** when an MCP tool can do the job.
- Do **not** run `npm install`, `npm test`, `npm run build` via terminal — use `run_project_script`.
- Do **not** use `Set-Location` + npm chains.

## Evidence and safety

- Conclude **PASS** or **FAIL** from MCP JSON responses only.
- Never expose secrets, API keys, tokens, or `.env` values.
- Avoid unrestricted shell / terminal tool mode; MCP tools only when available.

## Troubleshooting

1. Reload VS Code (**Developer: Reload Window**).
2. Run **MCP: Show Installed Servers** — confirm `local-coding-tools` is listed.
3. In Copilot Chat, select agent **DMCTN-MCP** (not the default agent).
4. If tools still fail, verify `.vscode/mcp.json` and `.github/agents/DMCTN-MCP.agent.md` exist.
