import fs from "node:fs";
import path from "node:path";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface ApplyPatchInput {
  workspacePath: string;
  relativePath: string;
  /** Exact text to find (must be unique unless replaceAll=true) */
  oldText: string;
  /** Replacement text */
  newText: string;
  /** Replace all occurrences (default: first only, must be unique) */
  replaceAll?: boolean;
}

export interface ApplyPatchOutput {
  status: "PASS" | "FAIL" | "BLOCKED";
  workspacePath?: string;
  relativePath?: string;
  replacements?: number;
  bytesWritten?: number;
  error?: string;
}

export async function applyPatch(input: ApplyPatchInput): Promise<ApplyPatchOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return fail(`File not found: ${relativePath}`, { workspacePath, relativePath });
    }

    const content = fs.readFileSync(fullPath, "utf8");
    const occurrences = countOccurrences(content, input.oldText);

    if (occurrences === 0) {
      return fail("oldText not found in file", { workspacePath, relativePath });
    }

    if (!input.replaceAll && occurrences > 1) {
      return fail(
        `oldText matches ${occurrences} locations — set replaceAll=true or provide more specific oldText`,
        { workspacePath, relativePath }
      );
    }

    const updated = input.replaceAll
      ? content.split(input.oldText).join(input.newText)
      : content.replace(input.oldText, input.newText);

    fs.writeFileSync(fullPath, updated, "utf8");

    return pass({
      workspacePath,
      relativePath,
      replacements: input.replaceAll ? occurrences : 1,
      bytesWritten: Buffer.byteLength(updated, "utf8"),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
}
