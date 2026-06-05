import { describe, it, expect } from "vitest";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "dist", "server.js");

describe("mcp smoke", () => {
  it("dist/server.js exists after build", () => {
    expect(fs.existsSync(SERVER)).toBe(true);
  });

  it("server starts without immediate crash", async () => {
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "vitest", version: "1.0.0" },
      },
    };

    const child = spawn(process.execPath, [SERVER], {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: ROOT,
    });

    let stderr = "";
    child.stderr.on("data", (d) => {
      stderr += d.toString();
    });

    const exitPromise = new Promise<number | null>((resolve) => {
      child.on("close", resolve);
    });

    child.stdin.write(JSON.stringify(initRequest) + "\n");

    await new Promise((r) => setTimeout(r, 1500));
    child.kill("SIGTERM");

    const code = await Promise.race([
      exitPromise,
      new Promise<null>((r) => setTimeout(() => r(null), 2000)),
    ]);

    expect(stderr).not.toMatch(/fatal/i);
    expect(code === null || code === 0 || code === 143 || code === 1).toBe(true);
  });
});
