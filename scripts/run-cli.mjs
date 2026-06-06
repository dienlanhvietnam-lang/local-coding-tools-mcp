#!/usr/bin/env node
/**
 * Shared safe CLI runner for scripts (spawnSync, shell:false, no DEP0190).
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

function resolveNodeCli(command, args) {
  const nodeDir = path.dirname(process.execPath);
  const cliMap = {
    npm: path.join(nodeDir, "node_modules", "npm", "bin", "npm-cli.js"),
    npx: path.join(nodeDir, "node_modules", "npm", "bin", "npx-cli.js"),
    node: process.execPath,
  };
  if (command === "node") {
    return { executable: process.execPath, args };
  }
  const cli = cliMap[command];
  if (cli && fs.existsSync(cli)) {
    return { executable: process.execPath, args: [cli, ...args] };
  }
  return null;
}

function resolveWin32Executable(command) {
  if (command.includes(path.sep) || command.includes("/")) return command;
  if (command.includes(".")) return command;
  const paths = (process.env.PATH || "").split(";");
  for (const dir of paths) {
    if (!dir) continue;
    for (const ext of [".exe", ".cmd", ".bat"]) {
      const full = path.join(dir, command + ext);
      if (fs.existsSync(full)) return full;
    }
  }
  return command;
}

function winQuote(arg) {
  if (!/[\s"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function resolveSpawnTarget(command, args) {
  const nodeCli = resolveNodeCli(command, args);
  if (nodeCli) {
    return { executable: nodeCli.executable, args: nodeCli.args, viaCmd: false };
  }
  const executable =
    process.platform === "win32" ? resolveWin32Executable(command) : command;
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(executable)) {
    const inner = [executable, ...args.map(winQuote)].join(" ");
    return {
      executable: process.env.comspec ?? "cmd.exe",
      args: ["/d", "/s", "/c", inner],
      viaCmd: true,
    };
  }
  return { executable, args, viaCmd: false };
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {import("node:child_process").SpawnSyncOptions} [options]
 */
export function runCli(command, args, options = {}) {
  if (command.includes(" ") || /[;&|`$()<>]/.test(command)) {
    throw new Error("runCli: command must not contain spaces or shell metacharacters");
  }
  const target = resolveSpawnTarget(command, args);
  const result = spawnSync(target.executable, target.args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    windowsVerbatimArguments: target.viaCmd,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  return {
    status: result.error ? "ERROR" : result.status === 0 ? "PASS" : "FAIL",
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    exitCode: result.status,
    error: result.error?.message || null,
  };
}
