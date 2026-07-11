// Light wrapper around Jina's free Reader endpoint to power AI-search web augmentation.
// `r.jina.ai/` accepts an upstream URL as path arg, proxies the page through Jina's
// anti-bot layer, and returns clean markdown. It also accepts DuckDuckGo's HTML SERP
// as a search source for zero-key web discovery.

const READER = "https://r.jina.ai/";
const MAX_RESULTS = 8;
const MAX_SNIPPET_CHARS = 800;

export type WebHit = {
  title: string;
  url: string;
  snippet: string;
};

function decodeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname === "duckduckgo.com" && u.pathname === "/l/") {
      const real = u.searchParams.get("uddg");
      if (real) return decodeURIComponent(real);
    }
    return raw;
  } catch {
    return raw;
  }
}

function parseHits(md: string): WebHit[] {
  const hits: WebHit[] = [];
  const seen = new Set<string>();
  const lines = md.split(/\r?\n/);
  const isHostname = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  };

  const cleanText = (s: string) => s.replace(/\*+/g, "").replace(/\s+/g, " ").trim();

  for (let i = 0; i < lines.length && hits.length < MAX_RESULTS; i++) {
    const line = lines[i];
    if (/^\s*!\[/.test(line)) continue;
    if (/^\s*\{#/.test(line)) continue;
    const m = /^\s*##\s*\[([^\]]+)\]\(([^)]+)\)/.exec(line);
    if (!m) continue;

    let url = decodeUrl(m[2].trim());
    const host = isHostname(url);
    if (!host || /duckduckgo\.com|external-content\.duckduckgo\.com/i.test(host)) {
      let substituted = url;
      for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
        const ln = lines[j];
        if (/^\s*!\[/.test(ln)) continue;
        const pm = /^\s*\[([^\]]+)\]\(([^)]+)\)/.exec(ln);
        if (!pm) continue;
        const candidate = decodeUrl(pm[2].trim());
        const h = isHostname(candidate);
        if (h && !/duckduckgo\.com|external-content\.duckduckgo\.com/i.test(h)) {
          substituted = candidate;
          break;
        }
      }
      url = substituted;
    }

    const finalHost = isHostname(url);
    if (!finalHost || /duckduckgo\.com|external-content\.duckduckgo\.com/i.test(finalHost)) continue;
    if (!/^https?:\/\//.test(url)) continue;
    if (seen.has(url)) continue;

    let title = cleanText(m[1]);
    for (let j = i + 1; j < Math.min(lines.length, i + 12); j++) {
      const ln = lines[j];
      if (/^\s*!\[/.test(ln)) continue;
      const pm = /^\s*\[([^\]]+)\]\(([^)]+)\)/.exec(ln);
      if (!pm) continue;
      const candidate = cleanText(pm[1]);
      if (candidate.length > 18 && candidate !== title && !candidate.startsWith("![Image")) {
        title = candidate;
        break;
      }
    }
    if (title.length < 6) continue;

    seen.add(url);
    hits.push({ title, url, snippet: title.slice(0, MAX_SNIPPET_CHARS) });
  }
  return hits;
}

async function readerFetch(url: string, apiKey?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "text/plain" };
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey.trim()}`;
  const res = await fetch(READER + url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jina error (${res.status}). ${body.slice(0, 120)}`);
  }
  return res.text();
}

export async function webSearch(query: string, apiKey?: string): Promise<WebHit[]> {
  const q = query.trim();
  if (!q) return [];
  const upstream = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
  const md = await readerFetch(upstream, apiKey);
  return parseHits(md);
}

export async function readUrl(url: string, apiKey?: string): Promise<string> {
  return readerFetch(url, apiKey);
}

export function hitsToContext(hits: WebHit[]): string {
  if (hits.length === 0) return "";
  return hits
    .slice(0, MAX_RESULTS)
    .map((h, i) => `[${i + 1}] ${h.title} — ${h.url}\n${h.snippet}`)
    .join("\n\n");
}

export async function enrichWithContent(query: string, apiKey?: string): Promise<{ hits: WebHit[]; context: string }> {
  const hits = await webSearch(query, apiKey);
  if (hits.length === 0) return { hits: [], context: "" };

  const priority = (u: string) =>
    /wikipedia\.org|themoviedb\.org|rottentomatoes\.com|letterboxd\.com|metacritic\.com/i.test(u) ? 1 : 0;

  const promoted = [...hits].sort((a, b) => priority(b.url) - priority(a.url));
  const toFetch = promoted
    .slice(0, 3)
    .concat(
      promoted
        .slice(3)
        .filter((h) => priority(h.url) > 0)
        .slice(0, 1),
    )
    .slice(0, 4);

  const enriched = await Promise.all(
    toFetch.map(async (h) => {
      try {
        const md = await readUrl(h.url, apiKey);
        const body = md.split(/\r?\n/).slice(0, 60).join("\n");
        const cleaned = body
          .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/^#{1,6}\s+/gm, "")
          .slice(0, 1200)
          .trim();
        return { ...h, snippet: cleaned };
      } catch {
        return h;
      }
    }),
  );

  const byUrl = new Map(enriched.map((h) => [h.url, h]));
  const finalHits = hits.map((h) => byUrl.get(h.url) ?? h);

  const ctx = finalHits
    .slice(0, MAX_RESULTS)
    .map((h, i) => `[${i + 1}] ${h.title} — ${h.url}\n${h.snippet}`)
    .join("\n\n");
  return { hits: finalHits, context: ctx };
}
