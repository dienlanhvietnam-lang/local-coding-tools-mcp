import path from "node:path";
import { describe, expect, it } from "vitest";
import { playwrightNavigate } from "../src/tools/playwrightNavigate.js";
import { playwrightClose } from "../src/tools/playwrightClose.js";
import { probePlaywrightCore } from "../src/utils/uiDesignDependencies.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const UI_REL = "tests/fixtures/ui/sample.html";

describe("playwright browser tools", () => {
  it("playwright_navigate rejects invalid workspace", async () => {
    const r = await playwrightNavigate({ workspacePath: "/nonexistent/path/xyz" });
    expect(r.status).toBe("FAIL");
  });

  it("playwright_navigate with fixture html", async () => {
    const hasPw = await probePlaywrightCore();
    const r = await playwrightNavigate({
      workspacePath: ROOT,
      relativePath: UI_REL,
    });
    if (!hasPw) {
      expect(r.status).toBe("SKIPPED");
      expect(r.installHint).toBeTruthy();
      return;
    }
    expect(r.status).toBe("PASS");
    expect(r.title).toBeTruthy();
    await playwrightClose({ workspacePath: ROOT });
  });
});
