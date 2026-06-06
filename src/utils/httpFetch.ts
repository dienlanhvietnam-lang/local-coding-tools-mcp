import { DEFAULT_URL_TIMEOUT_MS, MAX_REDIRECTS } from "../config.js";
import { truncateStructured } from "./truncateStructured.js";

export interface FetchUrlResult {
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  body: string;
  bodyTruncated: boolean;
  hint?: string;
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

export async function fetchHttpGet(
  inputUrl: string,
  options: { timeoutMs?: number; maxBodyChars?: number } = {}
): Promise<FetchUrlResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  const maxBodyChars = options.maxBodyChars ?? 65_536;
  const parsed = parseHttpUrl(inputUrl);
  if (!parsed) {
    throw new Error("Invalid URL — only http/https supported");
  }

  const start = Date.now();
  let redirectCount = 0;
  let currentUrl = parsed.href;

  while (redirectCount <= MAX_REDIRECTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "local-coding-tools-mcp/0.9.0" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          const body = await readBodyText(response, maxBodyChars);
          return {
            finalUrl: currentUrl,
            httpStatus: response.status,
            contentType: response.headers.get("content-type"),
            ...body,
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

      const body = await readBodyText(response, maxBodyChars);
      return {
        finalUrl: currentUrl,
        httpStatus: response.status,
        contentType: response.headers.get("content-type"),
        ...body,
        durationMs: Date.now() - start,
        redirectCount,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  throw new Error("Redirect loop or limit exceeded");
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

const DEFAULT_HTTP_MAX_BODY = 262_144; // 256KB

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
  const maxBodyChars = options.maxBodyChars ?? DEFAULT_HTTP_MAX_BODY;
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
        "User-Agent": "local-coding-tools-mcp/0.10.0",
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
