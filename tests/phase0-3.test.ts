import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { applyPatch } from "../src/tools/applyPatch.js";
import { readLints } from "../src/tools/readLints.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");

describe("Phase 0.3 — expanded write allowlist", () => {
  const cleanup: string[] = [];
  afterAll(() => {
    for (const p of cleanup) {
      try {
        fs.unlinkSync(path.join(FIXTURE, p));
      } catch {
        // ignore
      }
    }
  });

  it("allows scripts/helper.mjs", async () => {
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "scripts/helper.mjs",
      content: "export const ok = true;",
    });
    expect(r.status).toBe("PASS");
    cleanup.push("scripts/helper.mjs");
  });

  it("allows examples/demo.json", async () => {
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "examples/demo.json",
      content: "{}",
    });
    expect(r.status).toBe("PASS");
    cleanup.push("examples/demo.json");
  });

  it("allows bin/tool.sh", async () => {
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "bin/tool.sh",
      content: "#!/bin/sh\necho ok",
    });
    expect(r.status).toBe("PASS");
    cleanup.push("bin/tool.sh");
  });

  it("allows package.json rewrite", async () => {
    const content = fs.readFileSync(path.join(FIXTURE, "package.json"), "utf8");
    const r = await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: "package.json",
      content,
    });
    expect(r.status).toBe("PASS");
  });
});

describe("Phase 0.3 — apply_patch", () => {
  const target = path.join(FIXTURE, "src", "patch-me.txt");
  afterAll(() => {
    try {
      fs.unlinkSync(target);
    } catch {
      // ignore
    }
  });

  it("applies unique replacement", async () => {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "alpha beta gamma", "utf8");
    const r = await applyPatch({
      workspacePath: FIXTURE,
      relativePath: "src/patch-me.txt",
      oldText: "beta",
      newText: "BETA",
    });
    expect(r.status).toBe("PASS");
    expect(fs.readFileSync(target, "utf8")).toBe("alpha BETA gamma");
  });

  it("blocks dist output", async () => {
    const r = await applyPatch({
      workspacePath: FIXTURE,
      relativePath: "dist/hack.js",
      oldText: "a",
      newText: "b",
    });
    expect(r.status).toBe("BLOCKED");
  });
});

describe("Phase 0.3 — read_lints", () => {
  it("runs tsc on main project", async () => {
    const r = await readLints({ workspacePath: ROOT, timeoutMs: 90_000 });
    expect(["PASS", "FAIL", "PARTIAL"]).toContain(r.status);
    expect(r.diagnostics).toBeDefined();
  }, 120_000);
});
