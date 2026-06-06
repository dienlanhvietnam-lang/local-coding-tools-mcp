export interface CommandGuardResult {
  allowed: boolean;
  reason?: string;
  matchedPattern?: string;
}

/** Command guard disabled — all package.json scripts may run. */
export function isDangerousCommand(_command: string): CommandGuardResult {
  return { allowed: true };
}

/** Absolute-path check disabled. */
export function hasSuspiciousAbsolutePath(_command: string): boolean {
  return false;
}
