#!/usr/bin/env node
/**
 * Verify UI design tool profiles: ui-design-core | ui-design-full
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const WORKSPACE = path.join(ROOT, "tests", "fixtures", "sample-project");
const UI_FIXTURE = path.join(ROOT, "tests", "fixtures", "ui", "sample.html");

const profileArg =
  process.argv.find((a) => a.startsWith("--profile="))?.split("=")[1] ??
  (process.argv.includes("--profile") ? process.argv[process.argv.indexOf("--profile") + 1] : "ui-design-core");
const profile = profileArg === "ui-design-full" ? "ui-design-full" : "ui-design-core";

async function importTool(rel) {
  return import(pathToFileURL(path.join(ROOT, "dist", rel)).href);
}

const results = [];

function record(name, status, detail = "") {
  results.push({ name, status, detail });
}

function okStatus(s) {
  return s === "PASS" || s === "SKIPPED";
}

async function main() {
  if (!fs.existsSync(UI_FIXTURE)) {
    console.error("Missing UI fixture:", UI_FIXTURE);
    process.exit(1);
  }

  const { extractDesignTokens } = await importTool("tools/extractDesignTokens.js");
  const { generatePalette } = await importTool("tools/generatePalette.js");
  const { suggestUiPattern } = await importTool("tools/suggestUiPattern.js");
  const { readDevgolGuide } = await importTool("tools/readDevgolGuide.js");
  const { listUiComponents } = await importTool("tools/listUiComponents.js");
  const { previewHtml } = await importTool("tools/previewHtml.js");
  const { auditAccessibility } = await importTool("tools/auditAccessibility.js");
  const { collectUiDesignDependencies, uiDesignCoreReady, uiDesignFullReady } = await importTool(
    "utils/uiDesignDependencies.js"
  );

  const snap = await collectUiDesignDependencies();
  record("deps-snapshot", uiDesignCoreReady(snap) ? "PASS" : "FAIL", JSON.stringify(snap));

  const tokens = await extractDesignTokens({ workspacePath: WORKSPACE, sources: ["**/*.css"] });
  record("extract_design_tokens", tokens.status, tokens.status === "PASS" ? `${tokens.fileCount} files` : tokens.error);

  const palette = await generatePalette({ workspacePath: WORKSPACE, seedColor: "#2563eb" });
  record("generate_palette", palette.status);

  const pattern = await suggestUiPattern({ workspacePath: WORKSPACE, productType: "saas" });
  record("suggest_ui_pattern", pattern.status);

  const guide = await readDevgolGuide({ workspacePath: WORKSPACE, topic: "scorecard" });
  record("read_devgol_guide", guide.status);

  const components = await listUiComponents({ workspacePath: WORKSPACE });
  record("list_ui_components", components.status);

  const relHtml = path.relative(WORKSPACE, UI_FIXTURE).replace(/\\/g, "/");
  const preview = await previewHtml({
    workspacePath: WORKSPACE,
    relativePath: relHtml,
    outputRelativePath: ".mcp-debug/screenshots/verify-preview.png",
  });
  record("preview_html", preview.status, preview.reason ?? preview.error ?? "");

  const a11yLite = await auditAccessibility({
    workspacePath: WORKSPACE,
    relativePath: relHtml,
    mode: "lite",
  });
  record("audit_accessibility_lite", a11yLite.status, a11yLite.reason ?? "");

  const a11yFull = await auditAccessibility({
    workspacePath: WORKSPACE,
    relativePath: relHtml,
    mode: "full",
  });
  if (profile === "ui-design-full") {
    record("audit_accessibility_full", a11yFull.status, a11yFull.reason ?? a11yFull.installHint ?? "");
  } else {
    record(
      "audit_accessibility_full",
      okStatus(a11yFull.status) ? "PASS" : "FAIL",
      a11yFull.status === "SKIPPED" ? "SKIPPED ok for ui-design-core" : ""
    );
  }

  const failed = results.filter((r) => r.status === "FAIL");
  console.log(`Profile: ${profile}`);
  for (const r of results) {
    console.log(`  ${r.status.padEnd(7)} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }

  if (profile === "ui-design-full" && !uiDesignFullReady(snap)) {
    console.error("ui-design-full: Playwright+axe not ready");
    process.exit(1);
  }

  if (failed.length > 0) {
    console.error(`${failed.length} FAIL`);
    process.exit(1);
  }
  console.log("ui-design profile verify PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
