import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/** Read-only inspection tools — Cursor Auto-review thường cho qua nhanh hơn */
export const READ_ONLY: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

/** Tools that modify workspace files */
export const WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

/** Script execution / side effects */
export const EXECUTE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: false,
};

/** Network / external */
export const NETWORK: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: true,
  idempotentHint: true,
};

/** Batch workflow — 1 approval thay vì nhiều tool riêng lẻ */
export const BATCH: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

/** Image read (metadata) */
export const IMAGE_READ: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

/** Image transform (crop/resize/write output) */
export const IMAGE_WRITE: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: false,
};

/** Background removal — may call external API */
export const IMAGE_NETWORK: ToolAnnotations = {
  readOnlyHint: false,
  destructiveHint: false,
  openWorldHint: true,
  idempotentHint: false,
};
