#!/usr/bin/env node
/**
 * Runtime log helper for .mjs scripts (mirrors src/utils/runtimeLog.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const SECRET_PATTERNS = [
  [/\bsk-[A-Za-z0-9_-]{8,}\b/g, "sk-[REDACTED]"],
  [/\bapi[_-]?key\s*[=:]\s*[^\s&'"`,]+/gi, "api_key=[REDACTED]"],
  [/\btoken\s*[=:]\s*[^\s&'"`,]+/gi, "token=[REDACTED]"],
  [/\bpassword\s*[=:]\s*[^\s&'"`,]+/gi, "password=[REDACTED]"],
];

export function resolveRuntimeLogPath() {
  const parent = path.resolve(PROJECT_ROOT, "..");
  const parentVscode = path.join(parent, ".vscode", "mcp.json");
  const workspaceRoot = fs.existsSync(parentVscode) ? parent : PROJECT_ROOT;
  return path.join(workspaceRoot, ".dmctn", "runtime", "mcp-powershell-runner.log");
}

export const RUNTIME_LOG_PATH = resolveRuntimeLogPath();

export function sanitizeLogText(text) {
  if (!text) return "";
  let out = String(text);
  for (const [re, rep] of SECRET_PATTERNS) {
    out = out.replace(re, rep);
  }
  return out;
}

export function tailText(text, maxChars = 2000) {
  if (!text) return "";
  if (text.length <= maxChars) return text;
  return `...[truncated ${text.length - maxChars} chars]\n${text.slice(-maxChars)}`;
}

export function logRuntimeEvent(event) {
  try {
    const dir = path.dirname(RUNTIME_LOG_PATH);
    fs.mkdirSync(dir, { recursive: true });
    const line = {
      time: new Date().toISOString(),
      ...event,
      stdoutTail: event.stdoutTail ? sanitizeLogText(tailText(event.stdoutTail)) : undefined,
      stderrTail: event.stderrTail ? sanitizeLogText(tailText(event.stderrTail)) : undefined,
      args: event.args?.map((a) => sanitizeLogText(a)),
      command: event.command ? sanitizeLogText(event.command) : undefined,
      error: event.error ? sanitizeLogText(event.error) : undefined,
    };
    fs.appendFileSync(RUNTIME_LOG_PATH, JSON.stringify(line) + "\n", "utf8");
  } catch {
    // non-fatal
  }
}
