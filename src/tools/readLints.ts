import fs from "node:fs";
import path from "node:path";
import { validateWorkspacePath } from "../utils/fsSafe.js";
import { runCommand } from "../utils/execSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ReadLintsInput {
  workspacePath: string;
  projectSubdir?: string;
  timeoutMs?: number;
}

export interface LintDiagnostic {
  tool: "typescript" | "eslint";
  file?: string;
  line?: number;
  column?: number;
  severity: "error" | "warning";
  message: string;
}

export interface ReadLintsOutput {
  status: "PASS" | "FAIL" | "PARTIAL";
  workspacePath?: string;
  projectSubdir?: string;
  diagnostics?: LintDiagnostic[];
  errorCount?: number;
  warningCount?: number;
  raw?: string;
  error?: string;
}

function hasTsConfig(dir: string): boolean {
  return fs.existsSync(path.join(dir, "tsconfig.json"));
}

function hasEslintConfig(dir: string): boolean {
  const names = [
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
    "eslint.config.ts",
    ".eslintrc",
    ".eslintrc.json",
    ".eslintrc.js",
    ".eslintrc.cjs",
  ];
  return names.some((n) => fs.existsSync(path.join(dir, n)));
}

function parseTscOutput(output: string): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const lineRe = /^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(output)) !== null) {
    diagnostics.push({
      tool: "typescript",
      file: m[1],
      line: Number(m[2]),
      column: Number(m[3]),
      severity: m[4] as "error" | "warning",
      message: m[5]!.trim(),
    });
  }
  return diagnostics;
}

function parseEslintJson(output: string): LintDiagnostic[] {
  try {
    const data = JSON.parse(output) as Array<{
      filePath: string;
      messages: Array<{
        line: number;
        column: number;
        severity: number;
        message: string;
      }>;
    }>;
    const diagnostics: LintDiagnostic[] = [];
    for (const file of data) {
      for (const msg of file.messages) {
        diagnostics.push({
          tool: "eslint",
          file: file.filePath,
          line: msg.line,
          column: msg.column,
          severity: msg.severity === 2 ? "error" : "warning",
          message: msg.message,
        });
      }
    }
    return diagnostics;
  } catch {
    return [];
  }
}

export async function readLints(input: ReadLintsInput): Promise<ReadLintsOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  let projectDir = workspacePath;
  let projectSubdir: string | undefined;

  if (input.projectSubdir) {
    const sub = input.projectSubdir.replace(/\\/g, "/");
    projectDir = path.join(workspacePath, sub);
    projectSubdir = sub;
    if (!fs.existsSync(projectDir) || !fs.statSync(projectDir).isDirectory()) {
      return fail(`projectSubdir not found: ${sub}`);
    }
  }

  const timeoutMs = input.timeoutMs ?? 60_000;
  const diagnostics: LintDiagnostic[] = [];
  const rawParts: string[] = [];
  let ranAny = false;

  if (hasTsConfig(projectDir)) {
    ranAny = true;
    const tsc = await runCommand("npx", ["tsc", "--noEmit", "-p", projectDir], {
      cwd: projectDir,
      timeoutMs,
    });
    const combined = [tsc.stdout, tsc.stderr].filter(Boolean).join("\n");
    rawParts.push(`[typescript]\n${combined}`);
    diagnostics.push(...parseTscOutput(combined));
  }

  if (hasEslintConfig(projectDir)) {
    ranAny = true;
    const eslint = await runCommand(
      "npx",
      ["eslint", ".", "--format", "json", "--max-warnings", "0"],
      { cwd: projectDir, timeoutMs }
    );
    const combined = [eslint.stdout, eslint.stderr].filter(Boolean).join("\n");
    rawParts.push(`[eslint]\n${combined}`);
    diagnostics.push(...parseEslintJson(eslint.stdout));
  }

  if (!ranAny) {
    return pass({
      workspacePath,
      projectSubdir,
      diagnostics: [],
      errorCount: 0,
      warningCount: 0,
      raw: "No tsconfig.json or eslint config found — nothing to lint.",
    }) as ReadLintsOutput;
  }

  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warningCount = diagnostics.filter((d) => d.severity === "warning").length;

  const status = errorCount > 0 ? "FAIL" : warningCount > 0 ? "PARTIAL" : "PASS";

  return {
    status,
    workspacePath,
    projectSubdir,
    diagnostics: diagnostics.slice(0, 100),
    errorCount,
    warningCount,
    raw: rawParts.join("\n\n").slice(0, 20_000),
  };
}
