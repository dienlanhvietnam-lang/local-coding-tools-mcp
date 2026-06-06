import fs from "node:fs";
import { TOOL_CALL_LOG_PATH } from "../config.js";
import { loadSession } from "../session/contextBank.js";
import { pass } from "../utils/result.js";

export interface SummarizeToolHistoryInput {
  workspacePath: string;
  limit?: number;
}

interface LogLine {
  time?: string;
  tool?: string;
  status?: string;
  durationMs?: number;
}

function readRecentLog(limit: number): LogLine[] {
  try {
    const raw = fs.readFileSync(TOOL_CALL_LOG_PATH, "utf8");
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const tail = lines.slice(-limit);
    const out: LogLine[] = [];
    for (const l of tail) {
      try {
        out.push(JSON.parse(l) as LogLine);
      } catch {
        // skip malformed line
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function summarizeToolHistory(input: SummarizeToolHistoryInput) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 200);
  const recent = readRecentLog(limit);

  const byTool: Record<string, { calls: number; fails: number }> = {};
  for (const entry of recent) {
    const tool = entry.tool ?? "unknown";
    byTool[tool] ??= { calls: 0, fails: 0 };
    byTool[tool].calls++;
    if (entry.status === "FAIL") byTool[tool].fails++;
  }

  const session = loadSession(input.workspacePath);

  return pass({
    workspacePath: input.workspacePath,
    callsSummarized: recent.length,
    byTool,
    recent: recent.map((e) => ({
      tool: e.tool,
      status: e.status,
      durationMs: e.durationMs,
      time: e.time,
    })),
    sessionCacheRefs: session.toolSummaries.filter((s) => s.cacheRef).length,
    hint: "Use this instead of re-reading raw tool output. Fetch full payloads via fetch_cached_output when a cacheRef exists.",
  });
}
