import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { checkJsSyntax } from "../src/tools/checkJsSyntax.js";
import { runFormat } from "../src/tools/runFormat.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");
const cleanup: string[] = [];

describe("check_js_syntax", () => {
  afterAll(() => {
    for (const p of cleanup) { try { fs.unlinkSync(path.join(FIXTURE, p)); } catch { /* ignore */ } }
  });

  it("PASS on valid JS", async () => {
    await writeWorkspaceFile({ workspacePath: FIXTURE, relativePath: "ok.mjs", content: "export const x = 1;\n" });
    cleanup.push("ok.mjs");
    const r = await checkJsSyntax({ workspacePath: FIXTURE, relativePath: "ok.mjs" });
    expect(r.status).toBe("PASS");
  });

  it("FAIL on invalid JS", async () => {
    await writeWorkspaceFile({ workspacePath: FIXTURE, relativePath: "bad.mjs", content: "const = ;\n" });
    cleanup.push("bad.mjs");
    const r = await checkJsSyntax({ workspacePath: FIXTURE, relativePath: "bad.mjs" });
    expect(r.status).toBe("FAIL");
  });
});

describe("run_format", () => {
  it("SKIPPED when no formatter installed in fixture", async () => {
    const r = await runFormat({ workspacePath: FIXTURE });
    expect(["SKIPPED", "PASS"]).toContain(r.status);
  });
});
