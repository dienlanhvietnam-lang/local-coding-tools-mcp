import fs from "node:fs";
import { MAX_OUTPUT_CHARS, READ_DEFAULT_LINES } from "../config.js";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { estimateTokens } from "../utils/tokenEstimate.js";
import { pass, fail } from "../utils/result.js";

export interface EstimateToolOutputInput {
  workspacePath: string;
  toolName: string;
  relativePath?: string;
}

export async function estimateToolOutput(input: EstimateToolOutputInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;

  if (input.toolName === "read_workspace_file") {
    if (!input.relativePath) {
      return fail("relativePath is required to estimate read_workspace_file", { workspacePath });
    }
    try {
      const fullPath = assertWithinWorkspace(workspacePath, input.relativePath.replace(/\\/g, "/"));
      const stat = fs.statSync(fullPath);
      const text = fs.readFileSync(fullPath, "utf8");
      const totalLines = text.split(/\r?\n/).length;
      const estimatedTokens = estimateTokens(text);
      const exceedsLimit = text.length > MAX_OUTPUT_CHARS;
      const recommendation = exceedsLimit
        ? `File is large (${totalLines} lines, ~${estimatedTokens} tokens). Read with startLine + lineCount (e.g. lineCount=${READ_DEFAULT_LINES}) after searching, instead of the whole file.`
        : `File is small enough (~${estimatedTokens} tokens) to read fully.`;
      return pass({
        workspacePath,
        toolName: input.toolName,
        relativePath: input.relativePath,
        sizeBytes: stat.size,
        totalLines,
        estimatedTokens,
        exceedsLimit,
        recommendation,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(message, { workspacePath, toolName: input.toolName });
    }
  }

  return pass({
    workspacePath,
    toolName: input.toolName,
    estimatedTokens: null,
    recommendation:
      "Estimation is currently supported for read_workspace_file. For other tools, prefer narrow arguments and rely on truncation/cache hints in the result.",
  });
}
