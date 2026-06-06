import fs from "node:fs";
import { MAX_OUTPUT_CHARS, READ_DEFAULT_LINES, READ_MAX_LINES } from "../config.js";
import {
  assertWithinWorkspace,
  validateWorkspacePath,
} from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";
import { truncateStructured } from "../utils/truncateStructured.js";
import { stripContextBlocks } from "../utils/contextStrip.js";

export interface ReadWorkspaceFileInput {
  workspacePath: string;
  relativePath: string;
  maxChars?: number;
  startLine?: number;
  lineCount?: number;
  stripContext?: boolean;
}

export interface ReadWorkspaceFileOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  content?: string;
  truncated?: boolean;
  sizeBytes?: number;
  startLine?: number;
  endLine?: number;
  totalLines?: number;
  hint?: string;
  error?: string;
}

export async function readWorkspaceFile(
  input: ReadWorkspaceFileInput
): Promise<ReadWorkspaceFileOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");
  const maxChars = input.maxChars ?? MAX_OUTPUT_CHARS;
  const useLineRange =
    input.startLine !== undefined || input.lineCount !== undefined;

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      return fail("Path is a directory, not a file", { workspacePath, relativePath });
    }

    const fileText = fs.readFileSync(fullPath, "utf8");
    const raw = input.stripContext ? stripContextBlocks(fileText) : fileText;
    const allLines = raw.split(/\r?\n/);
    const totalLines = allLines.length;

    let content: string;
    let startLine: number | undefined;
    let endLine: number | undefined;
    let hint: string | undefined;

    if (useLineRange) {
      startLine = Math.max(1, input.startLine ?? 1);
      if (startLine > totalLines) {
        return fail(
          `startLine ${startLine} exceeds file length (${totalLines} lines)`,
          { workspacePath, relativePath, totalLines }
        );
      }
      const requested = input.lineCount ?? READ_DEFAULT_LINES;
      const lineCount = Math.min(Math.max(1, requested), READ_MAX_LINES);
      endLine = Math.min(totalLines, startLine + lineCount - 1);
      content = allLines.slice(startLine - 1, endLine).join("\n");
      if (endLine < totalLines) {
        hint = `Showing lines ${startLine}-${endLine} of ${totalLines}. Re-read with startLine=${endLine + 1} for more.`;
      }
    } else {
      content = raw;
      startLine = 1;
      endLine = totalLines;
    }

    const result = truncateStructured(content, maxChars, {
      mode: "head",
      hint: useLineRange
        ? "Line range still exceeds maxChars. Lower lineCount or raise maxChars."
        : `Full file exceeds maxChars. Use startLine + lineCount to page through ${totalLines} lines.`,
    });

    return pass({
      workspacePath,
      relativePath,
      content: result.text,
      truncated: result.truncated,
      sizeBytes: stat.size,
      startLine,
      endLine,
      totalLines,
      hint: result.truncated ? result.hint : hint,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
