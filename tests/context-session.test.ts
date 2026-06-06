import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  recordSearch,
  recordRead,
  loadSession,
  clearSession,
} from "../src/session/contextBank.js";
import { getSessionContext, clearSessionContext } from "../src/tools/sessionContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.resolve(__dirname, "fixtures/sample-project");

afterEach(() => {
  clearSession(FIXTURE);
});

describe("contextBank session store", () => {
  it("persists searches and reads", () => {
    recordSearch(FIXTURE, { query: "config", count: 3, topFiles: ["a.ts", "b.ts"] });
    recordRead(FIXTURE, { file: "src/server.ts", startLine: 1, endLine: 80 });

    const session = loadSession(FIXTURE);
    expect(session.lastSearches[0]!.query).toBe("config");
    expect(session.lastSearches[0]!.topFiles).toContain("a.ts");
    expect(session.lastReads[0]!.file).toBe("src/server.ts");
    expect(session.lastReads[0]!.endLine).toBe(80);
  });

  it("writes a session.json under .mcp-debug", () => {
    recordSearch(FIXTURE, { query: "x", count: 1, topFiles: [] });
    const p = path.join(FIXTURE, ".mcp-debug", "session.json");
    expect(fs.existsSync(p)).toBe(true);
  });
});

describe("get/clear_session_context tools", () => {
  it("get_session_context reflects recorded activity", async () => {
    recordSearch(FIXTURE, { query: "needle", count: 2, topFiles: ["x.ts"] });
    const r = await getSessionContext({ workspacePath: FIXTURE });
    expect(r.status).toBe("PASS");
    expect(r.recentSearches[0]!.query).toBe("needle");
    expect(r.hint).toBeTruthy();
  });

  it("clear_session_context removes the session", async () => {
    recordRead(FIXTURE, { file: "y.ts" });
    const cleared = await clearSessionContext({ workspacePath: FIXTURE });
    expect(cleared.status).toBe("PASS");
    const session = loadSession(FIXTURE);
    expect(session.lastReads.length).toBe(0);
  });
});
