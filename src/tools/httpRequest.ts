import { redactSecrets } from "../safety/secretRedactor.js";
import { fetchHttp, isPrivateOrLocalHost, parseHttpUrl, type HttpMethod } from "../utils/httpFetch.js";
import { pass, fail } from "../utils/result.js";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"];

export interface HttpRequestInput {
  url: string;
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBodyChars?: number;
}

export interface HttpRequestOutput {
  status: "PASS" | "FAIL";
  url: string;
  method?: string;
  finalUrl?: string;
  httpStatus?: number;
  contentType?: string | null;
  headers?: Record<string, string>;
  body?: string;
  bodyTruncated?: boolean;
  durationMs?: number;
  privateHost?: boolean;
  error?: string;
}

export async function httpRequest(input: HttpRequestInput): Promise<HttpRequestOutput> {
  const parsed = parseHttpUrl(input.url);
  if (!parsed) {
    return fail("Invalid URL — only http/https supported", { url: input.url });
  }

  const method = (input.method ?? "GET").toUpperCase() as HttpMethod;
  if (!METHODS.includes(method)) {
    return fail(`Unsupported method ${method}`, { url: input.url });
  }

  const privateHost = isPrivateOrLocalHost(parsed.hostname);

  try {
    const result = await fetchHttp(method, input.url, {
      timeoutMs: input.timeoutMs,
      maxBodyChars: input.maxBodyChars,
      headers: input.headers,
      body: input.body,
    });

    const ok = result.httpStatus >= 200 && result.httpStatus < 400;
    const payload = {
      url: input.url,
      method,
      finalUrl: result.finalUrl,
      httpStatus: result.httpStatus,
      contentType: result.contentType,
      headers: result.headers,
      body: redactSecrets(result.body),
      bodyTruncated: result.bodyTruncated,
      durationMs: result.durationMs,
      privateHost,
    };
    return ok ? pass(payload) : fail(`HTTP ${result.httpStatus}`, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = privateHost ? " (local/private host)" : "";
    return fail(message + hint, { url: input.url, method, privateHost });
  }
}
