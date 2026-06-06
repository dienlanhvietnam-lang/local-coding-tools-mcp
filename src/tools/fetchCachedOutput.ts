import { MAX_OUTPUT_CHARS } from "../config.js";
import { readCache, readCacheFromWorkspace } from "../cache/outputCache.js";
import { pass, fail } from "../utils/result.js";
import { truncateStructured } from "../utils/truncateStructured.js";

export interface FetchCachedOutputInput {
  workspacePath: string;
  cacheId: string;
  maxChars?: number;
}

export interface FetchCachedOutputOutput {
  status: "PASS" | "FAIL";
  cacheId?: string;
  content?: string;
  truncated?: boolean;
  hint?: string;
  error?: string;
}

export async function fetchCachedOutput(
  input: FetchCachedOutputInput
): Promise<FetchCachedOutputOutput> {
  const cacheId = input.cacheId?.trim();
  if (!cacheId) return fail("cacheId is required");

  const fromRegistry = readCache(cacheId);
  const raw = fromRegistry?.content ?? readCacheFromWorkspace(input.workspacePath, cacheId);

  if (raw === null || raw === undefined) {
    return fail("Cache entry not found or expired", { cacheId });
  }

  const maxChars = input.maxChars ?? MAX_OUTPUT_CHARS;
  const result = truncateStructured(raw, maxChars, {
    mode: "head",
    hint: "Cached output still exceeds maxChars. Raise maxChars to read more.",
  });

  return pass({
    cacheId,
    content: result.text,
    truncated: result.truncated,
    hint: result.truncated ? result.hint : undefined,
  });
}
