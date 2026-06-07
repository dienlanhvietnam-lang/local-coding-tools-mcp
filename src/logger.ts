import fs from "node:fs";
import path from "node:path";
import { TOOL_CALL_LOG_PATH } from "./config.js";
import { recordSearch, recordRead, recordToolSummary, recordFailure } from "./session/contextBank.js";
import { appendFailure } from "./session/projectMemory.js";

export type RiskLevel = "low" | "medium" | "high";

export interface ToolCallLogEntry {
  time: string;
  tool: string;
  status: string;
  durationMs: number;
  workspacePath?: string;
  riskLevel: RiskLevel;
  blocked: boolean;
  error?: string;
}

function ensureLogDir(): void {
  const dir = path.dirname(TOOL_CALL_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function logToolCall(entry: Omit<ToolCallLogEntry, "time">): void {
  try {
    ensureLogDir();
    const line: ToolCallLogEntry = {
      time: new Date().toISOString(),
      ...entry,
    };
    fs.appendFileSync(TOOL_CALL_LOG_PATH, JSON.stringify(line) + "\n", "utf8");
  } catch {
    // Logging must never crash the MCP server
  }
}

function recordToolFailure(
  toolName: string,
  workspacePath: string,
  result: unknown
): void {
  if (typeof result !== "object" || result === null) return;
  const r = result as Record<string, unknown>;
  const error =
    typeof r.error === "string"
      ? r.error
      : typeof r.reason === "string"
        ? r.reason
        : "tool failed";
  try {
    recordFailure(workspacePath, { tool: toolName, error });
    appendFailure(workspacePath, { tool: toolName, error, doNotRetry: true });
  } catch {
    // never break tools
  }
}

function updateSessionFromResult(
  toolName: string,
  workspacePath: string | undefined,
  status: string,
  result: unknown
): void {
  if (!workspacePath) return;
  if (status === "FAIL" || status === "BLOCKED") {
    recordToolFailure(toolName, workspacePath, result);
    return;
  }
  if (typeof result !== "object" || result === null) return;
  const r = result as Record<string, unknown>;
  try {
    if (toolName === "search_workspace" && Array.isArray(r.matches)) {
      const matches = r.matches as Array<{ file?: string }>;
      recordSearch(workspacePath, {
        query: typeof r.pattern === "string" ? r.pattern : "",
        count: typeof r.count === "number" ? r.count : matches.length,
        topFiles: matches.map((m) => m.file ?? "").filter(Boolean),
      });
    } else if (toolName === "semantic_search" && Array.isArray(r.results)) {
      const results = r.results as Array<{ file?: string }>;
      recordSearch(workspacePath, {
        query: typeof r.query === "string" ? r.query : "",
        count: results.length,
        topFiles: results.map((m) => m.file ?? "").filter(Boolean),
      });
    } else if (toolName === "read_workspace_file" && typeof r.relativePath === "string") {
      recordRead(workspacePath, {
        file: r.relativePath,
        startLine: typeof r.startLine === "number" ? r.startLine : undefined,
        endLine: typeof r.endLine === "number" ? r.endLine : undefined,
      });
    }
    if (typeof r.cacheId === "string" || typeof r.cacheUri === "string") {
      recordToolSummary(workspacePath, {
        tool: toolName,
        status,
        cacheRef: (r.cacheUri as string) ?? (r.cacheId as string),
      });
    }
  } catch {
    // session updates must never break a tool
  }
}

export function withToolLogging<T>(
  toolName: string,
  options: { workspacePath?: string; riskLevel: RiskLevel },
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  return fn()
    .then((result) => {
      const status =
        typeof result === "object" &&
        result !== null &&
        "status" in result &&
        typeof (result as { status: unknown }).status === "string"
          ? (result as { status: string }).status
          : "PASS";
      logToolCall({
        tool: toolName,
        status,
        durationMs: Date.now() - start,
        workspacePath: options.workspacePath,
        riskLevel: options.riskLevel,
        blocked: status === "BLOCKED",
      });
      updateSessionFromResult(toolName, options.workspacePath, status, result);
      return result;
    })
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      logToolCall({
        tool: toolName,
        status: "FAIL",
        durationMs: Date.now() - start,
        workspacePath: options.workspacePath,
        riskLevel: options.riskLevel,
        blocked: false,
        error: message,
      });
      if (options.workspacePath) {
        recordToolFailure(toolName, options.workspacePath, { error: message });
      }
      throw err;
    });
}
