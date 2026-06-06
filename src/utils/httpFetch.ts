import {
  CHECK_URL_HEADER_KEYS,
  DEFAULT_FETCH_MAX_BODY,
  DEFAULT_URL_TIMEOUT_MS,
  MAX_REDIRECTS,
  httpUserAgent,
} from "../config.js";
import { truncateStructured } from "./truncateStructured.js";

export interface FetchUrlResult {
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  headers: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  hint?: string;
  durationMs: number;
  redirectCount: number;
}

export interface ProbeHttpResult {
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  headers: Record<string, string>;
  durationMs: number;
  redirectCount: number;
}

export function parseHttpUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("10.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

function collectHeaders(response: Response, includeAllHeaders: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeAllHeaders) {
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  const allowed = new Set(CHECK_URL_HEADER_KEYS.map((key) => key.toLowerCase()));
  response.headers.forEach((value, key) => {
    if (allowed.has(key.toLowerCase())) {
      headers[key] = value;
    }
  });
  return headers;
}

async function fetchWithManualRedirects(
  inputUrl: string,
  options: { timeoutMs: number; readBody: boolean; maxBodyChars: number }
): Promise<{
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  headers: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  hint?: string;
  durationMs: number;
  redirectCount: number;
}> {
  const parsed = parseHttpUrl(inputUrl);
  if (!parsed) {
    throw new Error("Invalid URL — only http/https supported");
  }

  const start = Date.now();
  let redirectCount = 0;
  let currentUrl = parsed.href;

  while (redirectCount <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": httpUserAgent() },
      });

      const headers = collectHeaders(response, true);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          const bodyResult = options.readBody
            ? await readBodyText(response, options.maxBodyChars)
            : { body: "", bodyTruncated: false };
          return {
            finalUrl: currentUrl,
            httpStatus: response.status,
            contentType: response.headers.get("content-type"),
            headers,
            ...bodyResult,
            durationMs: Date.now() - start,
            redirectCount,
          };
        }
        redirectCount++;
        if (redirectCount > MAX_REDIRECTS) {
          throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
        }
        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const bodyResult = options.readBody
        ? await readBodyText(response, options.maxBodyChars)
        : { body: "", bodyTruncated: false };

      return {
        finalUrl: currentUrl,
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        headers,
        ...bodyResult,
        durationMs: Date.now() - start,
        redirectCount,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Redirect loop or limit exceeded");
}

export async function probeHttpGet(
  inputUrl: string,
  options: { timeoutMs?: number; includeAllHeaders?: boolean } = {}
): Promise<ProbeHttpResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  const includeAllHeaders = options.includeAllHeaders ?? false;
  const result = await fetchWithManualRedirects(inputUrl, {
    timeoutMs,
    readBody: false,
    maxBodyChars: 0,
  });

  return {
    finalUrl: result.finalUrl,
    httpStatus: result.httpStatus,
    contentType: result.contentType,
    headers: includeAllHeaders
      ? result.headers
      : collectHeadersFromMap(result.headers, false),
    durationMs: result.durationMs,
    redirectCount: result.redirectCount,
  };
}

function collectHeadersFromMap(
  headers: Record<string, string>,
  includeAllHeaders: boolean
): Record<string, string> {
  if (includeAllHeaders) return headers;
  const allowed = new Set(CHECK_URL_HEADER_KEYS.map((key) => key.toLowerCase()));
  const filtered: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (allowed.has(key.toLowerCase())) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export async function fetchHttpGet(
  inputUrl: string,
  options: { timeoutMs?: number; maxBodyChars?: number } = {}
): Promise<FetchUrlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  const maxBodyChars = options.maxBodyChars ?? DEFAULT_FETCH_MAX_BODY;
  const result = await fetchWithManualRedirects(inputUrl, {
    timeoutMs,
    readBody: true,
    maxBodyChars,
  });

  return {
    finalUrl: result.finalUrl,
    httpStatus: result.httpStatus,
    contentType: result.contentType,
    headers: result.headers,
    body: result.body,
    bodyTruncated: result.bodyTruncated,
    hint: result.hint,
    durationMs: result.durationMs,
    redirectCount: result.redirectCount,
  };
}

async function readBodyText(
  response: Response,
  maxBodyChars: number
): Promise<{ body: string; bodyTruncated: boolean; hint?: string }> {
  const raw = await response.text();
  const result = truncateStructured(raw, maxBodyChars, {
    mode: "head_tail",
    hint: "Response body truncated. Request a narrower resource or use range/query parameters to reduce size.",
  });
  return { body: result.text, bodyTruncated: result.truncated, hint: result.hint };
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD";

export interface HttpRequestResult {
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  headers: Record<string, string>;
  body: string;
  bodyTruncated: boolean;
  hint?: string;
  durationMs: number;
}

export async function fetchHttp(
  method: HttpMethod,
  inputUrl: string,
  options: {
    timeoutMs?: number;
    maxBodyChars?: number;
    headers?: Record<string, string>;
    body?: string;
  } = {}
): Promise<HttpRequestResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  const maxBodyChars = options.maxBodyChars ?? DEFAULT_FETCH_MAX_BODY;
  const parsed = parseHttpUrl(inputUrl);
  if (!parsed) {
    throw new Error("Invalid URL — only http/https supported");
  }

  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(parsed.href, {
      method,
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": httpUserAgent(),
        ...(options.headers ?? {}),
      },
      body: method === "GET" || method === "HEAD" ? undefined : options.body,
    });

    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const bodyResult =
      method === "HEAD"
        ? { body: "", bodyTruncated: false }
        : await readBodyText(response, maxBodyChars);

    return {
      finalUrl: response.url || parsed.href,
      httpStatus: response.status,
      contentType: response.headers.get("content-type"),
      headers,
      ...bodyResult,
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}
