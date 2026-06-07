import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { resolveWorkspacePath, validateWorkspacePath } from "../../safety/pathGuard.js";
import { containsSecretPatterns, redactSecrets } from "../../safety/secretRedactor.js";
import { fetchHttpGet } from "../../utils/httpFetch.js";
import { runCommand, type ExecResult } from "../../utils/execSafe.js";

export interface VsixPackageJson {
  name?: string;
  displayName?: string;
  version?: string;
  publisher?: string;
  engines?: { vscode?: string };
  main?: string;
  browser?: string;
  icon?: string;
  categories?: string[];
  keywords?: string[];
}

export interface VsixCheckItem {
  id: string;
  level: "PASS" | "WARN" | "FAIL";
  message: string;
}

export interface VsixExtensionMeta {
  publisher: string;
  name: string;
  version: string;
  extensionId: string;
  packageJsonPath: string;
}

export function marketplaceUrl(publisher: string, name: string): string {
  return `https://marketplace.visualstudio.com/items?itemName=${publisher}.${name}`;
}

export function readExtensionPackageJson(workspacePath: string): {
  ok: boolean;
  data?: VsixPackageJson;
  packageJsonPath?: string;
  error?: string;
} {
  const pkgPath = path.join(workspacePath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    return { ok: false, error: "package.json not found" };
  }
  try {
    const data = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as VsixPackageJson;
    return { ok: true, data, packageJsonPath: pkgPath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Invalid package.json: ${message}` };
  }
}

export function resolveExtensionMeta(workspacePath: string): {
  ok: boolean;
  meta?: VsixExtensionMeta;
  error?: string;
} {
  const pkg = readExtensionPackageJson(workspacePath);
  if (!pkg.ok || !pkg.data) return { ok: false, error: pkg.error ?? "package.json missing" };

  const { publisher, name, version } = pkg.data;
  if (!publisher?.trim()) return { ok: false, error: "package.json missing publisher" };
  if (!name?.trim()) return { ok: false, error: "package.json missing name" };
  if (!version?.trim()) return { ok: false, error: "package.json missing version" };
  if (!pkg.data.engines?.vscode) return { ok: false, error: "package.json missing engines.vscode" };

  return {
    ok: true,
    meta: {
      publisher: publisher.trim(),
      name: name.trim(),
      version: version.trim(),
      extensionId: `${publisher.trim()}.${name.trim()}`,
      packageJsonPath: pkg.packageJsonPath!,
    },
  };
}

function fileExists(workspacePath: string, rel: string): boolean {
  return fs.existsSync(resolveWorkspacePath(workspacePath, rel));
}

function scanFileForSecrets(workspacePath: string, rel: string): string | null {
  const full = resolveWorkspacePath(workspacePath, rel);
  if (!fs.existsSync(full)) return null;
  try {
    const content = fs.readFileSync(full, "utf8");
    if (containsSecretPatterns(content)) return rel;
  } catch {
    // ignore read errors
  }
  return null;
}

export async function runVsixPreflight(
  workspacePath: string,
  options?: { checkMarketplace?: boolean }
): Promise<{
  status: "PASS" | "PARTIAL" | "FAIL";
  meta?: VsixExtensionMeta;
  checks: VsixCheckItem[];
  warnings: string[];
  errors: string[];
  marketplaceUrl?: string;
  vsceAvailable: boolean;
  vsceHint: string;
}> {
  const checks: VsixCheckItem[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const metaResult = resolveExtensionMeta(workspacePath);
  if (!metaResult.ok || !metaResult.meta) {
    errors.push(metaResult.error ?? "Invalid extension metadata");
    return {
      status: "FAIL",
      checks: [{ id: "package.json", level: "FAIL", message: metaResult.error ?? "invalid" }],
      warnings,
      errors,
      vsceAvailable: false,
      vsceHint: "Fix package.json before packaging",
    };
  }

  const meta = metaResult.meta;
  const pkg = readExtensionPackageJson(workspacePath).data!;

  checks.push({ id: "package.json", level: "PASS", message: "Found package.json" });
  checks.push({ id: "name", level: "PASS", message: meta.name });
  checks.push({ id: "publisher", level: "PASS", message: meta.publisher });
  checks.push({ id: "version", level: "PASS", message: meta.version });
  checks.push({ id: "engines.vscode", level: "PASS", message: pkg.engines!.vscode! });

  if (!pkg.displayName?.trim() && !pkg.name?.trim()) {
    checks.push({ id: "displayName", level: "FAIL", message: "Missing displayName/name" });
    errors.push("Missing displayName or name");
  } else {
    checks.push({ id: "displayName", level: "PASS", message: pkg.displayName ?? pkg.name! });
  }

  if (!fileExists(workspacePath, "README.md")) {
    checks.push({ id: "README.md", level: "WARN", message: "Missing README.md" });
    warnings.push("README.md missing");
  } else {
    checks.push({ id: "README.md", level: "PASS", message: "README.md present" });
  }

  if (!fileExists(workspacePath, "CHANGELOG.md")) {
    checks.push({ id: "CHANGELOG.md", level: "WARN", message: "Missing CHANGELOG.md" });
    warnings.push("CHANGELOG.md missing");
  } else {
    checks.push({ id: "CHANGELOG.md", level: "PASS", message: "CHANGELOG.md present" });
  }

  const licenseFiles = ["LICENSE", "LICENSE.md", "LICENSE.txt"] as const;
  const licenseFound = licenseFiles.find((f) => fileExists(workspacePath, f));
  if (licenseFound) {
    checks.push({ id: "LICENSE", level: "PASS", message: `${licenseFound} present` });
  } else {
    checks.push({ id: "LICENSE", level: "WARN", message: "Missing LICENSE file" });
    warnings.push("LICENSE missing");
  }

  if (!fileExists(workspacePath, ".vscodeignore")) {
    checks.push({ id: ".vscodeignore", level: "WARN", message: "Missing .vscodeignore" });
    warnings.push(".vscodeignore missing");
  } else {
    checks.push({ id: ".vscodeignore", level: "PASS", message: ".vscodeignore present" });
  }

  if (!pkg.categories?.length) {
    checks.push({ id: "categories", level: "WARN", message: "categories missing (optional)" });
  }
  if (!pkg.keywords?.length) {
    checks.push({ id: "keywords", level: "WARN", message: "keywords missing (optional)" });
  }

  const entry = pkg.main ?? pkg.browser;
  if (entry) {
    if (fileExists(workspacePath, entry)) {
      checks.push({ id: "entry", level: "PASS", message: entry });
    } else {
      checks.push({ id: "entry", level: "FAIL", message: `Entry file missing: ${entry}` });
      errors.push(`Entry file missing: ${entry}`);
    }
  }

  if (pkg.icon) {
    if (fileExists(workspacePath, pkg.icon)) {
      checks.push({ id: "icon", level: "PASS", message: pkg.icon });
    } else {
      checks.push({ id: "icon", level: "FAIL", message: `Icon missing: ${pkg.icon}` });
      errors.push(`Icon file missing: ${pkg.icon}`);
    }
  }

  for (const rel of ["package.json", "README.md"]) {
    const bad = scanFileForSecrets(workspacePath, rel);
    if (bad) {
      checks.push({ id: "secrets", level: "FAIL", message: `Possible secret in ${bad}` });
      errors.push(`Possible token/PAT pattern in ${bad}`);
    }
  }

  const vsce = await detectVsce(workspacePath);
  if (!vsce.available) {
    checks.push({ id: "vsce", level: "WARN", message: vsce.hint });
    warnings.push(vsce.hint);
  } else {
    checks.push({ id: "vsce", level: "PASS", message: vsce.hint });
  }

  const url = marketplaceUrl(meta.publisher, meta.name);
  if (options?.checkMarketplace) {
    try {
      const res = await fetchHttpGet(url, { timeoutMs: 15_000, maxBodyChars: 8_000 });
      if (res.httpStatus >= 200 && res.httpStatus < 400) {
        checks.push({ id: "marketplace", level: "PASS", message: `HTTP ${res.httpStatus}` });
      } else {
        checks.push({ id: "marketplace", level: "WARN", message: `HTTP ${res.httpStatus}` });
        warnings.push(`Marketplace check HTTP ${res.httpStatus}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      checks.push({ id: "marketplace", level: "WARN", message });
      warnings.push(`Marketplace network check failed: ${message}`);
    }
  }

  let status: "PASS" | "PARTIAL" | "FAIL" = "PASS";
  if (errors.length) status = "FAIL";
  else if (warnings.length) status = "PARTIAL";

  return {
    status,
    meta,
    checks,
    warnings,
    errors,
    marketplaceUrl: url,
    vsceAvailable: vsce.available,
    vsceHint: vsce.hint,
  };
}

