const SHELL_METACHAR_RE = /[;&|`$()<>]/;

/** Commands allowed for run_safe_command — never shell/terminal. */
export const SAFE_COMMAND_ALLOWLIST = new Set([
  "node",
  "npm",
  "pnpm",
  "git",
  "python",
  "python3",
  "powershell",
  "pwsh",
]);

export interface SafeCommandValidation {
  allowed: boolean;
  reason?: string;
}

export function validateSafeCommand(command: string, args: string[]): SafeCommandValidation {
  const normalized = command.toLowerCase().replace(/\.exe$/i, "").replace(/\.cmd$/i, "");

  if (!SAFE_COMMAND_ALLOWLIST.has(normalized)) {
    return {
      allowed: false,
      reason: `Command "${command}" not in allowlist: ${[...SAFE_COMMAND_ALLOWLIST].join(", ")}`,
    };
  }

  if (command.includes(" ") || SHELL_METACHAR_RE.test(command)) {
    return { allowed: false, reason: "Command must not contain spaces or shell metacharacters" };
  }

  for (const arg of args) {
    if (SHELL_METACHAR_RE.test(arg)) {
      return {
        allowed: false,
        reason: `Argument contains shell metacharacters: ${arg}`,
      };
    }
    if (arg.includes("\n") || arg.includes("\r")) {
      return { allowed: false, reason: "Arguments must not contain newlines" };
    }
  }

  return { allowed: true };
}
