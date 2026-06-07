# Copilot MCP Tool Profiles

MCP **local-coding-tools** v0.17.0 — **86 tools** with profile subsets.

## Profiles

| Profile | Tools | Use case |
|---------|-------|----------|
| **safe** | 82 (no VSIX) | Default agent, coding + UI + image |
| **dev** | 85 (+ check/package/verify VSIX) | Extension dev, no marketplace publish |
| **admin** | 86 (all tools) | Release engineer — includes `vsix_publish_marketplace` |
| **image** | image_* subset | Image editing tasks |
| **uiux** | UI design subset | UI/UX loop |
| **browser** | playwright_* + chrome | Browser automation |

## Agent templates

| File | Profile |
|------|---------|
| `DMCTN-MCP-Safe.agent.md` | safe |
| `DMCTN-MCP-Dev.agent.md` | dev + VSIX check/package/verify |
| `DMCTN-MCP-Admin.agent.md` | admin + publish (confirm + PAT warnings) |
| `DMCTN-MCP.agent.md` | full 86 tools (legacy/full) |

## VSIX placement

- **safe:** zero VSIX tools
- **dev:** `vsix_check_marketplace`, `vsix_package`, `vsix_verify_publish`
- **admin:** above + `vsix_publish_marketplace`

Source: `src/toolProfiles.ts`