export async function detectVsce(workspacePath: string): Promise<{
  available: boolean;
  mode: "local" | "npx" | "none";
  hint: string;
}> {
  const localBin = path.join(
    workspacePath,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "vsce.cmd" : "vsce"
  );
  const localVsce = path.join(workspacePath, "node_modules", "@vscode", "vsce", "vsce");
  if (fs.existsSync(localBin) || fs.existsSync(localVsce)) {
    return { available: true, mode: "local", hint: "Local @vscode/vsce found in node_modules" };
  }
  try {
    const pkgPath = path.join(workspacePath, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      if (pkg.devDependencies?.["@vscode/vsce"] || pkg.dependencies?.["@vscode/vsce"]) {
        return {
          available: true,
          mode: "npx",
          hint: "@vscode/vsce in package.json — run npm install then local vsce, or npx",
        };
      }
    }
  } catch {
    // ignore
  }
  return {
    available: true,
    mode: "npx",
    hint: "Will use npx --yes @vscode/vsce package when packaging (network required)",
  };
}

export function resolveVsceInvocation(
  workspacePath: string,
  subcommand: "package" | "publish",
  extraArgs: string[]
): { command: string; args: string[]; label: string } {
  const vsceCli = path.join(workspacePath, "node_modules", "@vscode", "vsce", "vsce");
  if (fs.existsSync(vsceCli)) {
    return {
      command: process.execPath,
      args: [vsceCli, subcommand, ...extraArgs],
      label: `node @vscode/vsce ${subcommand}`,
    };
  }
  return {
    command: "npx",
    args: ["--yes", "@vscode/vsce", subcommand, ...extraArgs],
    label: `npx @vscode/vsce ${subcommand}`,
  };
}

