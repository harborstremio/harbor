import { readActiveId } from "@/lib/iptv/active-source";
import { credsFromSource } from "@/lib/iptv/ingest/xtream-creds";
import { iptvSourceSignature } from "@/lib/iptv/persistent-cache";
import { readPlaylists } from "@/lib/iptv/playlists-store";
import { loadPlaylist } from "@/lib/iptv/store";
import type { IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import {
  buildVodLibrary,
  vodEpisodeFromChannel,
  type VodEpisode,
  type VodLibrary,
} from "@/lib/iptv/vod";
import {
  matchVodMovies,
  matchVodSeries,
  pickVodEpisode,
  vodQualityLabel,
  type VodLookupQuery,
} from "@/lib/iptv/vod-lookup";
import { fetchXtreamSeriesEpisodes } from "@/lib/iptv/xtream-vod";
import { getXtreamVodSnapshot, loadXtreamVodLibrary } from "@/lib/iptv/xtream-vod-library";
import { dlog } from "@/lib/debug";
import { PROVIDER_VOD_ADDON_ID, PROVIDER_VOD_LABEL } from "./source-order";
import type { Stream } from "./types";

const VOD_ACTIVE_KEY = "harbor.vod.active";
// A catalog that is not cached yet is still fetched in full and kept for next time; the picker
// only stops waiting for it.
const CATALOG_WAIT_MS = 20_000;
const MAX_PER_SOURCE = 4;

export type ProviderVodQuery = VodLookupQuery;

function readVodActiveId(): string | null {
  try {
    return localStorage.getItem(VOD_ACTIVE_KEY);
  } catch {
    return null;
  }
}

/** Every channel source, the one picked for movies first and the one picked for Live TV next. */
export function providerVodSources(): IptvPlaylistSource[] {
  const sources = readPlaylists()
    .filter((p) => (p.kind ?? "m3u") !== "epg")
    .map(
      (p): IptvPlaylistSource => ({
        id: p.id,
        name: p.name,
        url: p.url,
        epgUrl: p.epgUrl,
        kind: p.kind,
        xtream: p.xtream,
      }),
    );
  const rank = (id: string) => {
    if (id === readVodActiveId()) return 0;
    if (id === readActiveId()) return 1;
    return 2;
  };
  return sources
    .map((source, index) => ({ source, index }))
    .sort((a, b) => rank(a.source.id) - rank(b.source.id) || a.index - b.index)
    .map((x) => x.source);
}

/** Changes whenever a source is added, removed or edited, so cached picker results are redone. */
export function providerVodCacheTokens(): string[] {
  return providerVodSources().map((s) => `provider-vod:${s.id}:${iptvSourceSignature(s)}`);
}

/** An M3U URL that carries Xtream credentials gets the provider's catalog API, not the file. */
function asXtream(source: IptvPlaylistSource): IptvPlaylistSource | null {
  if (source.kind === "xtream" && source.xtream) return source;
  const creds = credsFromSource(source);
  if (!creds) return null;
  return {
    ...source,
    kind: "xtream",
    xtream: { server: creds.base, username: creds.username, password: creds.password },
  };
}

function waitAtMost<T>(promise: Promise<T>, ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
    promise.then(done, done);
  });
}

const m3uLibraries = new WeakMap<IptvPlaylist, VodLibrary>();

async function catalogFor(
  source: IptvPlaylistSource,
  signal: AbortSignal,
): Promise<{ library: VodLibrary; xtream: IptvPlaylistSource | null }> {
  const xtream = asXtream(source);
  if (xtream) {
    await waitAtMost(loadXtreamVodLibrary(xtream), CATALOG_WAIT_MS, signal);
    return { library: getXtreamVodSnapshot(xtream.id).library, xtream };
  }
  let playlist: IptvPlaylist | null = null;
  await waitAtMost(
    loadPlaylist(source).then((p) => {
      playlist = p;
    }),
    CATALOG_WAIT_MS,
    signal,
  );
  if (!playlist) return { library: { movies: [], series: [] }, xtream: null };
  const loaded: IptvPlaylist = playlist;
  let library = m3uLibraries.get(loaded);
  if (!library) {
    library = buildVodLibrary([loaded], new Map([[source.id, source.name]]));
    m3uLibraries.set(loaded, library);
  }
  return { library, xtream: null };
}

