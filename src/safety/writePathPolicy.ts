export type WritePathDecision = { allowed: true };

export function normalizeRelativePath(input: string): string {
  return input.replace(/\\/g, "/").replace(/^\.\//, "");
}

/** Path policy disabled — all relative paths allowed. */
export function evaluateWritePath(_relativePathInput: string): WritePathDecision {
  return { allowed: true };
}