export function assertOutputDirInWorkspace(workspacePath: string, outputDir: string): string {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) throw new Error(validation.error ?? "Invalid workspace");
  const resolved = resolveWorkspacePath(workspacePath, outputDir);
  return resolved;
}

export function findLatestVsix(dir: string): { path: string; filename: string } | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".vsix"))
    .map((f) => {
      const full = path.join(dir, f);
      return { full, filename: f, mtime: fs.statSync(full).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) return null;
  return { path: files[0]!.full, filename: files[0]!.filename };
}

export function sha256File(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex").toUpperCase();
}

export function assertVsixInWorkspace(workspacePath: string, vsixPath: string): string {
  const resolved = path.isAbsolute(vsixPath)
    ? path.resolve(vsixPath)
    : resolveWorkspacePath(workspacePath, vsixPath);
  if (!resolved.toLowerCase().endsWith(".vsix")) {
    throw new Error("vsixPath must be a .vsix file");
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`VSIX not found: ${resolved}`);
  }
  return resolved;
}

export function redactExecOutput(result: ExecResult): { stdout: string; stderr: string } {
  return {
    stdout: redactSecrets(result.stdout),
    stderr: redactSecrets(result.stderr),
  };
}

export function hasVscePat(): boolean {
  const pat = process.env.VSCE_PAT?.trim();
  return Boolean(pat && pat.length > 10);
}

export function vscePatConfigured(): { configured: boolean; preview: string } {
  if (!hasVscePat()) return { configured: false, preview: "[NOT_SET]" };
  return { configured: true, preview: "[REDACTED]" };
}
