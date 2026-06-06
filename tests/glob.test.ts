import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { globToRegExp } from "../src/utils/globMatch.js";
import { globWorkspace } from "../src/tools/globWorkspace.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("globToRegExp", () => {
  it("matches ** across dirs", () => {
    expect(globToRegExp("**/*.ts").test("src/a/b/c.ts")).toBe(true);
    expect(globToRegExp("**/*.ts").test("a.js")).toBe(false);
  });
  it("matches brace groups", () => {
    const re = globToRegExp("**/*.{ts,tsx}");
    expect(re.test("src/x.tsx")).toBe(true);
    expect(re.test("src/x.ts")).toBe(true);
    expect(re.test("src/x.js")).toBe(false);
  });
  it("single * does not cross slash", () => {
    expect(globToRegExp("src/*.ts").test("src/a.ts")).toBe(true);
    expect(globToRegExp("src/*.ts").test("src/a/b.ts")).toBe(false);
  });
});

describe("glob_workspace", () => {
  it("finds TypeScript tool files", async () => {
    const r = await globWorkspace({ workspacePath: ROOT, pattern: "src/tools/*.ts" });
    expect(r.status).toBe("PASS");
    expect((r.count ?? 0)).toBeGreaterThan(10);
    expect(r.matches?.some((m) => m.endsWith("globWorkspace.ts"))).toBe(true);
  });
});
