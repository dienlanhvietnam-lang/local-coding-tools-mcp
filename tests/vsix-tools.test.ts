import path from "node:path";
import fs from "node:fs";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { vsixCheckMarketplace } from "../src/tools/vsix/vsixCheckMarketplace.js";
import { vsixPackage } from "../src/tools/vsix/vsixPackage.js";
import { vsixPublishMarketplace } from "../src/tools/vsix/vsixPublishMarketplace.js";
import { vsixVerifyPublish } from "../src/tools/vsix/vsixVerifyPublish.js";
import { marketplaceUrl } from "../src/tools/vsix/vsixUtils.js";

const FIXTURE = path.resolve("tests/fixtures/vsix-extension");
const BAD = path.resolve("tests/fixtures/vsix-extension-bad");
const PARTIAL = path.resolve("tests/fixtures/vsix-extension-partial");

describe("vsix publisher tools", () => {
  it("vsix_check_marketplace PASS with valid fixture", async () => {
    const r = await vsixCheckMarketplace({ workspacePath: FIXTURE });
    expect(r.status).toBe("PASS");
    expect(r.extensionId).toBe("dmctn.sample-vsix-extension");
  });

  it("vsix_check_marketplace FAIL without publisher", async () => {
    const r = await vsixCheckMarketplace({ workspacePath: BAD });
    expect(r.status).toBe("FAIL");
    expect(r.errors?.length).toBeGreaterThan(0);
  });

  it("vsix_check_marketplace PARTIAL without CHANGELOG/LICENSE", async () => {
    const r = await vsixCheckMarketplace({ workspacePath: PARTIAL });
    expect(r.status).toBe("PARTIAL");
    expect(r.warnings?.length).toBeGreaterThan(0);
  });

  it("vsix_package dryRun returns DRY_RUN without creating vsix", async () => {
    const outDir = path.join(FIXTURE, "release-test");
    const r = await vsixPackage({
      workspacePath: FIXTURE,
      outputDir: "release-test",
      dryRun: true,
    });
    expect(r.status).toBe("DRY_RUN");
    expect(fs.existsSync(outDir)).toBe(false);
  });

  it("vsix_package blocked when check FAIL", async () => {
    const r = await vsixPackage({ workspacePath: BAD });
    expect(r.status).toBe("FAIL");
    expect(r.error).toMatch(/check/i);
  });

  it("vsix_publish_marketplace BLOCKED without confirmPublish", async () => {
    const r = await vsixPublishMarketplace({
      workspacePath: FIXTURE,
      confirmPublish: false,
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.reason).toBe("confirm_required");
  });

  it("vsix_publish_marketplace BLOCKED without VSCE_PAT when confirm=true", async () => {
    const prev = process.env.VSCE_PAT;
    delete process.env.VSCE_PAT;
    try {
      const r = await vsixPublishMarketplace({
        workspacePath: FIXTURE,
        confirmPublish: true,
        dryRun: false,
      });
      expect(r.status).toBe("BLOCKED");
      expect(r.reason).toBe("missing_vsce_pat");
    } finally {
      if (prev) process.env.VSCE_PAT = prev;
    }
  });

  it("vsix_publish_marketplace dryRun does not require PAT", async () => {
    const prev = process.env.VSCE_PAT;
    delete process.env.VSCE_PAT;
    try {
      const r = await vsixPublishMarketplace({
        workspacePath: FIXTURE,
        confirmPublish: true,
        dryRun: true,
      });
      expect(r.status).toBe("DRY_RUN");
      expect(r.commandSummary).not.toContain("vso");
    } finally {
      if (prev) process.env.VSCE_PAT = prev;
    }
  });

  it("vsix_verify_publish builds correct marketplaceUrl", async () => {
    const r = await vsixVerifyPublish({
      publisher: "devgol",
      name: "dmctn-mcp",
    });
    expect(r.marketplaceUrl).toBe(marketplaceUrl("devgol", "dmctn-mcp"));
    expect(["PASS", "PARTIAL", "FAIL"]).toContain(r.status);
  });
});
