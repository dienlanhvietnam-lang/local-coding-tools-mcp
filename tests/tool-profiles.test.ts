import { describe, expect, it } from "vitest";
import { EXPECTED_TOOL_COUNT } from "../src/toolRegistry.js";
import {
  VSIX_TOOLS,
  VSIX_DEV_TOOLS,
  VSIX_PUBLISH_TOOL,
  profileIncludesTool,
  SAFE_PROFILE_TOOLS,
  DEV_PROFILE_TOOLS,
  ADMIN_PROFILE_TOOLS,
} from "../src/toolProfiles.js";

describe("tool profiles VSIX placement", () => {
  it("EXPECTED_TOOL_COUNT is 87", () => {
    expect(EXPECTED_TOOL_COUNT).toBe(87);
  });

  it("safe profile excludes all VSIX tools", () => {
    for (const t of VSIX_TOOLS) {
      expect(profileIncludesTool("safe", t)).toBe(false);
      expect(SAFE_PROFILE_TOOLS).not.toContain(t);
    }
    expect(SAFE_PROFILE_TOOLS.length).toBe(87 - VSIX_TOOLS.length);
  });

  it("dev profile includes check/package/verify but not publish", () => {
    for (const t of VSIX_DEV_TOOLS) {
      expect(profileIncludesTool("dev", t)).toBe(true);
      expect(DEV_PROFILE_TOOLS).toContain(t);
    }
    expect(profileIncludesTool("dev", VSIX_PUBLISH_TOOL)).toBe(false);
    expect(DEV_PROFILE_TOOLS).not.toContain(VSIX_PUBLISH_TOOL);
  });

  it("admin profile includes publish", () => {
    expect(profileIncludesTool("admin", VSIX_PUBLISH_TOOL)).toBe(true);
    expect(ADMIN_PROFILE_TOOLS.length).toBe(87);
    for (const t of VSIX_TOOLS) {
      expect(ADMIN_PROFILE_TOOLS).toContain(t);
    }
  });
});
