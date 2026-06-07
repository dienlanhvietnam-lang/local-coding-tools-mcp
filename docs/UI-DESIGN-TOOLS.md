# UI Design Tools (v0.15.0)

14 tools for UI/UX design loop + 5 Playwright browser tools — 80 tools total.

## Playwright browser (v0.15.0)

| Tool | Purpose |
|------|---------|
| `playwright_navigate` | Open URL/HTML in persistent Chromium session |
| `playwright_screenshot` | PNG screenshot (full page optional) |
| `playwright_snapshot` | Accessibility tree for agent |
| `playwright_act` | click / fill / press / select / hover |
| `playwright_close` | Close session |

Install: `npx playwright install chromium` or `scripts/install-ui-design-deps.ps1 -InstallPlaywright`

## Visual feedback

| Tool | Input chính | Output |
|------|-------------|--------|
| `capture_screenshot` | `url` hoặc `relativePath` (.html) | PNG path, viewport |
| `preview_html` | `relativePath` hoặc `htmlSnippet` | PNG preview |
| `compare_images` | `referenceRelativePath`, `actualRelativePath` | `diffPercent`, optional diff PNG |

## Quality

| Tool | Mô tả |
|------|--------|
| `audit_accessibility` | mode `lite` (CDP) hoặc `full` (Playwright+axe) |
| `audit_responsive` | Multi-breakpoint overflow + screenshots |
| `page_audit` | DOM metrics + a11y + optional Lighthouse |

## Design system

| Tool | Mô tả |
|------|--------|
| `extract_design_tokens` | CSS vars, Tailwind, theme files |
| `generate_palette` | Seed color → light/dark palette |
| `analyze_typography` | Font scale từ CSS |
| `list_ui_components` | Component inventory |

## DEV GOL

| Tool | Mô tả |
|------|--------|
| `read_devgol_guide` | Scorecard, benchmark, patterns |
| `suggest_ui_pattern` | 3 hướng thiết kế (không code) |
| `score_ui_devgol` | Điểm /100, `belowThreshold` if < 85 |

## Assets

| Tool | Mô tả |
|------|--------|
| `fetch_icon_svg` | Lucide / Heroicons / Phosphor CDN |

## SKIPPED behavior

- Browser tools → `browser_not_found` nếu không có Chrome/Edge
- `audit_accessibility` full → `missing_dependency` nếu thiếu Playwright
- `fetch_icon_svg` → network/CDN errors
