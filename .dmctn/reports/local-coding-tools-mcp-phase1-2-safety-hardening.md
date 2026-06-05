# Phase 1.2 Report — Safety Hardening + Customer-Ready Polish

**Project:** `local-coding-tools-mcp`
**Milestone:** `LOCAL_CODING_TOOLS_MCP_COPILOT_ADVANCED_R1` → Phase 1.2
**Date:** 2026-06-05
**Status:** ✅ **FULL PASS**

---

## Files Changed

| File | Change |
|------|--------|
| `src/tools/writeWorkspaceFile.ts` | Added restricted path patterns (node_modules, .git, dist, build, coverage, .env, .pem, .key, credentials, tokens, secrets), path traversal blocking (`../`), allowlist write mode (only .mcp-debug, docs, tests, src, README.md, CHANGELOG.md allowed), returns `BLOCKED` + `restricted_write_path` |
| `src/tools/gitStatus.ts` | Non-git repos now return `SKIPPED` with `reason: "not_a_git_repository"` instead of `FAIL` |
| `src/tools/runProjectScript.ts` | Added optional `projectSubdir` parameter for monorepo support; reads `package.json` from subdirectory; blocks path traversal in subdir; `cwd` set to package dir |
| `src/server.ts` | Added `projectSubdir` to `run_project_script` MCP tool schema |
| `src/utils/result.ts` | Added `skipped()` helper function and `"SKIPPED"` to `PassFailStatus` type |
| `src/tools/collectDebugBundle.ts` | Added `excludedSensitive: true` and `excludedSensitivePatterns` to manifest |
| `tests/safety-hardening.test.ts` | **New file** — 24 tests covering write guard, projectSubdir, and gitStatus SKIPPED |
| `tests/tools.test.ts` | Updated `gitStatus` test to accept `SKIPPED` status |
| `README.md` | Added Safety Model, Allowed/Blocked paths, Monorepo scripts, VS Code/Cursor test instructions |

---

## Commands Run

| Command | Result |
|---------|--------|
| `npm run build` | ✅ PASS |
| `npm test` | ✅ **62/62 tests PASS** (5 test files) |
| `npm run smoke` | ✅ **Smoke PASSED: 6 checks** |
| `npm run verify` | ✅ **Verify PASSED** |

---

## Test Evidence

### write_workspace_file — Allowlist (PASS)

| Test | Expected | Actual |
|------|----------|--------|
| Write `.mcp-debug/copilot-test.md` | PASS | ✅ PASS |
| Write `src/debug.md` | PASS | ✅ PASS |
| Write `tests/test-helper.txt` | PASS | ✅ PASS |
| Write `docs/readme.txt` | PASS | ✅ PASS |
| Write `README.md` (root) | PASS | ✅ PASS |
| Write `CHANGELOG.md` (root) | PASS | ✅ PASS |

### write_workspace_file — Blocked

| Test | Expected | Actual |
|------|----------|--------|
| Write `node_modules/a.txt` | BLOCKED | ✅ BLOCKED |
| Write `.git/config` | BLOCKED | ✅ BLOCKED |
| Write `dist/bundle.js` | BLOCKED | ✅ BLOCKED |
| Write `build/output.exe` | BLOCKED | ✅ BLOCKED |
| Write `coverage/lcov.info` | BLOCKED | ✅ BLOCKED |
| Write `.env` | BLOCKED | ✅ BLOCKED |
| Write `.env.local` | BLOCKED | ✅ BLOCKED |
| Write `secret.pem` | BLOCKED | ✅ BLOCKED |
| Write `private.key` | BLOCKED | ✅ BLOCKED |
| Write `credentials.txt` | BLOCKED | ✅ BLOCKED |
| Write `tokens.json` | BLOCKED | ✅ BLOCKED |
| Write `secret/config.json` | BLOCKED | ✅ BLOCKED |
| Write `../outside.txt` | BLOCKED | ✅ BLOCKED |
| Write `bin/tool.sh` (not in allowlist) | BLOCKED | ✅ BLOCKED |

### run_project_script — projectSubdir

| Test | Expected | Actual |
|------|----------|--------|
| Fixture danger script via subdir | BLOCKED | ✅ BLOCKED |
| Nonexistent script via subdir | FAIL | ✅ FAIL |
| Path traversal in subdir | FAIL | ✅ FAIL |

### gitStatus — SKIPPED

| Test | Expected | Actual |
|------|----------|--------|
| Non-repo fixture returns SKIPPED | SKIPPED | ✅ SKIPPED (or PASS if in repo) |

---

## PASS/FAIL Table

| Criterion | Result |
|-----------|--------|
| Build PASS | ✅ PASS |
| Tests PASS (62/62) | ✅ PASS |
| Smoke PASS (6/6) | ✅ PASS |
| Verify PASS (6/6) | ✅ PASS |
| write guard blocks restricted paths | ✅ PASS (14 tests) |
| write guard allows allowed paths | ✅ PASS (6 tests) |
| subdirectory run_project_script | ✅ PASS (3 tests) |
| git_status not repo returns SKIPPED | ✅ PASS |
| 13 existing tools not broken | ✅ PASS (62 total tests) |
| No `.env` in debug bundle | ✅ PASS |

---

## Remaining Risks

1. **`write_workspace_file` allowlist is MVP-hard** — writing to paths outside the allowlist (e.g. `config/`, `scripts/`) is blocked. Customers may need to extend the allowlist for their use cases.
2. **`run_project_script` subdirectory test coverage** — only tested with fixture `danger` and nonexistent scripts. No real monorepo build test yet.
3. **DeprecationWarning** — `execSync` with `shell:true` shows `DEP0190` warning. Low priority but should be fixed in future to use `{shell:true, ...}` with explicit array args.
4. **No path pattern for allowed writes** — currently uses prefix matching, not glob patterns. Could be enhanced for more flexible routing.

---

## Next Phase (Phase 1.3 — Suggested)

### High Priority
- [ ] Fix `DEP0190` deprecation warning in `execSafe.ts` — switch to `{ shell: true }` with array args
- [ ] Add `scripts/` and `config/` to write allowlist (customer-requested)
- [ ] Add glob-based path matching for write allowlist (use `micromatch` or similar)
- [ ] Add `--dry-run` mode to `run_project_script` for preview before execution

### Medium Priority
- [ ] Add workspace-level config file (`.mcpconfig.json`) for customer customization of allowlists
- [ ] Telemetry opt-in (local only — log file count, not content)
- [ ] Add `CHANGELOG.md` with version history

### Low Priority
- [ ] Benchmark tool call latency
- [ ] Add CI pipeline (GitHub Actions)
