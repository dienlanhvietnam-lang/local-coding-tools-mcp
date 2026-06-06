import { describe, it, expect, afterAll } from "vitest";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { editNotebook } from "../src/tools/editNotebook.js";
import { todoWrite, todoRead } from "../src/tools/todoStore.js";
import { semanticSearch } from "../src/tools/semanticSearch.js";

describe("edit_notebook", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-nb-"));
  afterAll(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } });

  it("inserts, replaces, deletes cells", async () => {
    const nb = path.join(tmp, "n.ipynb");
    fs.writeFileSync(nb, JSON.stringify({ cells: [], metadata: {}, nbformat: 4, nbformat_minor: 5 }));

    const ins = await editNotebook({ workspacePath: tmp, relativePath: "n.ipynb", operation: "insert", cellIndex: 0, cellType: "code", source: "print(1)" });
    expect(ins.status).toBe("PASS");
    expect(ins.cellCount).toBe(1);

    const rep = await editNotebook({ workspacePath: tmp, relativePath: "n.ipynb", operation: "replace", cellIndex: 0, source: "print(2)" });
    expect(rep.status).toBe("PASS");

    const del = await editNotebook({ workspacePath: tmp, relativePath: "n.ipynb", operation: "delete", cellIndex: 0 });
    expect(del.status).toBe("PASS");
    expect(del.cellCount).toBe(0);
  });

  it("rejects non-ipynb", async () => {
    const r = await editNotebook({ workspacePath: tmp, relativePath: "x.txt", operation: "delete", cellIndex: 0 });
    expect(r.status).toBe("FAIL");
  });
});

describe("todo store", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-todo-"));
  afterAll(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } });

  it("write then read", async () => {
    const w = await todoWrite({ workspacePath: tmp, todos: [{ id: "1", content: "do x", status: "pending" }] });
    expect(w.status).toBe("PASS");
    const r = await todoRead({ workspacePath: tmp });
    expect(r.status).toBe("PASS");
    expect(r.count).toBe(1);
  });

  it("merge updates by id", async () => {
    await todoWrite({ workspacePath: tmp, todos: [{ id: "1", content: "do x", status: "pending" }] });
    const m = await todoWrite({ workspacePath: tmp, todos: [{ id: "1", content: "do x", status: "completed" }], merge: true });
    expect(m.todos?.[0].status).toBe("completed");
  });

  it("rejects invalid status", async () => {
    const r = await todoWrite({ workspacePath: tmp, todos: [{ id: "1", content: "x", status: "bogus" as never }] });
    expect(r.status).toBe("FAIL");
  });
});

describe("semantic_search", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mcp-sem-"));
  afterAll(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ } });

  it("keyword fallback finds file (no embedding key)", async () => {
    const hadKey = process.env.OPENAI_API_KEY || process.env.VOYAGE_API_KEY;
    if (hadKey) return; // skip when key present
    fs.writeFileSync(path.join(tmp, "auth.ts"), "export function loginUser() { return true; }\n");
    const r = await semanticSearch({ workspacePath: tmp, query: "loginUser auth", maxResults: 5 });
    expect(r.status).toBe("PASS");
    expect(r.provider).toBe("keyword-fallback");
  });
});
