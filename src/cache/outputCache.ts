import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { CACHE_TTL_MS } from "../config.js";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";

export const CACHE_URI_SCHEME = "mcp-cache";
const CACHE_DIR_REL = ".mcp-debug/cache";

export interface CacheEntryMeta {
  id: string;
  uri: string;
  absPath: string;
  workspacePath: string;
  toolName: string;
  mimeType: string;
  originalChars: number;
  createdAt: string;
  ttlMs: number;
}

export interface StoredOutput {
  id: string;
  uri: string;
  preview: string;
  originalChars: number;
}

/** In-memory index so MCP Resource reads can resolve an id to a file path. */
const registry = new Map<string, CacheEntryMeta>();

function cacheUri(id: string): string {
  return `${CACHE_URI_SCHEME}://${id}`;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [id, meta] of registry) {
    const age = now - new Date(meta.createdAt).getTime();
    if (age > meta.ttlMs) {
      try {
        if (fs.existsSync(meta.absPath)) fs.unlinkSync(meta.absPath);
      } catch {
        // ignore
      }
      registry.delete(id);
    }
  }
}

export function storeLargeOutput(
  workspacePath: string,
  payload: string,
  options: { toolName: string; mimeType?: string; previewChars?: number } = { toolName: "unknown" }
): StoredOutput {
  cleanupExpired();

  const validation = validateWorkspacePath(workspacePath);
  const resolvedWorkspace = validation.ok ? validation.resolvedPath! : workspacePath;

  const id = randomUUID();
  const relPath = `${CACHE_DIR_REL}/${id}.json`;
  const absPath = assertWithinWorkspace(resolvedWorkspace, relPath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, payload, "utf8");

  const meta: CacheEntryMeta = {
    id,
    uri: cacheUri(id),
    absPath,
    workspacePath: resolvedWorkspace,
    toolName: options.toolName,
    mimeType: options.mimeType ?? "application/json",
    originalChars: payload.length,
    createdAt: new Date().toISOString(),
    ttlMs: CACHE_TTL_MS,
  };
  registry.set(id, meta);

  const previewChars = options.previewChars ?? 800;
  return {
    id,
    uri: meta.uri,
    preview: payload.slice(0, previewChars),
    originalChars: payload.length,
  };
}

/** Resolve a cache id via the in-memory registry (used by MCP Resource reads). */
export function readCache(id: string): { meta: CacheEntryMeta; content: string } | null {
  const meta = registry.get(id);
  if (!meta) return null;
  try {
    const content = fs.readFileSync(meta.absPath, "utf8");
    return { meta, content };
  } catch {
    registry.delete(id);
    return null;
  }
}

/**
 * Resolve a cache id by reading directly from a workspace cache dir. Survives
 * server restarts where the in-memory registry is empty.
 */
export function readCacheFromWorkspace(
  workspacePath: string,
  id: string
): string | null {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) return null;
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return null;
  try {
    const absPath = assertWithinWorkspace(
      validation.resolvedPath!,
      `${CACHE_DIR_REL}/${id}.json`
    );
    if (!fs.existsSync(absPath)) return null;
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

export function listCacheEntries(): CacheEntryMeta[] {
  cleanupExpired();
  return [...registry.values()];
}

/** Parse an id out of an mcp-cache:// URI. */
export function parseCacheId(uri: string): string | null {
  const prefix = `${CACHE_URI_SCHEME}://`;
  if (!uri.startsWith(prefix)) return null;
  return uri.slice(prefix.length) || null;
}
