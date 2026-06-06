import path from "node:path";
import {
  readFileInWorkspace,
  fileExistsInWorkspace,
  readJsonInWorkspace,
  validateWorkspacePath,
} from "../utils/fsSafe.js";
import { pass, fail } from "../utils/result.js";

export interface ReadProjectInfoInput {
  workspacePath: string;
}

export interface ProjectInfo {
  name?: string;
  version?: string;
  description?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface ReadProjectInfoOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  hasPackageJson?: boolean;
  packageJson?: ProjectInfo;
  frameworks?: string[];
  hasEnvFile?: boolean;
  envSummary?: { keys: string[]; redactedPreview?: string };
  error?: string;
}

const FRAMEWORK_SIGNALS: Array<[string, (pkg: ProjectInfo) => boolean]> = [
  ["vite", (p) => hasDep(p, "vite")],
  ["next", (p) => hasDep(p, "next")],
  ["react", (p) => hasDep(p, "react")],
  ["vue", (p) => hasDep(p, "vue")],
  ["nuxt", (p) => hasDep(p, "nuxt") || hasDep(p, "nuxt3")],
  ["express", (p) => hasDep(p, "express")],
  ["electron", (p) => hasDep(p, "electron")],
  ["typescript", (p) => hasDep(p, "typescript")],
  ["nestjs", (p) => hasDep(p, "@nestjs/core")],
  ["svelte", (p) => hasDep(p, "svelte")],
  ["angular", (p) => hasDep(p, "@angular/core")],
  ["remix", (p) => hasDep(p, "@remix-run/react")],
  ["astro", (p) => hasDep(p, "astro")],
];

function hasDep(pkg: ProjectInfo, name: string): boolean {
  return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
}

function detectFrameworks(pkg: ProjectInfo): string[] {
  return FRAMEWORK_SIGNALS.filter(([, test]) => test(pkg)).map(([name]) => name);
}

function parseEnvKeys(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=")[0]?.trim())
    .filter((k): k is string => Boolean(k));
}

export async function readProjectInfo(
  input: ReadProjectInfoInput
): Promise<ReadProjectInfoOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const hasPackageJson = fileExistsInWorkspace(workspacePath, "package.json");

  let packageJson: ProjectInfo | undefined;
  let frameworks: string[] = [];

  if (hasPackageJson) {
    const raw = readJsonInWorkspace<ProjectInfo>(workspacePath, "package.json");
    if (raw) {
      packageJson = {
        name: raw.name,
        version: raw.version,
        description: raw.description,
        type: raw.type,
        scripts: raw.scripts,
        dependencies: raw.dependencies,
        devDependencies: raw.devDependencies,
      };
      frameworks = detectFrameworks(raw);
    }
  }

  const envPath = findEnvFile(workspacePath);
  let envSummary: ReadProjectInfoOutput["envSummary"];
  const hasEnvFile = Boolean(envPath);

  if (envPath) {
    try {
      const rel = path.relative(workspacePath, envPath);
      const content = readFileInWorkspace(workspacePath, rel);
      envSummary = {
        keys: parseEnvKeys(content),
        redactedPreview: content,
      };
    } catch {
      envSummary = { keys: [], redactedPreview: "[unable to read]" };
    }
  }

  return pass({
    workspacePath,
    hasPackageJson,
    packageJson,
    frameworks,
    hasEnvFile,
    envSummary,
  });
}

function findEnvFile(workspacePath: string): string | null {
  if (fileExistsInWorkspace(workspacePath, ".env")) {
    return path.join(workspacePath, ".env");
  }
  return null;
}
