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

const BASE = "https://api.subsource.net/v1";

type SubsourceRow = {
  id?: string | number;
  link?: string;
  download?: string;
  downloadUrl?: string;
  lang?: string;
  language?: string;
  releaseName?: string;
  release_name?: string;
  name?: string;
  season?: number;
  episode?: number;
  hi?: boolean;
  hearingImpaired?: boolean;
  format?: string;
  downloads?: number;
};

export const subsourceSource: SubSource = {
  id: "subsource",
  supportsHash: false,
  supportsMovie: true,
  supportsTv: true,
  async search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
    if (!ctx.subsourceApiKey) return null;
    const langs = wantedLangs(q);
    const params = new URLSearchParams();
    const tt = imdbTt(q.imdbId);
    if (tt) params.set("imdb_id", tt);
    else if (q.tmdbId) params.set("tmdb_id", String(q.tmdbId));
    else if (q.title) params.set("query", q.title);
    else return [];
    params.set("type", isSeries(q) ? "tv" : "movie");
    if (langs.length) params.set("languages", langs.join(","));
    if (q.season != null) params.set("season", String(q.season));
    if (q.episode != null) params.set("episode", String(q.episode));

    let res: Response;
    try {
      res = await safeFetch(`${BASE}/subtitles?${params.toString()}`, {
        headers: {
          "User-Agent": ctx.userAgent,
          Accept: "application/json",
          Authorization: `Bearer ${ctx.subsourceApiKey}`,
        },
      });
    } catch (e) {
      dwarn("[sub-src] subsource fetch", e);
      return null;
    }
    if (res.status === 429) {
      markRateLimited("subsource", 30);
      return null;
    }
    if (!res.ok) {
      dwarn(`[sub-src] subsource ${res.status}`);
      return null;
    }
    const data = (await res.json().catch(() => null)) as {
      subtitles?: SubsourceRow[];
      results?: SubsourceRow[];
    } | null;
    const rows = Array.isArray(data?.subtitles)
      ? (data as { subtitles: SubsourceRow[] }).subtitles
      : Array.isArray(data?.results)
        ? (data as { results: SubsourceRow[] }).results
        : [];
    const want = new Set(langs);
    const idConfirmed = Boolean(tt || q.tmdbId);
    const series = isSeries(q);
    dinfo(`[sub-src] subsource ${rows.length} rows`);
    return rows.map((r) => {
      const lang = normalizeLang(r.language ?? r.lang ?? "");
      const url = resolveSubtitleDownloadUrl(r.downloadUrl ?? r.download ?? r.link, `${BASE}/`);
      const epOk = series && r.season === q.season && r.episode === q.episode;
      return {
        provider: "subsource",
        id: String(r.id ?? url ?? r.name ?? `${lang}:${r.season ?? 0}:${r.episode ?? 0}`),
        url,
        pageUrl: null,
        lang,
        release: r.releaseName ?? r.release_name ?? r.name ?? null,
        format: detectFormat(url, r.format),
        hearingImpaired: r.hi === true || r.hearingImpaired === true,
        foreignOnly: false,
        machineTranslated: false,
        fps: null,
        downloads: r.downloads ?? 0,
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
