import fs from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  ".mcp-debug",
]);

/** Convert a glob pattern to a RegExp. Supports **, *, ?, and {a,b} groups. */
export function globToRegExp(glob: string): RegExp {
  const normalized = glob.replace(/\\/g, "/");
  let re = "";
  let i = 0;
  while (i < normalized.length) {
    const c = normalized[i];
    if (c === "*") {
      if (normalized[i + 1] === "*") {
        // ** matches across path separators
        if (normalized[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 3;
        } else {
          re += ".*";
          i += 2;
        }
        continue;
      }
      re += "[^/]*";
      i += 1;
      continue;
    }
    if (c === "?") {
      re += "[^/]";
      i += 1;
      continue;
    }
    if (c === "{") {
      const end = normalized.indexOf("}", i);
      if (end !== -1) {
        const group = normalized.slice(i + 1, end).split(",").map(escapeRe).join("|");
        re += `(?:${group})`;
        i = end + 1;
        continue;
      }
    }
    re += escapeRe(c);
    i += 1;
  }
  return new RegExp(`^${re}$`, "i");
}

function escapeRe(s: string): string {
  return s.replace(/[.+^${}()|[\]\\]/g, "\\$&");
}

export interface GlobOptions {
  cwd: string;
  maxResults?: number;
  includeDirs?: boolean;
}

/** Walk cwd and return relative POSIX paths matching the glob pattern. */
export function globFiles(pattern: string, options: GlobOptions): { matches: string[]; truncated: boolean } {
  const { cwd, maxResults = 1000, includeDirs = false } = options;
  const regex = globToRegExp(pattern);
  const matches: string[] = [];
  let truncated = false;

  const walk = (dir: string): void => {
    if (truncated) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const abs = path.join(dir, entry.name);
      const rel = path.relative(cwd, abs).replace(/\\/g, "/");
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        if (includeDirs && regex.test(rel)) {
          matches.push(rel);
          if (matches.length >= maxResults) { truncated = true; return; }
        }
        walk(abs);
      } else if (entry.isFile()) {
        if (regex.test(rel)) {
          matches.push(rel);
          if (matches.length >= maxResults) { truncated = true; return; }
        }
      }
    }
  };

  walk(cwd);
  return { matches, truncated };
}
