import { pass, fail, skipped } from "../utils/result.js";

export interface SearchWebInput {
  query: string;
  maxResults?: number;
}

export interface SearchWebResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchWebOutput {
  status: "PASS" | "FAIL" | "SKIPPED";
  query?: string;
  provider?: string;
  results?: SearchWebResult[];
  error?: string;
  reason?: string;
}

const DEFAULT_MAX_RESULTS = 5;

export async function searchWeb(input: SearchWebInput): Promise<SearchWebOutput> {
  const query = input.query?.trim();
  if (!query) {
    return fail("Query is required");
  }

  const maxResults = Math.min(Math.max(input.maxResults ?? DEFAULT_MAX_RESULTS, 1), 10);

  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (braveKey) {
    return searchBrave(query, maxResults, braveKey);
  }

  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (serperKey) {
    return searchSerper(query, maxResults, serperKey);
  }

  return searchDuckDuckGoLite(query, maxResults);
}

async function searchBrave(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchWebOutput> {
  try {
    const url = new URL("https://api.search.brave.com/res/v1/web/search");
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(maxResults));

    const response = await fetch(url.href, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": apiKey,
      },
    });

    if (!response.ok) {
      return fail(`Brave Search API HTTP ${response.status}`, { query, provider: "brave" });
    }

    const data = (await response.json()) as {
      web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
    };

    const results: SearchWebResult[] = (data.web?.results ?? [])
      .slice(0, maxResults)
      .map((r) => ({
        title: r.title ?? "",
        url: r.url ?? "",
        snippet: r.description ?? "",
      }))
      .filter((r) => r.url);

    return pass({ query, provider: "brave", results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { query, provider: "brave" });
  }
}

async function searchSerper(
  query: string,
  maxResults: number,
  apiKey: string
): Promise<SearchWebOutput> {
  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: maxResults }),
    });

    if (!response.ok) {
      return fail(`Serper API HTTP ${response.status}`, { query, provider: "serper" });
    }

    const data = (await response.json()) as {
      organic?: Array<{ title?: string; link?: string; snippet?: string }>;
    };

    const results: SearchWebResult[] = (data.organic ?? [])
      .slice(0, maxResults)
      .map((r) => ({
        title: r.title ?? "",
        url: r.link ?? "",
        snippet: r.snippet ?? "",
      }))
      .filter((r) => r.url);

    return pass({ query, provider: "serper", results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { query, provider: "serper" });
  }
}

async function searchDuckDuckGoLite(
  query: string,
  maxResults: number
): Promise<SearchWebOutput> {
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);

    const response = await fetch(url.href, {
      headers: {
        "User-Agent": "local-coding-tools-mcp/0.9.0",
        Accept: "text/html",
      },
    });

    if (!response.ok) {
      return skipped("duckduckgo_unavailable", {
        query,
        reason: `DuckDuckGo HTTP ${response.status} — set BRAVE_SEARCH_API_KEY or SERPER_API_KEY`,
      });
    }

    const html = await response.text();
    const results = parseDuckDuckGoHtml(html, maxResults);

    if (results.length === 0) {
      return skipped("no_results", {
        query,
        reason:
          "No parseable results from DuckDuckGo Lite — set BRAVE_SEARCH_API_KEY or SERPER_API_KEY for reliable search",
      });
    }

    return pass({ query, provider: "duckduckgo_lite", results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return skipped("duckduckgo_error", {
      query,
      reason: `${message} — set BRAVE_SEARCH_API_KEY or SERPER_API_KEY`,
    });
  }
}

function parseDuckDuckGoHtml(html: string, maxResults: number): SearchWebResult[] {
  const results: SearchWebResult[] = [];
  const resultBlockRe =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<td[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/td>)?/gi;

  let match: RegExpExecArray | null;
  while ((match = resultBlockRe.exec(html)) !== null && results.length < maxResults) {
    const rawUrl = decodeHtmlEntities(match[1]);
    const title = stripTags(decodeHtmlEntities(match[2]));
    const snippet = stripTags(decodeHtmlEntities(match[3] ?? match[4] ?? ""));

    const resolvedUrl = resolveDuckDuckGoRedirect(rawUrl);
    if (resolvedUrl && title) {
      results.push({ title, url: resolvedUrl, snippet });
    }
  }

  return results;
}

function resolveDuckDuckGoRedirect(href: string): string | null {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  try {
    const u = new URL(href, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    return uddg ? decodeURIComponent(uddg) : null;
  } catch {
    return null;
  }
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
