import { redactSecrets } from "../safety/secretRedactor.js";
import { fetchHttpGet, isPrivateOrLocalHost, parseHttpUrl } from "../utils/httpFetch.js";
import { pass, fail } from "../utils/result.js";

export interface FetchUrlInput {
  url: string;
  timeoutMs?: number;
  maxBodyChars?: number;
}

export interface FetchUrlOutput {
  status: "PASS" | "FAIL";
  url: string;
  finalUrl?: string;
  httpStatus?: number;
  contentType?: string | null;
  body?: string;
  bodyTruncated?: boolean;
  durationMs?: number;
  redirectCount?: number;
  error?: string;
}

export async function fetchUrl(input: FetchUrlInput): Promise<FetchUrlOutput> {
  const parsed = parseHttpUrl(input.url);
  if (!parsed) {
    return fail("Invalid URL — only http/https supported", { url: input.url });
  }

  const start = Date.now();
  try {
    const result = await fetchHttpGet(input.url, {
      timeoutMs: input.timeoutMs,
      maxBodyChars: input.maxBodyChars,
    });

    const ok = result.httpStatus >= 200 && result.httpStatus < 400;
    const payload = {
      url: input.url,
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      body: redactSecrets(result.body),
      bodyTruncated: result.bodyTruncated,
      durationMs: result.durationMs,
      redirectCount: result.redirectCount,
    };

    return ok ? pass(payload) : fail(`HTTP ${result.httpStatus}`, payload);
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const hint = isPrivateOrLocalHost(parsed.hostname)
      ? " (local/private host — ensure the service is running)"
      : "";
    return fail(message + hint, { url: input.url, durationMs });
  }
}
