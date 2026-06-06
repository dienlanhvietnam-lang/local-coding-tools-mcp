export type TruncateMode = "head" | "head_tail";

export interface TruncateResult {
  text: string;
  truncated: boolean;
  originalChars: number;
  returnedChars: number;
  hint?: string;
}

const TAIL_RATIO = 0.3;
const MARKER_RESERVE = 80;

/**
 * Truncate text while keeping the result self-describing.
 *
 * - `head`: keep the beginning only (backward-compatible default).
 * - `head_tail`: keep ~70% from the start and ~30% from the end, so command
 *   output and logs retain both the invocation and the final error/result.
 *
 * When truncation happens a `hint` is always attached so the model knows how to
 * fetch the rest (narrower search, line-range read, or a cached resource).
 */
export function truncateStructured(
  text: string,
  maxChars: number,
  options: { mode?: TruncateMode; hint?: string } = {}
): TruncateResult {
  const originalChars = text.length;
  if (maxChars <= 0 || originalChars <= maxChars) {
    return {
      text,
      truncated: false,
      originalChars,
      returnedChars: originalChars,
    };
  }

  const mode = options.mode ?? "head";
  const removed = originalChars - maxChars;
  const marker = `\n...[truncated ${removed} chars]`;

  let out: string;
  if (mode === "head_tail" && maxChars > MARKER_RESERVE * 2) {
    const budget = Math.max(0, maxChars - MARKER_RESERVE);
    const tailChars = Math.floor(budget * TAIL_RATIO);
    const headChars = budget - tailChars;
    out =
      text.slice(0, headChars) +
      `\n...[truncated ${removed} chars]\n` +
      text.slice(originalChars - tailChars);
  } else {
    out = text.slice(0, maxChars) + marker;
  }

  return {
    text: out,
    truncated: true,
    originalChars,
    returnedChars: out.length,
    hint:
      options.hint ??
      "Output truncated. Re-run with a narrower scope, use a line range, or fetch the cached resource.",
  };
}
