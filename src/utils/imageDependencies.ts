import sharp from "sharp";
import { getToolVersion, runCommand } from "./execSafe.js";

export const REMOVE_BG_INSTALL_HINT =
  "Run scripts/install-image-deps.ps1 -InstallRembg or configure REMOVE_BG_API_KEY";

export const AI_UPSCALE_INSTALL_HINT =
  "Install realesrgan-ncnn-vulkan or set REPLICATE_API_TOKEN (scripts/install-image-deps.ps1 -UseReplicate)";

const COMMAND_PROBE_MS = 5000;

const MISSING_PATTERNS = [
  /not found on path/i,
  /not installed/i,
  /not available/i,
  /no .* method available/i,
  /enoent/i,
  /command not found/i,
  /'rembg' is not recognized/i,
];

export interface CommandProbeResult {
  ok: boolean;
  reason?: string;
}

/**
 * Check if a command exists on PATH using `where` (win32) or `which` (unix).
 * Uses safe runCommand with args array (shell disabled).
 */
export async function commandExists(cmd: string, timeoutMs = COMMAND_PROBE_MS): Promise<CommandProbeResult> {
  const probeCmd = process.platform === "win32" ? "where" : "which";
  const result = await runCommand(probeCmd, [cmd], { timeoutMs });
  if (result.status === "PASS") {
    return { ok: true };
  }
  return { ok: false, reason: result.exitCode === null ? "timeout" : "not_found" };
}

export async function probeImglyNode(): Promise<boolean> {
  try {
    const mod = await import("@imgly/background-removal-node");
    const fn = mod.removeBackground ?? mod.default?.removeBackground;
    return typeof fn === "function";
  } catch {
    return false;
  }
}

export async function probeRembgCli(): Promise<CommandProbeResult> {
  return commandExists("rembg");
}

export async function probeRealesrganCli(): Promise<CommandProbeResult> {
  for (const c of ["realesrgan-ncnn-vulkan", "realesrgan-ncnn-vulkan.exe"]) {
    const r = await commandExists(c);
    if (r.ok) return { ok: true };
  }
  return { ok: false, reason: "not_found" };
}

export function isTokenConfigured(envName: string): boolean {
  const v = process.env[envName];
  return typeof v === "string" && v.trim().length > 0;
}

export function isMissingDependencyError(message: string): boolean {
  return MISSING_PATTERNS.some((re) => re.test(message));
}

export function allErrorsMissingDependency(errors: string[]): boolean {
  return errors.length > 0 && errors.every((e) => isMissingDependencyError(e));
}

export interface ImageDependencySnapshot {
  node: boolean;
  npm: boolean;
  sharp: boolean;
  python: boolean;
  pip: boolean;
  rembg: boolean;
  rembgReason?: string;
  imglyNode: boolean;
  realesrgan: boolean;
  realesrganReason?: string;
  replicateToken: boolean;
  removeBgApiKey: boolean;
  coreImageReady: boolean;
  removeBackgroundReady: boolean;
  aiUpscaleReady: boolean;
  installHints: string[];
}

async function safeToolCheck(cmd: string, args: string[] = []): Promise<boolean> {
  try {
    const r = await getToolVersion(cmd, args);
    return r.ok;
  } catch {
    return false;
  }
}

export async function collectImageDependencies(): Promise<ImageDependencySnapshot> {
  const [node, npm, python, pip, rembgProbe, imglyNode, realesrganProbe] = await Promise.all([
    safeToolCheck("node", ["--version"]),
    safeToolCheck("npm", ["--version"]),
    safeToolCheck("python", ["--version"]),
    safeToolCheck("pip", ["--version"]),
    probeRembgCli(),
    probeImglyNode(),
    probeRealesrganCli(),
  ]);

  const sharpOk = typeof sharp === "function";
  const rembg = rembgProbe.ok;
  const realesrgan = realesrganProbe.ok;
  const replicateToken = isTokenConfigured("REPLICATE_API_TOKEN");
  const removeBgApiKey = isTokenConfigured("REMOVE_BG_API_KEY");
  const removeBackgroundReady = rembg || imglyNode || removeBgApiKey;
  const aiUpscaleReady = realesrgan || replicateToken;
  const coreImageReady = sharpOk && node;

  const installHints: string[] = [];
  if (!removeBackgroundReady) installHints.push(REMOVE_BG_INSTALL_HINT);
  if (!aiUpscaleReady) installHints.push(AI_UPSCALE_INSTALL_HINT);

  return {
    node,
    npm,
    sharp: sharpOk,
    python,
    pip,
    rembg,
    rembgReason: rembgProbe.reason,
    imglyNode,
    realesrgan,
    realesrganReason: realesrganProbe.reason,
    replicateToken,
    removeBgApiKey,
    coreImageReady,
    removeBackgroundReady,
    aiUpscaleReady,
    installHints,
  };
}

