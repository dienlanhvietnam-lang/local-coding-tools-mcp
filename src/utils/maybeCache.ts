import { CACHE_MAX_BYTES } from "../config.js";
import { storeLargeOutput } from "../cache/outputCache.js";

/**
 * If a tool result serializes larger than the cache threshold, move it to the
 * cache store and return a compact reference (preview + uri) instead of the
 * full payload. Mirrors Cursor's blob indirection (textBlobId).
 */
export function maybeCache<T extends object>(
  workspacePath: string | undefined,
  toolName: string,
  result: T
): T | Record<string, unknown> {
  if (!workspacePath) return result;

  const serialized = JSON.stringify(result);
  if (serialized.length <= CACHE_MAX_BYTES) return result;

  const stored = storeLargeOutput(workspacePath, serialized, { toolName });
  return {
    status: (result as { status?: unknown }).status ?? "PASS",
    cached: true,
    cacheId: stored.id,
    cacheUri: stored.uri,
    originalChars: stored.originalChars,
    preview: stored.preview,
    hint: `Result was ${stored.originalChars} chars; stored as resource. Read full output with fetch_cached_output (cacheId) or the ${stored.uri} resource.`,
  };
}
