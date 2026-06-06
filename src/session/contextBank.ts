import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";

const SESSION_REL = ".mcp-debug/session.json";
const MAX_SEARCHES = 10;
const MAX_READS = 30;
const MAX_SUMMARIES = 50;

export interface RecordedSearch {
  query: string;
  count: number;
  topFiles: string[];
  at: string;
}

export interface RecordedRead {
  file: string;
  startLine?: number;
  endLine?: number;
  at: string;
}

export interface RecordedToolSummary {
  tool: string;
  status: string;
  cacheRef?: string;
  at: string;
}

export interface SessionContext {
  sessionId: string;
  lastSearches: RecordedSearch[];
  lastReads: RecordedRead[];
  toolSummaries: RecordedToolSummary[];
  updatedAt: string;
}

function emptySession(): SessionContext {
  return {
    sessionId: randomUUID(),
    lastSearches: [],
    lastReads: [],
    toolSummaries: [],
    updatedAt: new Date().toISOString(),
  };
}

function sessionPath(workspacePath: string): string | null {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) return null;
  try {
    return assertWithinWorkspace(validation.resolvedPath!, SESSION_REL);
  } catch {
    return null;
  }
}

export function loadSession(workspacePath: string): SessionContext {
  const p = sessionPath(workspacePath);
  if (!p || !fs.existsSync(p)) return emptySession();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<SessionContext>;
    return {
      sessionId: parsed.sessionId ?? randomUUID(),
      lastSearches: parsed.lastSearches ?? [],
      lastReads: parsed.lastReads ?? [],
      toolSummaries: parsed.toolSummaries ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptySession();
  }
}

function saveSession(workspacePath: string, session: SessionContext): void {
  const p = sessionPath(workspacePath);
  if (!p) return;
  try {
    session.updatedAt = new Date().toISOString();
    fs.mkdirSync(p.replace(/[/\\][^/\\]*$/, ""), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(session), "utf8");
  } catch {
    // session updates must never break a tool
  }
}

export function recordSearch(
  workspacePath: string,
  search: { query: string; count: number; topFiles: string[] }
): void {
  const session = loadSession(workspacePath);
  session.lastSearches.unshift({
    query: search.query,
    count: search.count,
    topFiles: search.topFiles.slice(0, 5),
    at: new Date().toISOString(),
  });
  session.lastSearches = session.lastSearches.slice(0, MAX_SEARCHES);
  saveSession(workspacePath, session);
}

export function recordRead(
  workspacePath: string,
  read: { file: string; startLine?: number; endLine?: number }
): void {
  const session = loadSession(workspacePath);
  session.lastReads.unshift({
    file: read.file,
    startLine: read.startLine,
    endLine: read.endLine,
    at: new Date().toISOString(),
  });
  session.lastReads = session.lastReads.slice(0, MAX_READS);
  saveSession(workspacePath, session);
}

export function recordToolSummary(
  workspacePath: string,
  summary: { tool: string; status: string; cacheRef?: string }
): void {
  const session = loadSession(workspacePath);
  session.toolSummaries.unshift({
    tool: summary.tool,
    status: summary.status,
    cacheRef: summary.cacheRef,
    at: new Date().toISOString(),
  });
  session.toolSummaries = session.toolSummaries.slice(0, MAX_SUMMARIES);
  saveSession(workspacePath, session);
}

export function clearSession(workspacePath: string): boolean {
  const p = sessionPath(workspacePath);
  if (!p) return false;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}
