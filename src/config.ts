import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SERVER_NAME = "local-coding-tools-mcp";
export const SERVER_VERSION = "0.10.0";

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
export const MAX_OUTPUT_CHARS = 20_000;
export const MAX_REDIRECTS = 3;

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
