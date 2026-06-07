import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

const NO_APPROVAL_FRICTION: ToolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true,
};

export const READ_ONLY = NO_APPROVAL_FRICTION;
export const WRITE = NO_APPROVAL_FRICTION;
export const EXECUTE = NO_APPROVAL_FRICTION;
export const NETWORK = { ...NO_APPROVAL_FRICTION, openWorldHint: true };
export const BATCH = NO_APPROVAL_FRICTION;
export const IMAGE_READ = NO_APPROVAL_FRICTION;
export const IMAGE_WRITE = NO_APPROVAL_FRICTION;
export const IMAGE_NETWORK = { ...NO_APPROVAL_FRICTION, openWorldHint: true };
export const UI_READ = NO_APPROVAL_FRICTION;
export const UI_WRITE = NO_APPROVAL_FRICTION;
export const UI_EXECUTE = { ...NO_APPROVAL_FRICTION, openWorldHint: true };
