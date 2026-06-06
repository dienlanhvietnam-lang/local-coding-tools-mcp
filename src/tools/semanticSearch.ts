import fs from "node:fs";
import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface SemanticSearchInput {
  workspacePath: string;
  query: string;
  relativeDir?: string;
  maxResults?: number;
  fileGlob?: string;
}

export interface SemanticHit {
  file: string;
  score: number;
  snippet: string;
  startLine?: number;
  endLine?: number;
  readHint?: string;
}

export interface SemanticSearchOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  query?: string;
  provider?: string;
  results?: SemanticHit[];
  error?: string;
  reason?: string;
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "coverage", ".mcp-debug"]);
const CODE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".md", ".json", ".txt"]);
const MAX_FILES = 400;
const MAX_FILE_BYTES = 200_000;

function collectFiles(dir: string, base: string, out: string[]): void {
  if (out.length >= MAX_FILES) return;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      collectFiles(abs, base, out);
    } else if (e.isFile() && CODE_EXT.has(path.extname(e.name).toLowerCase())) {
      out.push(abs);
    }
  }
}

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9_]{2,}/g) ?? []);
}

/** Embedding-based search if API key present; else TF-style keyword fallback (degraded). */
export async function semanticSearch(input: SemanticSearchInput): Promise<SemanticSearchOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;
  const query = input.query?.trim();
  if (!query) return fail("query is required", { workspacePath });

  const maxResults = Math.min(Math.max(input.maxResults ?? 8, 1), 30);

  const hasEmbeddingKey =
    Boolean(process.env.OPENAI_API_KEY?.trim()) || Boolean(process.env.VOYAGE_API_KEY?.trim());

  if (!hasEmbeddingKey) {
    // Degraded keyword-similarity fallback (not true semantic).
    const baseDir = input.relativeDir
      ? assertWithinWorkspace(workspacePath, input.relativeDir.replace(/\\/g, "/"))
      : workspacePath;
    const files: string[] = [];
    collectFiles(baseDir, workspacePath, files);

    const qTokens = new Set(tokenize(query));
    if (qTokens.size === 0) {
      return skipped("empty_query_tokens", {
        workspacePath,
        reason: "No embedding key (OPENAI_API_KEY/VOYAGE_API_KEY) and query has no searchable tokens",
      });
    }

    const hits: SemanticHit[] = [];
    for (const abs of files) {
      let content: string;
      try {
        const stat = fs.statSync(abs);
        if (stat.size > MAX_FILE_BYTES) continue;
        content = fs.readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const tokens = tokenize(content);
      if (tokens.length === 0) continue;
      let overlap = 0;
      const tokenSet = new Set(tokens);
      for (const q of qTokens) if (tokenSet.has(q)) overlap++;
      if (overlap === 0) continue;
      const score = overlap / qTokens.size;
      const firstLineIdx = content.split("\n").findIndex((l) =>
        [...qTokens].some((q) => l.toLowerCase().includes(q))
      );
      const lines = content.split("\n");
      const start = Math.max(0, firstLineIdx);
      const snippet = lines.slice(start, start + 3).join("\n").slice(0, 240);
      const startLine = start + 1;
      const endLine = Math.min(lines.length, start + 3);
      const readStart = Math.max(1, startLine - 5);
      hits.push({
        file: path.relative(workspacePath, abs).replace(/\\/g, "/"),
        score,
        snippet,
        startLine,
        endLine,
        readHint: `read_workspace_file startLine=${readStart} lineCount=40`,
      });
    }

    hits.sort((a, b) => b.score - a.score);
    return pass({
      workspacePath,
      query,
      provider: "keyword-fallback",
      results: hits.slice(0, maxResults),
    });
  }

  // With an embedding key, a full vector index would be built here.
  // Indexing infra is out of scope for this phase; report SKIPPED with guidance
  // so the tool degrades predictably rather than doing expensive work silently.
  return skipped("embedding_index_not_built", {
    workspacePath,
    query,
    reason:
      "Embedding key detected but vector index not built in this version. Use search_workspace (regex) or the keyword fallback by unsetting the key.",
  });
}
