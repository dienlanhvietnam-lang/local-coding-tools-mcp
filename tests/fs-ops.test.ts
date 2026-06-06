import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { deleteWorkspaceFile } from "../src/tools/deleteWorkspaceFile.js";
import { moveWorkspaceFile } from "../src/tools/moveWorkspaceFile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");
const TMP_DIR = path.join(FIXTURE, "tmp-fs-ops");

describe("filesystem ops", () => {
  afterAll(() => {
    try {
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it("delete_workspace_file removes a file", async () => {
    const rel = "tmp-fs-ops/to-delete.txt";
    await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: rel,
      content: "delete me",
    });

    const r = await deleteWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: rel,
    });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(FIXTURE, rel))).toBe(false);
  });

  it("delete_workspace_file rejects non-empty dir without recursive", async () => {
    const dir = "tmp-fs-ops/nested";
    await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: `${dir}/child.txt`,
      content: "x",
    });

    const r = await deleteWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: dir,
    });
    expect(r.status).toBe("FAIL");
  });

  it("move_workspace_file renames a file", async () => {
    const from = "tmp-fs-ops/move-from.txt";
    const to = "tmp-fs-ops/move-to.txt";
    await writeWorkspaceFile({
      workspacePath: FIXTURE,
      relativePath: from,
      content: "moved",
    });

    const r = await moveWorkspaceFile({
      workspacePath: FIXTURE,
      fromRelativePath: from,
      toRelativePath: to,
    });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(FIXTURE, from))).toBe(false);
    expect(fs.readFileSync(path.join(FIXTURE, to), "utf8")).toBe("moved");
  });
});
