---
name: DMCTN-MCP-Safe
description: Safe profile — 82 tools, no VSIX publish tools.
tools:
  - local-coding-tools/analyze_typography
  - local-coding-tools/apply_patch
  - local-coding-tools/audit_accessibility
  - local-coding-tools/audit_responsive
  - local-coding-tools/capture_screenshot
  - local-coding-tools/check_image_dependencies
  - local-coding-tools/check_js_syntax
  - local-coding-tools/check_system
  - local-coding-tools/check_url
  - local-coding-tools/check_workspace
  - local-coding-tools/chrome_load_extension
  - local-coding-tools/clear_session_context
  - local-coding-tools/collect_debug_bundle
  - local-coding-tools/compare_images
  - local-coding-tools/copy_workspace_file
  - local-coding-tools/create_directory
  - local-coding-tools/delete_pattern
  - local-coding-tools/delete_workspace_file
  - local-coding-tools/edit_notebook
  - local-coding-tools/estimate_tool_output
  - local-coding-tools/extract_design_tokens
  - local-coding-tools/fetch_cached_output
  - local-coding-tools/fetch_icon_svg
  - local-coding-tools/fetch_url
  - local-coding-tools/file_stats
  - local-coding-tools/generate_image
  - local-coding-tools/generate_palette
  - local-coding-tools/get_session_context
  - local-coding-tools/git_add
  - local-coding-tools/git_branch
  - local-coding-tools/git_checkout
  - local-coding-tools/git_commit
  - local-coding-tools/git_init
  - local-coding-tools/git_merge
  - local-coding-tools/git_pull
  - local-coding-tools/git_push
  - local-coding-tools/git_status
  - local-coding-tools/glob_workspace
  - local-coding-tools/http_request
  - local-coding-tools/image_adjust
  - local-coding-tools/image_batch
  - local-coding-tools/image_composite
  - local-coding-tools/image_crop
  - local-coding-tools/image_info
  - local-coding-tools/image_ocr
  - local-coding-tools/image_remove_background
  - local-coding-tools/image_resize
  - local-coding-tools/image_rounded
  - local-coding-tools/image_text
  - local-coding-tools/image_upscale
  - local-coding-tools/image_upscale_ai
  - local-coding-tools/list_scripts
  - local-coding-tools/list_ui_components
  - local-coding-tools/list_workspace_tree
  - local-coding-tools/move_workspace_file
  - local-coding-tools/page_audit
  - local-coding-tools/playwright_act
  - local-coding-tools/playwright_close
  - local-coding-tools/playwright_navigate
  - local-coding-tools/playwright_screenshot
  - local-coding-tools/playwright_snapshot
  - local-coding-tools/preview_html
  - local-coding-tools/read_binary_file
  - local-coding-tools/read_devgol_guide
  - local-coding-tools/read_lints
  - local-coding-tools/read_project_info
  - local-coding-tools/read_project_memory
  - local-coding-tools/read_workspace_file
  - local-coding-tools/run_coding_session
  - local-coding-tools/run_format
  - local-coding-tools/run_project_script
  - local-coding-tools/run_safe_command
  - local-coding-tools/score_ui_devgol
  - local-coding-tools/search_web
  - local-coding-tools/search_workspace
  - local-coding-tools/semantic_search
  - local-coding-tools/suggest_ui_pattern
  - local-coding-tools/summarize_tool_history
  - local-coding-tools/todo_read
  - local-coding-tools/todo_write
  - local-coding-tools/write_project_memory
  - local-coding-tools/write_workspace_file
---

# DMCTN-MCP-Safe

Safe profile: all MCP tools **except** VSIX publisher tools.

Use agent **DMCTN-MCP-Safe** for everyday coding. For extension packaging use **DMCTN-MCP-Dev** or **DMCTN-MCP-Admin**.

VSIX tools (`vsix_*`) are **not** available in this profile.

See `docs/COPILOT-MCP-PROFILES.md`.
