import fs from "node:fs";
import path from "node:path";
import { MAX_OUTPUT_CHARS, READ_MAX_LINES } from "../config.js";
import { readCache, readCacheFromWorkspace } from "../cache/outputCache.js";
import { validateWorkspacePath, assertWithinWorkspace } from "../safety/pathGuard.js";
import {
  readCommandOutputFile,
  sliceLines,
  type CommandOutputRecord,
} from "../utils/commandOutputStore.js";
import { pass, fail } from "../utils/result.js";
import { truncateStructured } from "../utils/truncateStructured.js";

export interface ReadCommandOutputInput {
  workspacePath: string;
  source?: "last" | "output" | "runtime" | "cache";
  outputId?: string;
  cacheId?: string;
  stream?: "stdout" | "stderr" | "both";
  startLine?: number;
  lineCount?: number;
  maxChars?: number;
  tailLines?: number;
}

function pickStream(
  payload: { stdout: string; stderr: string },
  stream: "stdout" | "stderr" | "both"
): string {
  if (stream === "stdout") return payload.stdout;
  if (stream === "stderr") return payload.stderr;
  const parts: string[] = [];
  if (payload.stdout) parts.push(`--- stdout ---\n${payload.stdout}`);
  if (payload.stderr) parts.push(`--- stderr ---\n${payload.stderr}`);
  return parts.join("\n\n");
}

function readRuntimeLog(workspacePath: string, tailLines?: number): string | null {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) return null;
  const logPath = assertWithinWorkspace(
    validation.resolvedPath!,
    ".dmctn/runtime/mcp-powershell-runner.log"
  );
  if (!fs.existsSync(logPath)) return null;
  const raw = fs.readFileSync(logPath, "utf8").trim();
  if (!raw) return "";
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const slice = tailLines && tailLines > 0 ? lines.slice(-tailLines) : lines;
  return slice
    .map((line) => {
      try {
        const evt = JSON.parse(line) as Record<string, unknown>;
        const parts = [
          evt.time,
          evt.kind,
          evt.command,
          evt.status ?? evt.exitCode,
        ].filter(Boolean);
        let out = parts.join(" | ");
        if (typeof evt.stderrTail === "string" && evt.stderrTail) {
          out += `\nstderr: ${evt.stderrTail}`;
        }
        if (typeof evt.stdoutTail === "string" && evt.stdoutTail) {
          out += `\nstdout: ${evt.stdoutTail}`;
        }
        if (typeof evt.error === "string" && evt.error) {
          out += `\nerror: ${evt.error}`;
        }
        return out;
      } catch {
        return line;
      }
    })
    .join("\n---\n");
}

export async function readCommandOutput(input: ReadCommandOutputInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const source = input.source ?? "last";
  const stream = input.stream ?? "both";
  const maxChars = input.maxChars ?? MAX_OUTPUT_CHARS;
  const lineCount = Math.min(input.lineCount ?? READ_MAX_LINES, READ_MAX_LINES);

  let record: CommandOutputRecord | undefined;
  let text = "";

  if (source === "runtime") {
    const runtime = readRuntimeLog(input.workspacePath, input.tailLines ?? 50);
    if (runtime === null) {
      return fail("Runtime log not found", {
        hint: "Run a command via run_project_script or run_safe_command first.",
        logPath: ".dmctn/runtime/mcp-powershell-runner.log",
      });
    }
    text = runtime;
  } else if (source === "cache") {
    const cacheId = input.cacheId?.trim();
    if (!cacheId) return fail("cacheId is required when source=cache");
    const raw = readCache(cacheId)?.content ?? readCacheFromWorkspace(input.workspacePath, cacheId);
    if (!raw) return fail("Cache entry not found or expired", { cacheId });
    try {
      const parsed = JSON.parse(raw) as { stdout?: string; stderr?: string };
      text = pickStream(
        { stdout: parsed.stdout ?? "", stderr: parsed.stderr ?? "" },
        stream
      );
    } catch {
      text = raw;
    }
  } else {
    const outputId = source === "output" ? input.outputId : input.outputId;
    const loaded = readCommandOutputFile(input.workspacePath, outputId);
    if (!loaded) {
      return fail("No saved command output found", {
        hint: "Run run_project_script first. Full output is saved when truncated.",
        expectedPath: ".mcp-debug/command-output/latest.json",
      });
    }
    record = loaded.record;
    text = pickStream(loaded.payload, stream);
  }

  if (input.tailLines && source !== "runtime") {
    const lines = text.split(/\r?\n/);
    text = lines.slice(-input.tailLines).join("\n");
  } else if (input.startLine) {
    const sliced = sliceLines(text, input.startLine, lineCount);
    text = sliced.text;
  }

  const truncatedResult = truncateStructured(text, maxChars, {
    mode: "head_tail",
    hint: "Use startLine/lineCount or raise maxChars. For full saved output use outputId from run_project_script.",
  });

  return pass({
    source,
    stream,
    outputId: record?.id,
    cacheId: record?.cacheId,
    outputPath: record?.relativePath,
    script: record?.script,
    command: record?.command,
    exitCode: record?.exitCode,
    truncated: truncatedResult.truncated,
    originalChars: truncatedResult.originalChars,
    returnedChars: truncatedResult.returnedChars,
    content: truncatedResult.text,
    hint: truncatedResult.hint,
  });
}
