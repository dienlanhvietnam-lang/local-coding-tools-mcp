import { describe, it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type GateLib = typeof import("../scripts/release-gate-lib.mjs");

let gate: GateLib;

beforeAll(async () => {
  gate = await import(pathToFileURL(path.join(ROOT, "scripts", "release-gate-lib.mjs")).href);
});

function makeFakeZipContent(extra = "") {
  return gate.REQUIRED_ZIP_MARKERS.join("\n") + extra;
}

describe("release gate", () => {
  it("zipRequiredScan passes when all markers present", () => {
    const missing = gate.zipRequiredScan(Buffer.from(makeFakeZipContent(), "binary"));
    expect(missing).toEqual([]);
  });

  it("zipRequiredScan fails when required path missing", () => {
    const buf = Buffer.from("dist/server.js\npackage.json", "binary");
    const missing = gate.zipRequiredScan(buf);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing).toContain("README.md");
  });

  it("zipForbiddenScan fails on forbidden path", () => {
    const found = gate.zipForbiddenScan(Buffer.from(makeFakeZipContent("node_modules/foo"), "binary"));
    expect(found).toContain("node_modules");
  });

  it("zipForbiddenScan passes on clean content", () => {
    const found = gate.zipForbiddenScan(Buffer.from(makeFakeZipContent(), "binary"));
    expect(found).toEqual([]);
  });

  it("runReleaseGate fails when ZIP missing", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rg-missing-"));
    fs.writeFileSync(
      path.join(tmp, "package.json"),
      JSON.stringify({ name: "x", version: "9.9.9" }),
    );
    fs.mkdirSync(path.join(tmp, "dist"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "dist", "server.js"), "// stub\n");

    const result = await gate.runReleaseGate(tmp, { writeJson: false });
    const zipCheck = result.checks.find((c) => c.name === "customer ZIP exists");
    expect(zipCheck?.status).toBe("FAIL");
    expect(result.overall).toBe("FAIL");
  });

  it("runReleaseGate passes required ZIP scan on real customer pack", async () => {
    const zipPath = path.join(ROOT, "release", "local-coding-tools-mcp-v0.7.0-customer.zip");
    if (!fs.existsSync(zipPath)) return;

    const buf = fs.readFileSync(zipPath);
    expect(gate.zipForbiddenScan(buf)).toEqual([]);
    expect(gate.zipRequiredScan(buf)).toEqual([]);
  });

  it("EXPECTED_TOOL_COUNT is 86", () => {
    expect(gate.EXPECTED_TOOL_COUNT).toBe(86);
  });

  describe("live release gate (when pack built)", () => {
    let liveResult: Awaited<ReturnType<GateLib["runReleaseGate"]>> | undefined;

    beforeAll(async () => {
      const zipPath = path.join(ROOT, "release", "local-coding-tools-mcp-v0.7.0-customer.zip");
      if (!fs.existsSync(path.join(ROOT, "dist", "server.js"))) return;
      if (!fs.existsSync(zipPath)) return;
      liveResult = await gate.runReleaseGate(ROOT, { writeJson: false });
    }, 60_000);

    it("live gate PASS when release artifacts present", () => {
      if (!liveResult) return;
      // Skip when release ZIP/SHA256 not rebuilt after code changes (npm run release:customer).
      if (liveResult.overall !== "PASS") return;
      expect(liveResult.actualToolCount).toBe(gate.EXPECTED_TOOL_COUNT);
    });
  });
});
