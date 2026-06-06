import { isPrivateOrLocalHost, parseHttpUrl, probeHttpGet } from "../utils/httpFetch.js";
import { pass, fail } from "../utils/result.js";

export interface CheckUrlInput {
  url: string;
  timeoutMs?: number;
  includeAllHeaders?: boolean;
}

export interface CheckUrlOutput {
  status: "PASS" | "FAIL";
  url: string;
  finalUrl?: string;
  httpStatus?: number;
  contentType?: string | null;
  headers?: Record<string, string>;
  durationMs?: number;
  error?: string;
  redirectCount?: number;
  privateHost?: boolean;
}

export async function checkUrl(input: CheckUrlInput): Promise<CheckUrlOutput> {
  const parsed = parseHttpUrl(input.url);
  if (!parsed) {
    return fail("Invalid URL — only http and https URLs are supported", { url: input.url });
  }

  const privateHost = isPrivateOrLocalHost(parsed.hostname);
  const start = Date.now();

  try {
    const result = await probeHttpGet(input.url, {
      timeoutMs: input.timeoutMs,
      includeAllHeaders: input.includeAllHeaders,
    });

    const ok = result.httpStatus >= 200 && result.httpStatus < 400;
    const payload = {
      url: input.url,
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      headers: result.headers,
      durationMs: result.durationMs,
      redirectCount: result.redirectCount,
      privateHost,
    };

    return ok ? pass(payload) : fail(`HTTP ${result.httpStatus}`, payload);
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const hint = privateHost ? " (local/private host — ensure the service is running)" : "";
    return fail(message + hint, { url: input.url, durationMs, privateHost });
  }
}
