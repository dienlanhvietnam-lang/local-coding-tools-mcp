import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../config.js";

export const RUNTIME_LOG_PATH = resolveRuntimeLogPath();

function resolveRuntimeLogPath(workspacePath?: string): string {
  if (workspacePath) {
    return path.join(path.resolve(workspacePath), ".dmctn", "runtime", "mcp-powershell-runner.log");
  }
  const parent = path.resolve(PROJECT_ROOT, "..");
  const parentVscode = path.join(parent, ".vscode", "mcp.json");
  const workspaceRoot = fs.existsSync(parentVscode) ? parent : PROJECT_ROOT;
  return path.join(workspaceRoot, ".dmctn", "runtime", "mcp-powershell-runner.log");
}

export function sanitizeLogText(text: string): string {
  return text;
}

export function tailText(text: string, maxChars = 2000): string {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `...[truncated ${text.length - maxChars} chars]\n${text.slice(-maxChars)}`;
}

export interface RuntimeLogEvent {
  kind: string;
  command?: string;
  args?: string[];
  cwd?: string;
  shell?: string;
  startTime?: string;
  endTime?: string;
  durationMs?: number;
  exitCode?: number | null;
  signal?: string | null;
  status?: string;
  stdoutTail?: string;
  stderrTail?: string;
  timeoutMs?: number;
  cancelReason?: string;
  error?: string;
}

function ensureLogDir(logPath: string): void {
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function logRuntimeEvent(event: RuntimeLogEvent, workspacePath?: string): void {
  try {
    const logPath = resolveRuntimeLogPath(workspacePath);
    ensureLogDir(logPath);
    const line = {
      time: new Date().toISOString(),
      ...event,
      stdoutTail: event.stdoutTail ? sanitizeLogText(tailText(event.stdoutTail)) : undefined,
      stderrTail: event.stderrTail ? sanitizeLogText(tailText(event.stderrTail)) : undefined,
      args: event.args?.map((a) => sanitizeLogText(a)),
      command: event.command ? sanitizeLogText(event.command) : undefined,
      error: event.error ? sanitizeLogText(event.error) : undefined,
    };
    fs.appendFileSync(logPath, JSON.stringify(line) + "\n", "utf8");
  } catch {
    // logging must never crash callers
  }
}
