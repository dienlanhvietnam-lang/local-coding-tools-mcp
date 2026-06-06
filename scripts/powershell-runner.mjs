#!/usr/bin/env node
/**
 * Safe PowerShell script runner: spawn (not exec), stream output, file logging.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logRuntimeEvent, RUNTIME_LOG_PATH, tailText } from "./runtime-log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

function resolvePowerShellExe() {
  const candidates = [
    process.env.MCP_POWERSHELL_EXE,
    "pwsh.exe",
    "powershell.exe",
  ].filter(Boolean);
  for (const name of candidates) {
    if (name.includes(path.sep) && fs.existsSync(name)) return name;
    if (process.platform === "win32") {
      const system32 = path.join(process.env.SystemRoot || "C:\\Windows", "System32", name);
      if (fs.existsSync(system32)) return system32;
    }
  }
  return "powershell.exe";
}

/**
 * @param {string} scriptPath absolute or relative .ps1 path
 * @param {string[]} scriptArgs arguments passed to the script
 * @param {{ cwd?: string, timeoutMs?: number, env?: NodeJS.ProcessEnv }} [options]
 */
export function runPowerShellScript(scriptPath, scriptArgs = [], options = {}) {
  const resolvedScript = path.resolve(options.cwd ?? PROJECT_ROOT, scriptPath);
  const cwd = options.cwd ? path.resolve(options.cwd) : path.dirname(resolvedScript);
  const timeoutMs = options.timeoutMs ?? 0;
  const shellExe = resolvePowerShellExe();
  const args = [
    "-NoProfile",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    resolvedScript,
    ...scriptArgs,
  ];
  const startTime = new Date().toISOString();
  const t0 = Date.now();

  logRuntimeEvent({
    kind: "powershell_start",
    command: shellExe,
    args,
    cwd,
    shell: shellExe,
    startTime,
    timeoutMs: timeoutMs || undefined,
  });

  return new Promise((resolve) => {
    const child = spawn(shellExe, args, {
      cwd,
      env: { ...process.env, ...options.env },
      shell: false,
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let lastOutputAt = Date.now();
    let timer = null;

    if (timeoutMs > 0) {
      timer = setInterval(() => {
        const idleMs = Date.now() - lastOutputAt;
        const elapsed = Date.now() - t0;
        if (elapsed >= timeoutMs && idleMs >= 5000) {
          timedOut = true;
          child.kill("SIGTERM");
          setTimeout(() => child.kill("SIGKILL"), 2000);
        }
      }, 1000);
    }

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
      lastOutputAt = Date.now();
      process.stdout.write(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
      lastOutputAt = Date.now();
      process.stderr.write(chunk);
    });

    child.on("close", (exitCode, signal) => {
      if (timer) clearInterval(timer);
      const endTime = new Date().toISOString();
      const durationMs = Date.now() - t0;
      const ok = !timedOut && exitCode === 0;
      const result = {
        ok,
        exitCode,
        signal,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
        durationMs,
        logPath: RUNTIME_LOG_PATH,
        timedOut,
      };
      logRuntimeEvent({
        kind: timedOut ? "powershell_timeout" : ok ? "powershell_pass" : "powershell_fail",
        command: shellExe,
        args,
        cwd,
        shell: shellExe,
        startTime,
        endTime,
        durationMs,
        exitCode,
        signal,
        status: ok ? "PASS" : timedOut ? "TIMEOUT" : "FAIL",
        stdoutTail: stdout,
        stderrTail: stderr,
        timeoutMs: timeoutMs || undefined,
        cancelReason: timedOut ? `timeout after ${timeoutMs}ms (idle>=5s)` : undefined,
      });
      resolve(result);
    });

    child.on("error", (err) => {
      if (timer) clearInterval(timer);
      const endTime = new Date().toISOString();
      const durationMs = Date.now() - t0;
      logRuntimeEvent({
        kind: "powershell_error",
        command: shellExe,
        args,
        cwd,
        shell: shellExe,
        startTime,
        endTime,
        durationMs,
        status: "FAIL",
        error: err.message,
      });
      resolve({
        ok: false,
        exitCode: 1,
        signal: null,
        stdoutTail: tailText(stdout),
        stderrTail: tailText(stderr),
        durationMs,
        logPath: RUNTIME_LOG_PATH,
        timedOut: false,
        error: err.message,
      });
    });
  });
}
