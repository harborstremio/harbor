import { safeFetch } from "@/lib/safe-fetch";
import { normalizeLang } from "@/lib/subtitles/language";
import type { SubSearchQuery } from "@/lib/subtitles/types";
import {
  isSeries,
  wantedLangs,
  markRateLimited,
  type ProviderCtx,
  type SourceSubCandidate,
  type SubSource,
} from "./sub-sources";

const BASE = "https://www.podnapisi.net";

function downloadFor(pid: string | null): string | null {
  return pid ? `${BASE}/subtitles/${pid}/download` : null;
}

function parseXml(text: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    return doc.querySelector("parsererror") ? null : doc;
  } catch {
    return null;
  }
}

function tag(el: Element, name: string): string | null {
  return el.getElementsByTagName(name)[0]?.textContent?.trim() || null;
}

async function searchByHash(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
  if (!q.videoHash) return null;
  const url = `${BASE}/subtitles/search/old?sMH=${encodeURIComponent(q.videoHash)}&sXML=1`;
  let res: Response;
  try {
    res = await safeFetch(url, { headers: { "User-Agent": ctx.userAgent, Accept: "application/xml" } });
  } catch {
    return null;
  }
  if (res.status === 429) {
    markRateLimited("podnapisi", 30);
    return null;
  }
  if (!res.ok) return null;
  const doc = parseXml(await res.text().catch(() => ""));
  if (!doc) return null;
  const want = new Set(wantedLangs(q));
  const out: SourceSubCandidate[] = [];
  for (const el of Array.from(doc.getElementsByTagName("subtitle"))) {
    const pid = tag(el, "pid") ?? tag(el, "id");
    const lang = normalizeLang(tag(el, "language") ?? tag(el, "languageId") ?? "");
    const flags = (tag(el, "flags") ?? "").toLowerCase();
    out.push({
      provider: "podnapisi",
      id: pid ?? `${lang}:${tag(el, "release") ?? ""}`,
      url: downloadFor(pid),
      pageUrl: tag(el, "url"),
      lang,
      release: tag(el, "release"),
      format: "zip",
      hearingImpaired: flags.includes("h"),
      foreignOnly: flags.includes("f"),
      machineTranslated: false,
      fps: Number(tag(el, "fps")) || null,
      downloads: Number(tag(el, "downloads")) || 0,
      fromTrusted: false,
      hashMatched: true,
      langConfirmed: want.size === 0 || want.has(lang),
      episodeConfirmed: false,
      idConfirmed: false,
      matchScore: 0,
    });
  }
  return out;
}

type PnRow = {
  id?: string;
  language?: string;
  hearing_impaired?: boolean;
  foreign?: boolean;
  fps?: number;
  releases?: string[];
  download?: string;
  url?: string;
};

async function searchByMeta(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
  if (!q.title) return [];
  const langs = wantedLangs(q);
  const params = new URLSearchParams({
    keywords: q.title,
    movie_type: isSeries(q) ? "tv-series" : "movie",
  });
  const year = (q as { year?: number }).year;
  if (year) params.set("year", String(year));
  if (q.season != null) params.set("seasons", String(q.season));
  if (q.episode != null) params.set("episodes", String(q.episode));
  for (const l of langs) params.append("language", l);

  let res: Response;
  try {
    res = await safeFetch(`${BASE}/subtitles/search/advanced?${params.toString()}`, {
      headers: { "User-Agent": ctx.userAgent, Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (res.status === 429) {
    markRateLimited("podnapisi", 30);
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as { data?: PnRow[] } | null;
  const rows = Array.isArray(data?.data) ? (data as { data: PnRow[] }).data : [];
  const want = new Set(langs);
  return rows.map((r) => {
    const lang = normalizeLang(r.language ?? "");
    const dl = r.download ?? (r.url ? `${r.url}/download` : null);
    return {
      provider: "podnapisi",
      id: r.id ?? `${lang}:${r.releases?.[0] ?? ""}`,
      url: dl ? `${BASE}${dl.startsWith("/") ? dl : `/${dl}`}` : null,
      pageUrl: r.url ? `${BASE}${r.url}` : null,
      lang,
      release: r.releases?.[0] ?? null,
      format: "zip",
      hearingImpaired: r.hearing_impaired === true,
      foreignOnly: r.foreign === true,
      machineTranslated: false,
      fps: r.fps ?? null,
      downloads: 0,
      fromTrusted: false,
      hashMatched: false,
      langConfirmed: want.size === 0 || want.has(lang),
      episodeConfirmed: false,
      idConfirmed: false,
      matchScore: 0,
    };
  });
}

export const podnapisiSource: SubSource = {
  id: "podnapisi",
  supportsHash: true,
  supportsMovie: true,
  supportsTv: true,
  async search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
    if (q.videoHash) {
      const byHash = await searchByHash(q, ctx);
      if (byHash && byHash.length) return byHash;
    }
    return searchByMeta(q, ctx);
  },
};
