import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSafeCommand } from "../src/safety/safeCommandAllowlist.js";
import { runSafeCommand } from "../src/tools/runSafeCommand.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

describe("run_safe_command allowlist", () => {
  it("denies unknown command", () => {
    const r = validateSafeCommand("rm", ["-rf", "/"]);
    expect(r.allowed).toBe(false);
  });

  it("denies shell metachar in args", () => {
    const r = validateSafeCommand("node", ["-e", "console.log(1); rm -rf /"]);
    expect(r.allowed).toBe(false);
  });

  it("allows node --version", async () => {
    const r = await runSafeCommand({
      workspacePath: ROOT,
      command: "node",
      args: ["--version"],
      timeoutMs: 10_000,
    });
    expect(r.status).toBe("PASS");
    expect(r.stdout?.length).toBeGreaterThan(0);
  }, 15_000);
});
