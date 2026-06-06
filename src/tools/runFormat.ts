import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { runCommand } from "../utils/execSafe.js";
import { pass, fail, skipped } from "../utils/result.js";

export interface RunFormatInput {
  workspacePath: string;
  paths?: string[];
  formatter?: "prettier" | "eslint" | "auto";
  timeoutMs?: number;
}

export interface RunFormatOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  workspacePath?: string;
  formatter?: string;
  paths?: string[];
  exitCode?: number | null;
  output?: string;
  error?: string;
  reason?: string;
}

function hasLocalBin(workspacePath: string, rel: string): boolean {
  return fs.existsSync(path.join(workspacePath, "node_modules", ".bin", rel)) ||
    fs.existsSync(path.join(workspacePath, "node_modules", rel));
}

export async function runFormat(input: RunFormatInput): Promise<RunFormatOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const timeoutMs = input.timeoutMs ?? 120_000;
  const targets = (input.paths?.length ? input.paths : ["."]).map((p) => p.replace(/\\/g, "/"));

  for (const t of targets) {
    if (t.includes("..") || t.startsWith("-")) {
      return fail("Invalid path — cannot use '..' or flags", { workspacePath, paths: targets });
    }
  }

  const wantPrettier = input.formatter === "prettier" || input.formatter === "auto" || !input.formatter;
  const wantEslint = input.formatter === "eslint";

  if (wantEslint || (input.formatter === "auto" && hasLocalBin(workspacePath, "eslint") && !hasLocalBin(workspacePath, "prettier"))) {
    const eslintCli = path.join(workspacePath, "node_modules", "eslint", "bin", "eslint.js");
    if (!fs.existsSync(eslintCli)) {
      return skipped("eslint_not_installed", { workspacePath, reason: "ESLint not in node_modules" });
    }
    const result = await runCommand("node", [eslintCli, "--fix", ...targets], { cwd: workspacePath, timeoutMs });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    return result.status === "PASS"
      ? pass({ workspacePath, formatter: "eslint --fix", paths: targets, exitCode: result.exitCode, output })
      : fail(output || "eslint --fix failed", { workspacePath, formatter: "eslint --fix", paths: targets, exitCode: result.exitCode, output });
  }

  if (wantPrettier) {
    const prettierCli = path.join(workspacePath, "node_modules", "prettier", "bin", "prettier.cjs");
    const prettierCliAlt = path.join(workspacePath, "node_modules", "prettier", "bin-prettier.js");
    const cli = fs.existsSync(prettierCli) ? prettierCli : (fs.existsSync(prettierCliAlt) ? prettierCliAlt : null);
    if (!cli) {
      return skipped("prettier_not_installed", {
        workspacePath,
        reason: "Prettier not in node_modules — install prettier or use run_project_script for a format script",
      });
    }
    const result = await runCommand("node", [cli, "--write", ...targets], { cwd: workspacePath, timeoutMs });
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    return result.status === "PASS"
      ? pass({ workspacePath, formatter: "prettier --write", paths: targets, exitCode: result.exitCode, output })
      : fail(output || "prettier --write failed", { workspacePath, formatter: "prettier --write", paths: targets, exitCode: result.exitCode, output });
  }

  return skipped("no_formatter", { workspacePath, reason: "No prettier/eslint found in node_modules" });
}
