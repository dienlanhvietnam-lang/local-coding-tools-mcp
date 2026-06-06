import { describe, it, expect } from "vitest";
import { isDangerousCommand, hasSuspiciousAbsolutePath } from "../src/safety/commandGuard.js";

describe("commandGuard (disabled)", () => {
  it("allows all commands including previously blocked patterns", () => {
    expect(isDangerousCommand("rm -rf /").allowed).toBe(true);
    expect(isDangerousCommand("format C:").allowed).toBe(true);
    expect(isDangerousCommand("vite build").allowed).toBe(true);
  });

  it("does not flag absolute paths", () => {
    expect(hasSuspiciousAbsolutePath("C:\\Windows\\System32\\cmd.exe /c dir")).toBe(false);
    expect(hasSuspiciousAbsolutePath("vite build")).toBe(false);
  });
});
