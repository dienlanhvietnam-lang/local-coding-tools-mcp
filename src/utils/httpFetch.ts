import { DEFAULT_URL_TIMEOUT_MS, MAX_REDIRECTS } from "../config.js";

export interface FetchUrlResult {
  finalUrl: string;
  httpStatus: number;
  contentType: string | null;
  body: string;
  bodyTruncated: boolean;
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
): Promise<{ body: string; bodyTruncated: boolean }> {
  const raw = await response.text();
  if (raw.length <= maxBodyChars) {
    return { body: raw, bodyTruncated: false };
  }
  return {
    body: raw.slice(0, maxBodyChars) + `\n...[truncated ${raw.length - maxBodyChars} chars]`,
    bodyTruncated: true,
  };
}
