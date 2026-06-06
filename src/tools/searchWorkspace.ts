import fs from "node:fs";
import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface SearchWorkspaceInput {
  workspacePath: string;
  pattern: string;
  relativeDir?: string;
  maxResults?: number;
  fileGlob?: string;
}

export interface SearchMatch {
  file: string;
  line: number;
  text: string;
  contextLines?: string;
  readHint?: string;
}

const CONTEXT_READ_LINES = 40;

export interface SearchWorkspaceOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  pattern?: string;
  matches?: SearchMatch[];
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

function shouldSearchFile(name: string, fileGlob?: string): boolean {
  if (!fileGlob) return true;
  const glob = fileGlob.replace(/\*/g, ".*").replace(/\./g, "\\.");
  return new RegExp(`^${glob}$`, "i").test(name);
}

function walkAndSearch(
  workspacePath: string,
  dir: string,
  regex: RegExp,
  fileGlob: string | undefined,
  maxResults: number
): { matches: SearchMatch[]; truncated: boolean } {
  const matches: SearchMatch[] = [];
  let truncated = false;

  function walk(currentRel: string): void {
    if (matches.length >= maxResults) {
      truncated = true;
      return;
    }

    const fullDir = assertWithinWorkspace(workspacePath, currentRel || ".");
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(fullDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches.length >= maxResults) {
        truncated = true;
        return;
      }

      const rel = path.join(currentRel, entry.name).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(rel);
      } else if (entry.isFile() && shouldSearchFile(entry.name, fileGlob)) {
        try {
          const fullPath = assertWithinWorkspace(workspacePath, rel);
          const content = fs.readFileSync(fullPath, "utf8");
          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (matches.length >= maxResults) {
              truncated = true;
              return;
            }
            if (regex.test(lines[i]!)) {
              const ctxStart = Math.max(0, i - 1);
              const ctxEnd = Math.min(lines.length, i + 2);
              const lineNo = i + 1;
              const readStart = Math.max(1, lineNo - 5);
              matches.push({
                file: rel,
                line: lineNo,
                text: lines[i]!.trim().slice(0, 500),
                contextLines: lines.slice(ctxStart, ctxEnd).join("\n").slice(0, 500),
                readHint: `read_workspace_file startLine=${readStart} lineCount=${CONTEXT_READ_LINES}`,
              });
            }
          }
        } catch {
          // skip unreadable
        }
      }
    }
  }

  walk(dir);
  return { matches, truncated };
}

export async function searchWorkspace(
  input: SearchWorkspaceInput
): Promise<SearchWorkspaceOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativeDir = (input.relativeDir ?? ".").replace(/\\/g, "/");
  const maxResults = input.maxResults ?? 50;

  let regex: RegExp;
  try {
    regex = new RegExp(input.pattern, "i");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(`Invalid regex: ${message}`);
  }

  try {
    assertWithinWorkspace(workspacePath, relativeDir);
    const { matches, truncated } = walkAndSearch(
      workspacePath,
      relativeDir,
      regex,
      input.fileGlob,
      maxResults
    );

    return pass({
      workspacePath,
      pattern: input.pattern,
      matches,
      count: matches.length,
      truncated,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath });
  }
}
