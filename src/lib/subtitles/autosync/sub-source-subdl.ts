import { safeFetch } from "@/lib/safe-fetch";
import { dwarn, dinfo } from "@/lib/debug";
import { normalizeLang } from "@/lib/subtitles/language";
import type { SubSearchQuery } from "@/lib/subtitles/types";
import {
  imdbTt,
  isSeries,
  wantedLangs,
  detectFormat,
  markRateLimited,
  type ProviderCtx,
  type SourceSubCandidate,
  type SubSource,
} from "./sub-sources";
import { resolveSubtitleDownloadUrl } from "./download-url";

const BASE = "https://api.subdl.com/api/v1";
const DL = "https://dl.subdl.com";
const LANG_OVERRIDES: Record<string, string> = { "pt-br": "BR", "es-419": "ES", zh: "ZH" };

function subdlLangCode(code: string): string {
  const n = normalizeLang(code);
  return (LANG_OVERRIDES[n] ?? n.split("-")[0]).toUpperCase();
}

type SubdlRow = {
  release_name?: string;
  name?: string;
  lang?: string;
  language?: string;
  url?: string;
  subtitlePage?: string;
  season?: number;
  episode?: number;
  hi?: boolean;
  format?: string;
};

export const subdlSource: SubSource = {
  id: "subdl",
  supportsHash: false,
  supportsMovie: true,
  supportsTv: true,
  async search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
    if (!ctx.subdlApiKey) return null;
    const langs = wantedLangs(q);
    const params = new URLSearchParams({
      api_key: ctx.subdlApiKey,
      subs_per_page: "30",
      comment: "1",
      releases: "1",
    });
    const tt = imdbTt(q.imdbId);
    if (tt) params.set("imdb_id", tt);
    else if (q.tmdbId) params.set("tmdb_id", String(q.tmdbId));
    else if (q.title) params.set("film_name", q.title);
    else return [];
    params.set("type", isSeries(q) ? "tv" : "movie");
    if (langs.length) params.set("languages", langs.map(subdlLangCode).join(","));
    if (q.season != null) params.set("season_number", String(q.season));
    if (q.episode != null) params.set("episode_number", String(q.episode));

    let res: Response;
    try {
      res = await safeFetch(`${BASE}/subtitles?${params.toString()}`, {
        headers: { "User-Agent": ctx.userAgent, Accept: "application/json" },
      });
    } catch (e) {
      dwarn("[sub-src] subdl fetch", e);
      return null;
    }
    if (res.status === 429) {
      markRateLimited("subdl", 30);
      return null;
    }
    if (!res.ok) {
      dwarn(`[sub-src] subdl ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as { subtitles?: SubdlRow[] } | null;
    const rows = Array.isArray(data?.subtitles)
      ? (data as { subtitles: SubdlRow[] }).subtitles
      : [];
    const want = new Set(langs);
    const idConfirmed = Boolean(tt || q.tmdbId);
    const series = isSeries(q);
    dinfo(`[sub-src] subdl ${rows.length} rows`);
    return rows.map((r) => {
      const lang = normalizeLang(r.language ?? r.lang ?? "");
      const url = resolveSubtitleDownloadUrl(r.url, `${DL}/`);
      const epOk = series && r.season === q.season && r.episode === q.episode;
      return {
        provider: "subdl",
        id: r.url ?? r.name ?? r.release_name ?? `${lang}:${r.season ?? 0}:${r.episode ?? 0}`,
        url,
        pageUrl: r.subtitlePage ? `https://subdl.com${r.subtitlePage}` : null,
        lang,
        release: r.release_name ?? r.name ?? null,
        format: detectFormat(url, r.format),
        hearingImpaired: r.hi === true,
        foreignOnly: false,
        machineTranslated: false,
        fps: null,
        downloads: 0,
        fromTrusted: false,
        hashMatched: false,
        langConfirmed: want.size === 0 || want.has(lang),
        episodeConfirmed: series ? epOk : false,
        idConfirmed,
        matchScore: 0,
      };
    });
  },
};
