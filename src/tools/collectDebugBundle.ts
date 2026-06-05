import fs from "node:fs";
import path from "node:path";
import { SENSITIVE_FILE_PATTERNS } from "../config.js";
import { ensureDirInWorkspace, validateWorkspacePath, writeFileInWorkspace } from "../utils/fsSafe.js";
import { checkSystem } from "./checkSystem.js";
import { readProjectInfo } from "./readProjectInfo.js";
import { listScripts } from "./listScripts.js";
import { gitStatus } from "./gitStatus.js";
import { pass, fail } from "../utils/result.js";

export interface CollectDebugBundleInput {
  workspacePath: string;
}

export interface CollectDebugBundleOutput {
  status: "PASS" | "FAIL";
  bundlePath?: string;
  files?: string[];
  excludedSensitive?: string[];
  error?: string;
}

function isSensitiveFilename(name: string): boolean {
  return SENSITIVE_FILE_PATTERNS.some((p) => p.test(name));
}

export async function collectDebugBundle(
  input: CollectDebugBundleInput
): Promise<CollectDebugBundleOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bundleDirRel = `.mcp-debug/debug-bundle-${timestamp}`;
  const bundleDir = ensureDirInWorkspace(workspacePath, bundleDirRel);

  const excludedSensitive = [".env", ".env.local", ".env.production", "credentials.json"];

  try {
    const [systemInfo, projectInfo, scriptsInfo, gitInfo] = await Promise.all([
      checkSystem(),
      readProjectInfo({ workspacePath }),
      listScripts({ workspacePath }),
      gitStatus({ workspacePath }),
    ]);

    const files: string[] = [];

    files.push(
      writeFileInWorkspace(
        workspacePath,
        `${bundleDirRel}/project-info.json`,
        JSON.stringify(projectInfo, null, 2)
      )
    );

    files.push(
      writeFileInWorkspace(
        workspacePath,
        `${bundleDirRel}/scripts.json`,
        JSON.stringify(scriptsInfo, null, 2)
      )
    );

    files.push(
      writeFileInWorkspace(
        workspacePath,
        `${bundleDirRel}/git-status.txt`,
        gitInfo.output ?? gitInfo.error ?? "N/A"
      )
    );

    files.push(
      writeFileInWorkspace(
        workspacePath,
        `${bundleDirRel}/system.json`,
        JSON.stringify(systemInfo, null, 2)
      )
    );

    const lastResultPath = path.join(workspacePath, ".mcp-debug", "last-command-result.json");
    if (fs.existsSync(lastResultPath) && !isSensitiveFilename(path.basename(lastResultPath))) {
      const destRel = `${bundleDirRel}/last-command-result.json`;
      const content = fs.readFileSync(lastResultPath, "utf8");
      files.push(writeFileInWorkspace(workspacePath, destRel, content));
    }

    const manifest = {
      createdAt: new Date().toISOString(),
      workspacePath,
      note: "Sensitive files (.env, credentials, tokens) are intentionally excluded.",
      excludedSensitive: true,
      excludedSensitivePatterns: excludedSensitive,
      includedFiles: files.map((f) => path.relative(workspacePath, f)),
    };

    files.push(
      writeFileInWorkspace(
        workspacePath,
        `${bundleDirRel}/manifest.json`,
        JSON.stringify(manifest, null, 2)
      )
    );

    return pass({
      bundlePath: bundleDir,
      files: files.map((f) => path.relative(workspacePath, f)),
      excludedSensitive,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { bundlePath: bundleDir });
  }
}
