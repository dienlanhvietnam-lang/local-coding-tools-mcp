import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { redactSecrets } from "../safety/secretRedactor.js";
import { storeLargeOutput } from "../cache/outputCache.js";

const OUTPUT_DIR_REL = ".mcp-debug/command-output";
const LATEST_REL = `${OUTPUT_DIR_REL}/latest.json`;
const MAX_STREAM_CHARS = 2_000_000;

export interface CommandOutputRecord {
  id: string;
  recordedAt: string;
  tool: "run_project_script" | "run_safe_command";
  script?: string;
  command?: string;
  args?: string[];
  projectSubdir?: string;
  exitCode: number | null;
  timedOut?: boolean;
  truncated: boolean;
  stdoutChars: number;
  stderrChars: number;
  relativePath: string;
  cacheId?: string;
  cacheUri?: string;
}

export interface SaveCommandOutputInput {
  workspacePath: string;
  tool: CommandOutputRecord["tool"];
  script?: string;
  command?: string;
  args?: string[];
  projectSubdir?: string;
  exitCode: number | null;
  timedOut?: boolean;
  truncated: boolean;
  stdout: string;
  stderr: string;
}

function capStream(text: string): { text: string; capped: boolean } {
  if (text.length <= MAX_STREAM_CHARS) return { text, capped: false };
  return {
    text: text.slice(0, MAX_STREAM_CHARS) + `\n...[capped at ${MAX_STREAM_CHARS} chars]`,
    capped: true,
  };
}

export function saveCommandOutput(input: SaveCommandOutputInput): CommandOutputRecord {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    throw new Error(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;

  const stdout = redactSecrets(input.stdout);
  const stderr = redactSecrets(input.stderr);
  const out = capStream(stdout);
  const err = capStream(stderr);

  const id = randomUUID();
  const relativePath = `${OUTPUT_DIR_REL}/${id}.json`;
  const absPath = assertWithinWorkspace(workspacePath, relativePath);

  const payload = {
    id,
    recordedAt: new Date().toISOString(),
    tool: input.tool,
    script: input.script,
    command: input.command,
    args: input.args,
    projectSubdir: input.projectSubdir,
    exitCode: input.exitCode,
    timedOut: input.timedOut,
    truncated: input.truncated || out.capped || err.capped,
    stdout: out.text,
    stderr: err.text,
    stdoutChars: stdout.length,
    stderrChars: stderr.length,
  };

  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  const serialized = JSON.stringify(payload, null, 2);
  fs.writeFileSync(absPath, serialized, "utf8");

  let cacheId: string | undefined;
  let cacheUri: string | undefined;
  if (input.truncated || serialized.length > 8_000) {
    const stored = storeLargeOutput(workspacePath, serialized, {
      toolName: input.tool,
      previewChars: 600,
    });
    cacheId = stored.id;
    cacheUri = stored.uri;
  }

  const record: CommandOutputRecord = {
    id,
    recordedAt: payload.recordedAt,
    tool: input.tool,
    script: input.script,
    command: input.command,
    args: input.args,
    projectSubdir: input.projectSubdir,
    exitCode: input.exitCode,
    timedOut: input.timedOut,
    truncated: payload.truncated,
    stdoutChars: payload.stdoutChars,
    stderrChars: payload.stderrChars,
    relativePath,
    cacheId,
    cacheUri,
  };

  const latestPath = assertWithinWorkspace(workspacePath, LATEST_REL);
  fs.writeFileSync(latestPath, JSON.stringify(record, null, 2), "utf8");

  return record;
}

export function readCommandOutputFile(
  workspacePath: string,
  outputId?: string
): { record: CommandOutputRecord; payload: { stdout: string; stderr: string } } | null {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) return null;
  const root = validation.resolvedPath!;

  let rel: string;
  if (outputId) {
    if (!/^[0-9a-fA-F-]{36}$/.test(outputId)) return null;
    rel = `${OUTPUT_DIR_REL}/${outputId}.json`;
  } else {
    const latestPath = path.join(root, LATEST_REL);
    if (!fs.existsSync(latestPath)) return null;
    const latest = JSON.parse(fs.readFileSync(latestPath, "utf8")) as CommandOutputRecord;
    rel = latest.relativePath;
  }

  const absPath = path.join(root, rel.replace(/\//g, path.sep));
  if (!fs.existsSync(absPath)) return null;

  const payload = JSON.parse(fs.readFileSync(absPath, "utf8")) as {
    stdout: string;
    stderr: string;
    id: string;
    recordedAt: string;
    tool: CommandOutputRecord["tool"];
    script?: string;
    command?: string;
    args?: string[];
    projectSubdir?: string;
    exitCode: number | null;
    timedOut?: boolean;
    truncated: boolean;
    stdoutChars: number;
    stderrChars: number;
  };

  const record: CommandOutputRecord = {
    id: payload.id,
    recordedAt: payload.recordedAt,
    tool: payload.tool,
    script: payload.script,
    command: payload.command,
    args: payload.args,
    projectSubdir: payload.projectSubdir,
    exitCode: payload.exitCode,
    timedOut: payload.timedOut,
    truncated: payload.truncated,
    stdoutChars: payload.stdoutChars,
    stderrChars: payload.stderrChars,
    relativePath: rel.replace(/\\/g, "/"),
  };

  return { record, payload: { stdout: payload.stdout, stderr: payload.stderr } };
}

export function sliceLines(
  text: string,
  startLine = 1,
  lineCount?: number
): { text: string; startLine: number; endLine: number; totalLines: number; truncated: boolean } {
  const lines = text.split(/\r?\n/);
  const totalLines = lines.length;
  const start = Math.max(1, startLine);
  const maxLines = lineCount ?? lines.length;
  const slice = lines.slice(start - 1, start - 1 + maxLines);
  const endLine = start - 1 + slice.length;
  return {
    text: slice.join("\n"),
    startLine: start,
    endLine,
    totalLines,
    truncated: endLine < totalLines,
  };
}
