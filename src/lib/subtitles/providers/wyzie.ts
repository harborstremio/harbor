import { normalizeLang } from "../language";
import type { SubResult, SubSearchQuery } from "../types";

const ENDPOINT = "https://sub.wyzie.io/search";

type RawWyzie = {
  id?: string | number;
  url?: string;
  display?: string;
  language?: string;
  format?: string;
  encoding?: string;
  source?: string;
  isHearingImpaired?: boolean;
  hi?: boolean;
  release?: string;
  flagUrl?: string;
  fps?: number;
  downloads?: number;
};

export async function searchWyzie(q: SubSearchQuery): Promise<SubResult[]> {
  const params = new URLSearchParams();
  if (q.imdbId) params.set("id", q.imdbId.startsWith("tt") ? q.imdbId : `tt${q.imdbId}`);
  else if (q.tmdbId) params.set("id", q.tmdbId);
  else if (q.title) params.set("query", q.title);
  else return [];
  if (q.season != null) params.set("season", String(q.season));
  if (q.episode != null) params.set("episode", String(q.episode));
  params.set("source", "all");
  if (q.langs && q.langs.length > 0) {
    params.set("language", q.langs.map((l) => normalizeLang(l)).join(","));
  }
  let resp: Response;
  try {
    resp = await fetch(`${ENDPOINT}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
  } catch {
    return [];
  }
  if (!resp.ok) return [];
  let data: unknown;
  try {
    data = await resp.json();
  } catch {
    return [];
  }
  const arr: RawWyzie[] = Array.isArray(data) ? (data as RawWyzie[]) : [];
  const out: SubResult[] = [];
  for (const r of arr) {
    if (!r.url) continue;
    const lang = normalizeLang(r.language) || "en";
    const fmt = (r.format || "").toLowerCase();
    out.push({
      id: String(r.id ?? r.url),
      url: r.url,
      lang,
      langName: r.display,
      title: r.release,
      source: "wyzie",
      format: (fmt as SubResult["format"]) || undefined,
      encoding: r.encoding,
      fps: r.fps,
      hearingImpaired: r.isHearingImpaired || r.hi || false,
      release: r.release,
      downloads: r.downloads,
    });
  }
  return out;
}
