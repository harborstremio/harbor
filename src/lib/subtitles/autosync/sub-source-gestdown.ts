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

const BASE = "https://api.gestdown.info";

type GestSub = {
  subtitleId?: string;
  version?: string;
  language?: string;
  downloadUri?: string;
  completed?: boolean;
  hearingImpaired?: boolean;
};

async function resolveShowId(q: SubSearchQuery, ctx: ProviderCtx): Promise<string | null> {
  const tvdb = (q as { tvdbId?: number | string }).tvdbId;
  const path = tvdb
    ? `/shows/external/tvdb/${encodeURIComponent(String(tvdb))}`
    : q.title
      ? `/shows/search/${encodeURIComponent(q.title)}`
      : null;
  if (!path) return null;
  let res: Response;
  try {
    res = await safeFetch(`${BASE}${path}`, {
      headers: { "User-Agent": ctx.userAgent, Accept: "application/json" },
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as
    | { shows?: Array<{ id?: string }>; id?: string }
    | null;
  return data?.id ?? data?.shows?.[0]?.id ?? null;
}

export const gestdownSource: SubSource = {
  id: "gestdown",
  supportsHash: false,
  supportsMovie: false,
  supportsTv: true,
  async search(q: SubSearchQuery, ctx: ProviderCtx): Promise<SourceSubCandidate[] | null> {
    if (!isSeries(q) || q.season == null || q.episode == null) return [];
    const showId = await resolveShowId(q, ctx);
    if (!showId) return [];
    const idConfirmed = (q as { tvdbId?: unknown }).tvdbId != null;
    const codes = wantedLangs(q);
    const out: SourceSubCandidate[] = [];
    for (const code of codes.length ? codes : ["en"]) {
      const url = `${BASE}/subtitles/get/${showId}/${q.season}/${q.episode}/${encodeURIComponent(code)}`;
      let res: Response;
      try {
        res = await safeFetch(url, { headers: { "User-Agent": ctx.userAgent, Accept: "application/json" } });
      } catch {
        continue;
      }
      if (res.status === 423) return null;
      if (res.status === 429) {
        markRateLimited("gestdown", 30);
        return null;
      }
      if (!res.ok) continue;
      const data = (await res.json().catch(() => null)) as { matchingSubtitles?: GestSub[] } | null;
      const rows = Array.isArray(data?.matchingSubtitles)
        ? (data as { matchingSubtitles: GestSub[] }).matchingSubtitles
        : [];
      for (const r of rows) {
        if (r.completed !== true || !r.downloadUri) continue;
        out.push({
          provider: "gestdown",
          id: r.subtitleId ?? r.downloadUri,
          url: `${BASE}${r.downloadUri}`,
          pageUrl: null,
          lang: normalizeLang(r.language ?? code),
          release: r.version ?? null,
          format: "srt",
          hearingImpaired: r.hearingImpaired === true,
          foreignOnly: false,
          machineTranslated: false,
          fps: null,
          downloads: 0,
          fromTrusted: true,
          hashMatched: false,
          langConfirmed: true,
          episodeConfirmed: true,
          idConfirmed,
          matchScore: 0,
        });
      }
    }
    return out;
  },
};
