import { DEFAULT_URL_TIMEOUT_MS, MAX_REDIRECTS } from "../config.js";
import { pass, fail } from "../utils/result.js";

export interface CheckUrlInput {
  url: string;
  timeoutMs?: number;
}

export interface CheckUrlOutput {
  status: "PASS" | "FAIL";
  url: string;
  httpStatus?: number;
  durationMs?: number;
  error?: string;
  redirectCount?: number;
}

function isPrivateOrLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h === "::1" || h === "[::1]") return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("10.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  return false;
}

export async function checkUrl(input: CheckUrlInput): Promise<CheckUrlOutput> {
  const timeoutMs = input.timeoutMs ?? DEFAULT_URL_TIMEOUT_MS;
  let parsed: URL;

  try {
    parsed = new URL(input.url);
  } catch {
    return fail("Invalid URL", { url: input.url });
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return fail("Only http and https URLs are supported", { url: input.url });
  }

  const start = Date.now();
  let redirectCount = 0;
  let currentUrl = parsed.href;

  try {
    while (redirectCount <= MAX_REDIRECTS) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: controller.signal,
          headers: { "User-Agent": "local-coding-tools-mcp/0.1.0" },
        });

        clearTimeout(timer);
        const durationMs = Date.now() - start;

        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) {
            return pass({
              url: input.url,
              httpStatus: response.status,
              durationMs,
              redirectCount,
            });
          }
          redirectCount++;
          if (redirectCount > MAX_REDIRECTS) {
            return fail(`Too many redirects (max ${MAX_REDIRECTS})`, {
              url: input.url,
              durationMs,
              redirectCount,
            });
          }
          currentUrl = new URL(location, currentUrl).href;
          continue;
        }

        const ok = response.status >= 200 && response.status < 400;
        return ok
          ? pass({
              url: input.url,
              httpStatus: response.status,
              durationMs,
              redirectCount,
            })
          : fail(`HTTP ${response.status}`, {
              url: input.url,
              httpStatus: response.status,
              durationMs,
              redirectCount,
            });
      } finally {
        clearTimeout(timer);
      }
    }

    return fail("Redirect loop or limit exceeded", { url: input.url, redirectCount });
  } catch (err) {
    const durationMs = Date.now() - start;
    const message = err instanceof Error ? err.message : String(err);
    const hint = isPrivateOrLocalHost(parsed.hostname)
      ? " (local/private host — ensure the service is running)"
      : "";
    return fail(message + hint, { url: input.url, durationMs, redirectCount });
  }
}
