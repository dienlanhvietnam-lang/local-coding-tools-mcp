import { EXPECTED_TOOLS, type RegisteredToolName } from "./toolRegistry.js";

/** VSIX publisher tool names. */
export const VSIX_TOOLS = [
  "vsix_check_marketplace",
  "vsix_package",
  "vsix_publish_marketplace",
  "vsix_verify_publish",
] as const satisfies readonly RegisteredToolName[];

export type VsixToolName = (typeof VSIX_TOOLS)[number];

/** Dev profile: check, package, verify — no publish. */
export const VSIX_DEV_TOOLS = [
  "vsix_check_marketplace",
  "vsix_package",
  "vsix_verify_publish",
] as const satisfies readonly RegisteredToolName[];

/** Admin-only publish tool. */
export const VSIX_PUBLISH_TOOL = "vsix_publish_marketplace" as const;

export type ToolProfileId = "safe" | "dev" | "admin" | "image" | "uiux" | "browser";

export interface ToolRiskMeta {
  riskLevel: "low" | "medium" | "high";
  requiresConfirm?: boolean;
}

export const VSIX_RISK: Record<VsixToolName, ToolRiskMeta> = {
  vsix_check_marketplace: { riskLevel: "medium" },
  vsix_package: { riskLevel: "medium" },
  vsix_verify_publish: { riskLevel: "low" },
  vsix_publish_marketplace: { riskLevel: "high", requiresConfirm: true },
};

const IMAGE_TOOLS = new Set<RegisteredToolName>([
  "check_image_dependencies",
  "image_adjust",
  "image_batch",
  "image_composite",
  "image_crop",
  "image_info",
  "image_ocr",
  "image_remove_background",
  "image_resize",
  "image_rounded",
  "image_text",
  "image_upscale",
  "image_upscale_ai",
  "generate_image",
]);

const UIUX_TOOLS = new Set<RegisteredToolName>([
  "analyze_typography",
  "audit_accessibility",
  "audit_responsive",
  "capture_screenshot",
  "compare_images",
  "extract_design_tokens",
  "fetch_icon_svg",
  "generate_palette",
  "list_ui_components",
  "page_audit",
  "preview_html",
  "read_devgol_guide",
  "score_ui_devgol",
  "suggest_ui_pattern",
]);

const BROWSER_TOOLS = new Set<RegisteredToolName>([
  "playwright_act",
  "playwright_close",
  "playwright_navigate",
  "playwright_screenshot",
  "playwright_snapshot",
  "chrome_load_extension",
]);

const VSIX_SET = new Set<string>(VSIX_TOOLS);

/** All registered tools minus VSIX (default safe baseline). */
export const SAFE_PROFILE_TOOLS: RegisteredToolName[] = EXPECTED_TOOLS.filter(
  (t) => !VSIX_SET.has(t)
);

/** Dev = safe + VSIX check/package/verify. */
export const DEV_PROFILE_TOOLS: RegisteredToolName[] = [
  ...SAFE_PROFILE_TOOLS,
  ...VSIX_DEV_TOOLS,
];

/** Admin = all tools including publish. */
export const ADMIN_PROFILE_TOOLS: RegisteredToolName[] = [...EXPECTED_TOOLS];

export const PROFILE_TOOL_MAP: Record<ToolProfileId, RegisteredToolName[]> = {
  safe: SAFE_PROFILE_TOOLS,
  dev: DEV_PROFILE_TOOLS,
  admin: ADMIN_PROFILE_TOOLS,
  image: EXPECTED_TOOLS.filter((t) => IMAGE_TOOLS.has(t)),
  uiux: EXPECTED_TOOLS.filter((t) => UIUX_TOOLS.has(t)),
  browser: EXPECTED_TOOLS.filter((t) => BROWSER_TOOLS.has(t)),
};

export function toolsForProfile(profile: ToolProfileId): RegisteredToolName[] {
  return PROFILE_TOOL_MAP[profile];
}

export function profileIncludesTool(profile: ToolProfileId, tool: string): boolean {
  return PROFILE_TOOL_MAP[profile].includes(tool as RegisteredToolName);
}

export function assertProfileExcludesVsix(profile: "safe"): void {
  for (const t of VSIX_TOOLS) {
    if (profileIncludesTool(profile, t)) {
      throw new Error(`safe profile must not include ${t}`);
    }
  }
}
