import { describe, expect, it } from "vitest";
import { redactSecrets, containsSecretPatterns } from "../src/safety/secretRedactor.js";

describe("secretRedactor", () => {
  it("redacts VSCE_PAT patterns", () => {
    const input = "VSCE_PAT=vso1234567890abcdefghij token=abc123secretkey";
    const out = redactSecrets(input);
    expect(out).not.toContain("vso1234567890");
    expect(out).toContain("[REDACTED]");
  });

  it("redacts actual env VSCE_PAT value", () => {
    const pat = "vsoTESTPAT123456789012345678901234";
    const prev = process.env.VSCE_PAT;
    process.env.VSCE_PAT = pat;
    try {
      const out = redactSecrets(`publish failed with token ${pat} embedded`);
      expect(out).not.toContain(pat);
      expect(out).toContain("[REDACTED]");
    } finally {
      if (prev) process.env.VSCE_PAT = prev;
      else delete process.env.VSCE_PAT;
    }
  });

  it("detects bearer tokens", () => {
    expect(containsSecretPatterns("Authorization: Bearer eyJhbGciOiJIUzI1NiJ9")).toBe(true);
  });
});
