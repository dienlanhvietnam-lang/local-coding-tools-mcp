import { describe, it, expect } from "vitest";
import { isDangerousCommand, hasSuspiciousAbsolutePath } from "../src/safety/commandGuard.js";
import {
  isPathInsideWorkspace,
  isRestrictedSystemPath,
  assertWithinWorkspace,
  PathGuardError,
} from "../src/safety/pathGuard.js";
import { redactSecrets, redactEnvContent } from "../src/safety/secretRedactor.js";
import path from "node:path";

describe("commandGuard", () => {
  it("blocks rm -rf /", () => {
    expect(isDangerousCommand("rm -rf /").allowed).toBe(false);
  });

  it("blocks Remove-Item -Recurse C:\\", () => {
    expect(isDangerousCommand("Remove-Item -Recurse C:\\").allowed).toBe(false);
  });

  it("blocks format", () => {
    expect(isDangerousCommand("format C:").allowed).toBe(false);
  });

  it("blocks diskpart", () => {
    expect(isDangerousCommand("diskpart").allowed).toBe(false);
  });

  it("blocks shutdown", () => {
    expect(isDangerousCommand("shutdown /s /t 0").allowed).toBe(false);
  });

  it("allows safe npm scripts", () => {
    expect(isDangerousCommand("vite build").allowed).toBe(true);
    expect(isDangerousCommand("node scripts/build.js").allowed).toBe(true);
  });

  it("detects suspicious absolute paths", () => {
    expect(hasSuspiciousAbsolutePath("C:\\Windows\\System32\\cmd.exe /c dir")).toBe(true);
    expect(hasSuspiciousAbsolutePath("vite build")).toBe(false);
  });
});

describe("pathGuard", () => {
  const workspace = path.resolve("tests/fixtures/sample-project");

  it("allows paths inside workspace", () => {
    expect(isPathInsideWorkspace(workspace, path.join(workspace, "package.json"))).toBe(true);
  });

  it("blocks paths outside workspace", () => {
    expect(isPathInsideWorkspace(workspace, "C:\\Windows")).toBe(false);
  });

  it("assertWithinWorkspace throws for escape", () => {
    expect(() => assertWithinWorkspace(workspace, "../../../etc/passwd")).toThrow(PathGuardError);
  });

  it("flags restricted system paths on Windows", () => {
    if (process.platform === "win32") {
      expect(isRestrictedSystemPath("C:\\")).toBe(true);
      expect(isRestrictedSystemPath("C:\\Windows")).toBe(true);
    }
  });
});

describe("secretRedactor", () => {
  it("redacts sk- keys", () => {
    const out = redactSecrets("key=sk-abcdefghijklmnopqrst");
    expect(out).not.toContain("sk-abcdefghijklmnopqrst");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts Bearer tokens", () => {
    const out = redactSecrets("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9");
    expect(out).toContain("[REDACTED]");
    expect(out).not.toContain("eyJhbGciOiJIUzI1NiJ9");
  });

  it("redacts api_key and password", () => {
    expect(redactSecrets("api_key=secret123")).toContain("api_key=[REDACTED]");
    expect(redactSecrets("password= hunter2")).toContain("password=[REDACTED]");
  });

  it("redacts env content values", () => {
    const out = redactEnvContent("API_KEY=real-value\n# comment\nFOO=bar");
    expect(out).toContain("API_KEY=[REDACTED]");
    expect(out).not.toContain("real-value");
    expect(out).toContain("# comment");
  });
});