export function imageDependencyStatus(
  snap: ImageDependencySnapshot
): "PASS" | "PARTIAL" | "FAIL" {
  if (!snap.coreImageReady) return "FAIL";
  if (snap.removeBackgroundReady && snap.aiUpscaleReady) return "PASS";
  return "PARTIAL";
}

export type DepComponentStatus = "READY" | "MISSING" | "CONFIGURED" | "FAIL";

export interface DepComponentRow {
  component: string;
  status: DepComponentStatus;
  detail: string;
  fix: string;
}

export function buildDependencyComponents(snap: ImageDependencySnapshot): DepComponentRow[] {
  const tokenDetail = (configured: boolean) => (configured ? "CONFIGURED" : "MISSING");
  const tokenFix = (name: string) =>
    configuredHint(name)
      ? "Already set — do not paste token in chat/log"
      : `setx ${name} "your-token-here" then restart terminal`;

  function configuredHint(name: string): boolean {
    return name === "REPLICATE_API_TOKEN" ? snap.replicateToken : snap.removeBgApiKey;
  }

  return [
    {
      component: "node",
      status: snap.node ? "READY" : "FAIL",
      detail: snap.node ? "found" : "not in PATH",
      fix: "Install Node.js LTS from https://nodejs.org",
    },
    {
      component: "npm",
      status: snap.npm ? "READY" : "MISSING",
      detail: snap.npm ? "found" : "not in PATH",
      fix: "Comes with Node.js — reinstall Node if missing",
    },
    {
      component: "sharp",
      status: snap.sharp ? "READY" : "FAIL",
      detail: snap.sharp ? "core image library OK" : "npm install sharp failed",
      fix: "cd server folder && npm install && npm run build",
    },
    {
      component: "python",
      status: snap.python ? "READY" : "MISSING",
      detail: snap.python ? "found" : "not in PATH",
      fix: "Install Python 3.10+ from https://python.org (script does not auto-install)",
    },
    {
      component: "pip",
      status: snap.pip ? "READY" : "MISSING",
      detail: snap.pip ? "found" : "not in PATH",
      fix: "python -m ensurepip --upgrade or reinstall Python with pip",
    },
    {
      component: "rembg",
      status: snap.rembg ? "READY" : "MISSING",
      detail: snap.rembg
        ? "CLI on PATH"
        : snap.rembgReason
          ? `CLI ${snap.rembgReason}`
          : "Python package / CLI not found",
      fix: "powershell -File scripts/install-image-deps.ps1 -InstallRembg",
    },
    {
      component: "imgly-node",
      status: snap.imglyNode ? "READY" : "MISSING",
      detail: snap.imglyNode ? "bundled npm package OK" : "@imgly/background-removal-node unavailable",
      fix: "npm install in server folder (included in package.json)",
    },
    {
      component: "realesrgan-ncnn-vulkan",
      status: snap.realesrgan ? "READY" : "MISSING",
      detail: snap.realesrgan
        ? "on PATH"
        : snap.realesrganReason
          ? `CLI ${snap.realesrganReason}`
          : "not in PATH",
      fix: "Manual install: https://github.com/xinntao/Real-ESRGAN-ncnn-vulkan/releases — add to PATH",
    },
    {
      component: "REPLICATE_API_TOKEN",
      status: snap.replicateToken ? "CONFIGURED" : "MISSING",
      detail: tokenDetail(snap.replicateToken),
      fix: tokenFix("REPLICATE_API_TOKEN"),
    },
    {
      component: "REMOVE_BG_API_KEY",
      status: snap.removeBgApiKey ? "CONFIGURED" : "MISSING",
      detail: tokenDetail(snap.removeBgApiKey),
      fix: tokenFix("REMOVE_BG_API_KEY"),
    },
    {
      component: "removeBackgroundReady",
      status: snap.removeBackgroundReady ? "READY" : "MISSING",
      detail: snap.removeBackgroundReady ? "rembg|imgly|API" : "no backend available",
      fix: REMOVE_BG_INSTALL_HINT,
    },
    {
      component: "aiUpscaleReady",
      status: snap.aiUpscaleReady ? "READY" : "MISSING",
      detail: snap.aiUpscaleReady ? "realesrgan|Replicate" : "no AI upscale backend",
      fix: AI_UPSCALE_INSTALL_HINT,
    },
  ];
}

export function profileExitCode(
  profile: string,
  snap: ImageDependencySnapshot
): number {
  if (!snap.coreImageReady && profile !== "coding") return 2;
  if (profile === "coding") return snap.coreImageReady ? 0 : 1;
  if (profile === "image-core") return snap.coreImageReady ? 0 : 2;
  if (profile === "full-image") {
    if (snap.removeBackgroundReady && snap.aiUpscaleReady) return 0;
    return 1;
  }
  return 2;
}
