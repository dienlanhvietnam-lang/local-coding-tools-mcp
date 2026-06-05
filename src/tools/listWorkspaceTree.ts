import fs from "node:fs";
import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface ListWorkspaceTreeInput {
  workspacePath: string;
  relativeDir?: string;
  maxDepth?: number;
  maxEntries?: number;
}

export interface TreeEntry {
  path: string;
  type: "file" | "directory";
  size?: number;
}

export interface ListWorkspaceTreeOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  entries?: TreeEntry[];
  count?: number;
  truncated?: boolean;
  error?: string;
}

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".mcp-debug",
]);

export async function listWorkspaceTree(
  input: ListWorkspaceTreeInput
): Promise<ListWorkspaceTreeOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativeDir = (input.relativeDir ?? ".").replace(/\\/g, "/");
  const maxDepth = input.maxDepth ?? 4;
  const maxEntries = input.maxEntries ?? 200;

  const entries: TreeEntry[] = [];
  let truncated = false;

  function walk(currentRel: string, depth: number): void {
    if (entries.length >= maxEntries || depth > maxDepth) {
      truncated = true;
      return;
    }

    const fullDir = assertWithinWorkspace(workspacePath, currentRel || ".");
    let items: fs.Dirent[];
    try {
      items = fs.readdirSync(fullDir, { withFileTypes: true });
    } catch {
      return;
    }

    items.sort((a, b) => a.name.localeCompare(b.name));

    for (const item of items) {
      if (entries.length >= maxEntries) {
        truncated = true;
        return;
      }

      const rel = path.join(currentRel, item.name).replace(/\\/g, "/");
      if (item.isDirectory()) {
        entries.push({ path: rel, type: "directory" });
        if (!SKIP_DIRS.has(item.name) && depth < maxDepth) {
          walk(rel, depth + 1);
        }
      } else if (item.isFile()) {
        let size: number | undefined;
        try {
          size = fs.statSync(assertWithinWorkspace(workspacePath, rel)).size;
        } catch {
          // ignore
        }
        entries.push({ path: rel, type: "file", size });
      }
    }
  }

  try {
    assertWithinWorkspace(workspacePath, relativeDir);
    walk(relativeDir, 0);
    return pass({
      workspacePath,
      entries,
      count: entries.length,
      truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }
}
