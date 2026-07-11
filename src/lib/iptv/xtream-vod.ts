import type { IptvChannel } from "./types";
import { apiUrl, xtreamFetch, type XtreamCreds } from "./xtream";

type CategoryRow = { category_id: string; category_name?: string };
type VodRow = {
  stream_id: number;
  name?: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
};
type SeriesRow = { series_id: number; name?: string; cover?: string; category_id?: string };
type EpisodeRow = {
  id: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
  season?: string | number;
  info?: { movie_image?: string };
};
type SeriesInfo = { episodes?: Record<string, EpisodeRow[]> };

const seriesInfoCache = new Map<string, SeriesInfo>();

export function clearSeriesInfoCache(baseId?: string): void {
  if (!baseId) {
    seriesInfoCache.clear();
    return;
  }
  const prefix = `${baseId}::`;
  for (const key of [...seriesInfoCache.keys()]) {
    if (key.startsWith(prefix)) seriesInfoCache.delete(key);
  }
}

function catMap(raw: unknown): Map<string, string> {
  const m = new Map<string, string>();
  if (Array.isArray(raw)) {
    for (const c of raw as CategoryRow[]) {
      if (c && c.category_id) m.set(String(c.category_id), c.category_name ?? "");
    }
  }
  return m;
}

function buildVodUrl(creds: XtreamCreds, streamId: number | string, ext?: string): string {
  const base = `${creds.base}/movie/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${streamId}`;
  const e = ext && String(ext).trim();
  return e ? `${base}.${e}` : base;
}

function buildSeriesUrl(creds: XtreamCreds, episodeId: number | string, ext?: string): string {
  const base = `${creds.base}/series/${encodeURIComponent(creds.username)}/${encodeURIComponent(creds.password)}/${episodeId}`;
  const e = ext && String(ext).trim();
  return e ? `${base}.${e}` : base;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < items.length) {
      const idx = cursor;
      cursor += 1;
      out[idx] = await fn(items[idx]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export async function fetchXtreamVod(creds: XtreamCreds, baseId: string): Promise<IptvChannel[]> {
  const [catsRaw, streamsRaw] = await Promise.all([
    xtreamFetch(apiUrl(creds, "get_vod_categories")),
    xtreamFetch(apiUrl(creds, "get_vod_streams")),
  ]);
  const cats = catMap(catsRaw);
  const rows: VodRow[] = Array.isArray(streamsRaw) ? (streamsRaw as VodRow[]) : [];
  const out: IptvChannel[] = [];
  for (const r of rows) {
    if (!r || r.stream_id == null) continue;
    out.push({
      id: `${baseId}::xtvod::${r.stream_id}`,
      tvgId: null,
      name: r.name?.trim() || `Movie ${r.stream_id}`,
      logo: r.stream_icon?.trim() || null,
      group: r.category_id ? (cats.get(String(r.category_id)) ?? null) : null,
      url: buildVodUrl(creds, r.stream_id, r.container_extension),
      catchupSource: null,
      durationSec: null,
      attrs: { "tvg-type": "movie" },
    });
  }
  return out;
}

const MAX_SERIES_EXPANDED = 1200;

export async function fetchXtreamSeries(creds: XtreamCreds, baseId: string): Promise<IptvChannel[]> {
  const [catsRaw, seriesRaw] = await Promise.all([
    xtreamFetch(apiUrl(creds, "get_series_categories")),
    xtreamFetch(apiUrl(creds, "get_series")),
  ]);
  const cats = catMap(catsRaw);
  const all: SeriesRow[] = Array.isArray(seriesRaw) ? (seriesRaw as SeriesRow[]) : [];
  const series = all.slice(0, MAX_SERIES_EXPANDED);
  let throttled = false;
  const perSeries = await mapLimit(series, 6, async (s): Promise<IptvChannel[]> => {
    if (!s || s.series_id == null) return [];
    const seriesName = s.name?.trim() || `Series ${s.series_id}`;
    const group = s.category_id ? (cats.get(String(s.category_id)) ?? null) : null;
    const cover = s.cover?.trim() || null;
    const cacheKey = `${baseId}::${s.series_id}`;
    let info = seriesInfoCache.get(cacheKey);
    if (!info) {
      if (throttled) return [];
      try {
        info = (await xtreamFetch(apiUrl(creds, "get_series_info", { series_id: String(s.series_id) }))) as SeriesInfo;
      } catch (e) {
        if (/HTTP (?:429|403)/.test(String(e))) throttled = true;
        return [];
      }
      seriesInfoCache.set(cacheKey, info);
    }
    const episodes = info?.episodes;
    if (!episodes || typeof episodes !== "object") return [];
    const eps: IptvChannel[] = [];
    for (const seasonKey of Object.keys(episodes)) {
      const list = episodes[seasonKey];
      if (!Array.isArray(list)) continue;
      for (const ep of list) {
        if (!ep || ep.id == null) continue;
        const season = Number(ep.season) || Number(seasonKey) || 1;
        const epNum = Number(ep.episode_num) || 0;
        eps.push({
          id: `${baseId}::xtep::${ep.id}`,
          tvgId: null,
          name: `${seriesName} S${season}E${epNum}`,
          logo: ep.info?.movie_image?.trim() || cover,
          group,
          url: buildSeriesUrl(creds, ep.id, ep.container_extension),
          catchupSource: null,
          durationSec: null,
          attrs: { "tvg-type": "series" },
        });
      }
    }
    return eps;
  });
  return perSeries.flat();
}

export async function fetchXtreamVodAndSeries(creds: XtreamCreds, baseId: string): Promise<IptvChannel[]> {
  const [vod, series] = await Promise.all([
    fetchXtreamVod(creds, baseId).catch(() => [] as IptvChannel[]),
    fetchXtreamSeries(creds, baseId).catch(() => [] as IptvChannel[]),
  ]);
  return [...vod, ...series];
}
