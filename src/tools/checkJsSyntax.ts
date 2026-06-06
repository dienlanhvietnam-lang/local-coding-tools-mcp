import path from "node:path";
import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { runCommand } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface CheckJsSyntaxInput {
  workspacePath: string;
  relativePath: string;
  timeoutMs?: number;
}

export interface CheckJsSyntaxOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  relativePath?: string;
  engine?: string;
  exitCode?: number | null;
  output?: string;
  error?: string;
  reason?: string;
}

const JS_EXT = new Set([".js", ".mjs", ".cjs"]);
const TS_EXT = new Set([".ts", ".tsx", ".mts", ".cts"]);

export async function checkJsSyntax(
  input: CheckJsSyntaxInput
): Promise<CheckJsSyntaxOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");
  const timeoutMs = input.timeoutMs ?? 30_000;

  let fullPath: string;
  try {
    fullPath = assertWithinWorkspace(workspacePath, relativePath);
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), { workspacePath, relativePath });
  }

  if (!fs.existsSync(fullPath)) {
    return fail("File does not exist", { workspacePath, relativePath });
  }

  const ext = path.extname(fullPath).toLowerCase();

  if (JS_EXT.has(ext)) {
    const result = await runCommand("node", ["--check", fullPath], {
      cwd: workspacePath,
      timeoutMs,
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (result.status === "PASS") {
      return pass({ workspacePath, relativePath, engine: "node --check", exitCode: result.exitCode, output });
    }
    return fail(result.stderr || "Syntax error", {
      workspacePath,
      relativePath,
      engine: "node --check",
      exitCode: result.exitCode,
      output,
    });
  }

  if (TS_EXT.has(ext)) {
    const tscBin = path.join(workspacePath, "node_modules", "typescript", "bin", "tsc");
    if (!fs.existsSync(tscBin)) {
      return skipped("typescript_not_installed", {
        workspacePath,
        relativePath,
        reason: "TypeScript not in node_modules — install to syntax-check .ts files",
      });
    }
    const result = await runCommand("node", [tscBin, "--noEmit", "--skipLibCheck", fullPath], {
      cwd: workspacePath,
      timeoutMs: Math.max(timeoutMs, 60_000),
    });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    if (result.status === "PASS") {
      return pass({ workspacePath, relativePath, engine: "tsc --noEmit", exitCode: result.exitCode, output });
    }
    return fail(output || "TypeScript error", {
      workspacePath,
      relativePath,
      engine: "tsc --noEmit",
      exitCode: result.exitCode,
      output,
    });
  }

  return skipped("unsupported_extension", {
    workspacePath,
    relativePath,
    reason: `Unsupported extension ${ext} — supports .js/.mjs/.cjs/.ts/.tsx`,
  });
}
