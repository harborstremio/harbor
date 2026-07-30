import { apiUrl, xtreamFetch, type XtreamCreds } from "./xtream";
import type { IptvChannel } from "./types";
import { processInBatches, type BatchProgress } from "./xtream-batches";

type CategoryRow = { category_id: string; category_name?: string };
type VodRow = {
  stream_id: number;
  name?: string;
  stream_type?: string;
  stream_icon?: string;
  category_id?: string;
  container_extension?: string;
};
type SeriesRow = {
  series_id: number;
  name?: string;
  stream_type?: string;
  cover?: string;
  category_id?: string;
};
type EpisodeRow = {
  id: string | number;
  episode_num?: string | number;
  title?: string;
  container_extension?: string;
  season?: string | number;
  info?: { movie_image?: string; duration_secs?: string | number; plot?: string };
};
type SeriesInfo = { episodes?: Record<string, EpisodeRow[]> };
type XtreamSeries = Pick<SeriesRow, "series_id" | "name" | "cover" | "category_id">;

export type XtreamCatalogBatchOptions = {
  batchSize?: number;
  onStart?: (total: number) => void;
  onBatch?: (batch: readonly IptvChannel[], progress: BatchProgress) => boolean | void;
};

const seriesInfoCache = new Map<string, SeriesInfo>();
const CATALOG_BATCH_SIZE = 256;

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

export async function fetchXtreamVod(
  creds: XtreamCreds,
  baseId: string,
  options?: XtreamCatalogBatchOptions,
): Promise<IptvChannel[]> {
  const [catsRaw, streamsRaw] = await Promise.all([
    xtreamFetch(apiUrl(creds, "get_vod_categories")),
    xtreamFetch(apiUrl(creds, "get_vod_streams")),
  ]);
  const cats = catMap(catsRaw);
  const rows: VodRow[] = Array.isArray(streamsRaw) ? (streamsRaw as VodRow[]) : [];
  options?.onStart?.(rows.length);
  return processInBatches(rows, {
    batchSize: options?.batchSize ?? CATALOG_BATCH_SIZE,
    map: (row) => {
      if (!row || row.stream_id == null) return null;
      const type = row.stream_type?.trim().toLowerCase();
      if (type && type !== "movie" && type !== "vod") return null;
      return {
        id: `${baseId}::xtvod::${row.stream_id}`,
        tvgId: null,
        name: row.name?.trim() || `Movie ${row.stream_id}`,
        logo: row.stream_icon?.trim() || null,
        group: row.category_id ? (cats.get(String(row.category_id)) ?? null) : null,
        url: buildVodUrl(creds, row.stream_id, row.container_extension),
        catchupSource: null,
        durationSec: null,
        attrs: { "tvg-type": "movie" },
      } satisfies IptvChannel;
    },
    onBatch: options?.onBatch,
  });
}

export async function fetchXtreamSeries(
  creds: XtreamCreds,
  baseId: string,
  options?: XtreamCatalogBatchOptions,
): Promise<IptvChannel[]> {
  const [catsRaw, seriesRaw] = await Promise.all([
    xtreamFetch(apiUrl(creds, "get_series_categories")),
    xtreamFetch(apiUrl(creds, "get_series")),
  ]);
  const cats = catMap(catsRaw);
  const series: SeriesRow[] = Array.isArray(seriesRaw) ? (seriesRaw as SeriesRow[]) : [];
  options?.onStart?.(series.length);
  return processInBatches(series, {
    batchSize: options?.batchSize ?? CATALOG_BATCH_SIZE,
    map: (item) => {
      if (!item || item.series_id == null) return null;
      const type = item.stream_type?.trim().toLowerCase();
      if (type && type !== "series") return null;
      return {
        id: `${baseId}::xtseries::${item.series_id}`,
        tvgId: null,
        name: item.name?.trim() || `Series ${item.series_id}`,
        logo: item.cover?.trim() || null,
        group: item.category_id ? (cats.get(String(item.category_id)) ?? null) : null,
        url: "",
        catchupSource: null,
        durationSec: null,
        attrs: { "tvg-type": "series", "xtream-series-id": String(item.series_id) },
      } satisfies IptvChannel;
    },
    onBatch: options?.onBatch,
  });
}

export async function fetchXtreamSeriesEpisodes(
  creds: XtreamCreds,
  baseId: string,
  series: XtreamSeries,
): Promise<IptvChannel[]> {
  const seriesName = series.name?.trim() || `Series ${series.series_id}`;
  const cacheKey = `${baseId}::${series.series_id}`;
  let info = seriesInfoCache.get(cacheKey);
  if (!info) {
    info = (await xtreamFetch(
      apiUrl(creds, "get_series_info", { series_id: String(series.series_id) }),
    )) as SeriesInfo;
    seriesInfoCache.set(cacheKey, info);
  }
  const episodes = info?.episodes;
  if (!episodes || typeof episodes !== "object") return [];

  const out: IptvChannel[] = [];
  for (const seasonKey of Object.keys(episodes)) {
    const list = episodes[seasonKey];
    if (!Array.isArray(list)) continue;
    for (const ep of list) {
      if (!ep || ep.id == null) continue;
      const season = Number(ep.season) || Number(seasonKey) || 1;
      const epNum = Number(ep.episode_num) || 0;
      out.push({
        id: `${baseId}::xtep::${ep.id}`,
        tvgId: null,
        name: `${seriesName} S${season}E${epNum}`,
        logo: ep.info?.movie_image?.trim() || series.cover?.trim() || null,
        group: series.category_id ?? null,
        url: buildSeriesUrl(creds, ep.id, ep.container_extension),
        catchupSource: null,
        durationSec: Number(ep.info?.duration_secs) || null,
        attrs: {
          "tvg-type": "series",
          ...(ep.title?.trim() ? { "episode-title": ep.title.trim() } : {}),
          ...(ep.info?.plot?.trim() ? { "episode-plot": ep.info.plot.trim() } : {}),
        },
      });
    }
  }
  return out;
}
