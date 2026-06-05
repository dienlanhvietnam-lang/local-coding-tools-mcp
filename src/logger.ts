import fs from "node:fs";
import path from "node:path";
import { TOOL_CALL_LOG_PATH } from "./config.js";

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
      throw err;
    });
}
