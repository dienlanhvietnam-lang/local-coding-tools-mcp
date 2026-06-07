import path from "node:path";
import fs from "node:fs";
import { describe, expect, it, afterEach } from "vitest";
import { readProjectMemory } from "../src/tools/readProjectMemory.js";
import { writeProjectMemory } from "../src/tools/writeProjectMemory.js";
import { getSessionContext } from "../src/tools/sessionContext.js";

const FIXTURE = path.resolve("tests/fixtures/sample-project");
const MEMORY_FILE = path.join(FIXTURE, ".mcp-debug", "project-memory.json");

afterEach(() => {
  if (fs.existsSync(MEMORY_FILE)) fs.unlinkSync(MEMORY_FILE);
});

describe("project memory", () => {
  it("write and read lesson + failure", async () => {
    const w1 = await writeProjectMemory({
      workspacePath: FIXTURE,
      action: "append_lesson",
      lesson: "Always run npm test before commit",
      task: "memory-test",
    });
    expect(w1.status).toBe("PASS");

    const w2 = await writeProjectMemory({
      workspacePath: FIXTURE,
      action: "append_failure",
      tool: "run_project_script",
      error: "test script missing",
      doNotRetry: true,
    });
    expect(w2.status).toBe("PASS");

    const r = await readProjectMemory({ workspacePath: FIXTURE });
    expect(r.status).toBe("PASS");
    expect(r.lessons?.[0]?.lesson).toContain("npm test");
    expect(r.failedAttempts?.[0]?.tool).toBe("run_project_script");
  });

  it("get_session_context includes projectMemory summary", async () => {
    await writeProjectMemory({
      workspacePath: FIXTURE,
      action: "add_convention",
      convention: "Use vitest for unit tests",
    });
    const ctx = await getSessionContext({ workspacePath: FIXTURE });
    expect(ctx.status).toBe("PASS");
    expect(ctx.projectMemory?.conventionCount).toBeGreaterThan(0);
    expect(ctx.hint).toContain("MEMORY_LOOP");
  });
});
