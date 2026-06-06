export type PassFailStatus = "PASS" | "FAIL" | "PARTIAL" | "BLOCKED" | "SKIPPED";

export interface ToolMeta {
  riskLevel: "low" | "medium" | "high";
}

/**
 * Shared shape attached to tool results when output is reduced, so the model
 * always knows whether content was cut and how to retrieve the rest.
 */
export interface CompressionMeta {
  truncated?: boolean;
  originalChars?: number;
  hint?: string;
}

export function pass<T extends Record<string, unknown>>(data: T): T & { status: "PASS" } {
  return { status: "PASS", ...data };
}

export function fail<T extends Record<string, unknown>>(
  message: string,
  extra?: T
): { status: "FAIL"; error: string } & T {
  return { status: "FAIL", error: message, ...(extra ?? ({} as T)) };
}

export function partial<T extends Record<string, unknown>>(data: T): T & { status: "PARTIAL" } {
  return { status: "PARTIAL", ...data };
}

export function blocked(reason: string): { status: "BLOCKED"; error: string } {
  return { status: "BLOCKED", error: reason };
}

export function skipped<T extends Record<string, unknown>>(
  reason: string,
  extra?: T
): { status: "SKIPPED"; reason: string } & T {
  return { status: "SKIPPED", reason, ...(extra ?? ({} as T)) };
}
