import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { writeWorkspaceFile } from "../src/tools/writeWorkspaceFile.js";
import { copyWorkspaceFile } from "../src/tools/copyWorkspaceFile.js";
import { createDirectory } from "../src/tools/createDirectory.js";
import { deletePattern } from "../src/tools/deletePattern.js";
import { fileStats } from "../src/tools/fileStats.js";
import { readBinaryFile } from "../src/tools/readBinaryFile.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FIXTURE = path.join(ROOT, "tests", "fixtures", "sample-project");
const TMP = path.join(FIXTURE, "tmp-fs-batch");

describe("fs batch tools", () => {
  afterAll(() => {
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("create_directory creates nested dir", async () => {
    const r = await createDirectory({ workspacePath: FIXTURE, relativePath: "tmp-fs-batch/a/b" });
    expect(r.status).toBe("PASS");
    expect(fs.existsSync(path.join(FIXTURE, "tmp-fs-batch/a/b"))).toBe(true);
  });

  it("copy_workspace_file copies a file", async () => {
    await writeWorkspaceFile({ workspacePath: FIXTURE, relativePath: "tmp-fs-batch/src.txt", content: "hello" });
    const r = await copyWorkspaceFile({
      workspacePath: FIXTURE,
      fromRelativePath: "tmp-fs-batch/src.txt",
      toRelativePath: "tmp-fs-batch/copy.txt",
    });
    expect(r.status).toBe("PASS");
    expect(fs.readFileSync(path.join(FIXTURE, "tmp-fs-batch/copy.txt"), "utf8")).toBe("hello");
  });

  it("file_stats returns metadata", async () => {
    const r = await fileStats({ workspacePath: FIXTURE, relativePath: "tmp-fs-batch/src.txt" });
    expect(r.status).toBe("PASS");
    expect(r.isFile).toBe(true);
    expect(r.sizeBytes).toBe(5);
  });

  it("read_binary_file returns base64", async () => {
    const r = await readBinaryFile({ workspacePath: FIXTURE, relativePath: "tmp-fs-batch/src.txt" });
    expect(r.status).toBe("PASS");
    expect(Buffer.from(r.data ?? "", "base64").toString("utf8")).toBe("hello");
  });

  it("delete_pattern dryRun lists without deleting", async () => {
    await writeWorkspaceFile({ workspacePath: FIXTURE, relativePath: "tmp-fs-batch/a.bak", content: "x" });
    const dry = await deletePattern({ workspacePath: FIXTURE, pattern: "tmp-fs-batch/**/*.bak" });
    expect(dry.status).toBe("PASS");
    expect(dry.dryRun).toBe(true);
    expect(fs.existsSync(path.join(FIXTURE, "tmp-fs-batch/a.bak"))).toBe(true);
  });

  it("delete_pattern dryRun=false deletes", async () => {
    const del = await deletePattern({
      workspacePath: FIXTURE,
      pattern: "tmp-fs-batch/**/*.bak",
      dryRun: false,
    });
    expect(del.status).toBe("PASS");
    expect(fs.existsSync(path.join(FIXTURE, "tmp-fs-batch/a.bak"))).toBe(false);
  });
});
