/** Dangerous command patterns — blocked regardless of casing/spacing variants */
const DANGEROUS_PATTERNS: RegExp[] = [
  /remove-item\s+.*-recurse\s+.*c:\\/i,
  /rm\s+-rf\s+\//i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\breg\s+delete\b/i,
  /\bshutdown\b/i,
  /\bdel\s+\/s\s+\/q\s+c:\\/i,
  /\bcipher\b/i,
  /\bbcdedit\b/i,
  /\btakeown\b.*[a-z]:\\/i,
  /\bicacls\b.*[a-z]:\\/i,
  /\brd\s+\/s\s+\/q\s+c:\\/i,
  /\brmdir\s+\/s\s+\/q\s+c:\\/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b:\(\)\s*\{\s*:\|:&\s*\}\;/,
  /\bpowershell\s+-enc/i,
  /\bcurl\s+.*\|\s*(ba)?sh/i,
  /\bwget\s+.*\|\s*(ba)?sh/i,
];

export interface CommandGuardResult {
  allowed: boolean;
  reason?: string;
  matchedPattern?: string;
}

export function isDangerousCommand(command: string): CommandGuardResult {
  const normalized = command.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return { allowed: false, reason: "Empty command" };
  }

  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        allowed: false,
        reason: "Command matches blocked dangerous pattern",
        matchedPattern: pattern.source,
      };
    }
  }

  return { allowed: true };
}

/** Block scripts that invoke binaries via absolute paths outside npm run conventions */
export function hasSuspiciousAbsolutePath(command: string): boolean {
  const winAbs = /(?:^|\s)([a-z]:\\[^\s|&;]+)/gi;
  const unixAbs = /(?:^|\s)(\/(?:usr|bin|etc|var|tmp|home|root)[^\s|&;]*)/gi;
  return winAbs.test(command) || unixAbs.test(command);
}