function playable(
  source: IptvPlaylistSource,
  query: ProviderVodQuery,
  entry: {
    url: string;
    headers?: Record<string, string>;
    quality: string | null;
    category: string | null;
  },
): Stream {
  const quality = entry.quality ?? "Direct";
  const se =
    query.season != null && query.episode != null
      ? ` S${String(query.season).padStart(2, "0")}E${String(query.episode).padStart(2, "0")}`
      : "";
  const ext = entry.url.split(/[?#]/)[0].match(/\.([a-z0-9]{2,4})$/i)?.[1] ?? "mkv";
  const resolution = entry.quality === "4K" ? " 2160p" : entry.quality === "1080p" ? " 1080p" : "";
  return {
    name: PROVIDER_VOD_LABEL,
    title: `${PROVIDER_VOD_LABEL} · ${source.name} · ${quality}`,
    // The provider's category often names the language ("English Movies"), which the picker's
    // language preference reads from here.
    ...(entry.category ? { description: entry.category } : {}),
    url: entry.url,
    behaviorHints: {
      bingeGroup: `${PROVIDER_VOD_ADDON_ID}:${source.id}`,
      notWebReady: true,
      filename: `${query.title}${query.year ? ` ${query.year}` : ""}${se}${resolution}.${ext}`,
      ...(entry.headers ? { proxyHeaders: { request: entry.headers } } : {}),
    },
    addonId: PROVIDER_VOD_ADDON_ID,
    addonName: PROVIDER_VOD_LABEL,
  };
}

async function episodesFor(
  xtream: IptvPlaylistSource | null,
  series: VodLibrary["series"][number],
  signal: AbortSignal,
): Promise<VodEpisode[]> {
  if (!series.xtreamSeriesId) return series.episodes;
  if (!xtream?.xtream) return [];
  const creds = credsFromSource(xtream);
  if (!creds) return [];
  const channels = await fetchXtreamSeriesEpisodes(
    creds,
    xtream.id,
    {
      series_id: Number(series.xtreamSeriesId),
      name: series.title,
      cover: series.logo ?? undefined,
    },
    signal,
  );
  return channels.map(vodEpisodeFromChannel);
}

async function streamsFromSource(
  source: IptvPlaylistSource,
  query: ProviderVodQuery,
  signal: AbortSignal,
): Promise<Stream[]> {
  const { library, xtream } = await catalogFor(source, signal);
  if (signal.aborted) return [];
  if (query.type === "movie") {
    return matchVodMovies(library.movies, query)
      .slice(0, MAX_PER_SOURCE)
      .map((m) =>
        playable(source, query, {
          url: m.url,
          headers: m.headers,
          quality: m.quality ?? null,
          category: m.group,
        }),
      );
  }
  const out: Stream[] = [];
  for (const series of matchVodSeries(library.series, query).slice(0, MAX_PER_SOURCE)) {
    const episodes = await episodesFor(xtream, series, signal).catch(() => []);
    if (signal.aborted) return [];
    const ep = pickVodEpisode(episodes, query.season, query.episode);
    if (!ep || !ep.url) continue;
    out.push(
      playable(source, query, {
        url: ep.url,
        headers: ep.headers,
        quality: vodQualityLabel(ep.title, series.group),
        category: series.group,
      }),
    );
  }
  return out;
}

/**
 * Direct-play copies of a movie or episode from the viewer's own IPTV providers, in source order.
 * A provider that fails or answers late is skipped rather than holding the other sources back.
 */
export async function fetchProviderVodStreams(
  query: ProviderVodQuery,
  signal: AbortSignal,
): Promise<Stream[]> {
  const sources = providerVodSources();
  if (sources.length === 0 || !query.title.trim()) return [];
  const settled = await Promise.allSettled(sources.map((s) => streamsFromSource(s, query, signal)));
  const out: Stream[] = [];
  const seen = new Set<string>();
  settled.forEach((r, i) => {
    if (r.status !== "fulfilled") {
      dlog(`[provider-vod] ${sources[i].name}: ${String(r.reason)}`);
      return;
    }
    for (const s of r.value) {
      if (!s.url || seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  });
  dlog(
    `[provider-vod] ${out.length} match(es) for ${query.title} across ${sources.length} source(s)`,
  );
  return out;
}
