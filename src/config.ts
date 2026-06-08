import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_NAME = "local-coding-tools-mcp";
export const SERVER_VERSION = "0.18.0";

/** Max image file size for read/process (50 MB) */
export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

/** Max images per image_batch call */
export const MAX_BATCH_IMAGES = 20;

/** Max upscale multiplier per image_upscale call */
export const MAX_UPSCALE_FACTOR = 4;

/** Project root (parent of dist/ or src/) */
export const PROJECT_ROOT = path.resolve(__dirname, "..");

/** JSONL log file for tool calls */
export const TOOL_CALL_LOG_PATH = path.join(PROJECT_ROOT, "logs", "mcp-tool-calls.jsonl");

export const DEFAULT_SCRIPT_TIMEOUT_MS = 120_000;
export const DEFAULT_URL_TIMEOUT_MS = 10_000;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Max characters returned by a single tool before truncation kicks in. */
export const MAX_OUTPUT_CHARS = envInt("MCP_MAX_OUTPUT_CHARS", 20_000);

/** Runtime read so tests and env changes apply without restart. */
export function getMaxOutputChars(): number {
  return envInt("MCP_MAX_OUTPUT_CHARS", 20_000);
}

/** Default number of lines returned by line-range reads. */
export const READ_DEFAULT_LINES = envInt("MCP_READ_DEFAULT_LINES", 80);

/** Hard cap on lines returned by a single line-range read. */
export const READ_MAX_LINES = envInt("MCP_READ_MAX_LINES", 200);

/** Payload size (bytes) above which a tool result is moved to the cache store. */
export const CACHE_MAX_BYTES = envInt("MCP_CACHE_MAX_BYTES", 524_288);

/** Time-to-live (ms) for cached tool outputs under .mcp-debug/cache/. */
export const CACHE_TTL_MS = envInt("MCP_CACHE_TTL_MS", 3_600_000);

export const MAX_REDIRECTS = 3;

/** Default max response body chars for fetch_url / fetchHttpGet (256KB, same as http_request). */
export const DEFAULT_FETCH_MAX_BODY = 262_144;

/** Response header keys returned by check_url when includeAllHeaders is false. */
export const CHECK_URL_HEADER_KEYS = [
  "content-type",
  "content-length",
  "location",
  "server",
  "cache-control",
] as const;

export function httpUserAgent(): string {
  return `${SERVER_NAME}/${SERVER_VERSION}`;
}

/** Sensitive filenames never copied into debug bundles */
export const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\..+)?$/i,
  /credentials/i,
  /secrets?\.(json|ya?ml|toml)$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
  /token/i,
];
