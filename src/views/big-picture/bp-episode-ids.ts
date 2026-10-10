import { useEffect, useMemo, useState } from "react";
import { lruSet } from "@/lib/cache";
import type { Meta } from "@/lib/cinemeta";
import { registerCache } from "@/lib/memory-profiler";
import { animeSeriesFromStreamId, fetchEpisodeList, isAnimeId } from "@/lib/series-episodes";
import { useSettings } from "@/lib/settings";
import type { PlayEpisode } from "@/lib/view";

export type BpEpisodeIds = {
  episodes: PlayEpisode[];
  byKey: Map<string, PlayEpisode>;
};

type BpMetaVideo = NonNullable<Meta["videos"]>[number];

const BP_NO_EPISODE_IDS: BpEpisodeIds = { episodes: [], byKey: new Map() };

const INDEX_MAX = 40;
const indexCache = new Map<string, BpEpisodeIds>();
registerCache("bp:episodeIds", () => indexCache.size);

// A tt or tmdb shell can still be served by the Kitsu addon, and the video id is
// the only place that mapping survives. Same probe the desktop runs in
// fetchAdjacentEpisodes before it reaches for the anime episode list.
function bpEpisodeIdSource(meta: Meta | null | undefined): string | null {
  if (!meta) return null;
  if (isAnimeId(meta.id)) return meta.id;
  for (const v of meta.videos ?? []) {
    const series = animeSeriesFromStreamId(v.id);
    if (series) return series;
  }
  return null;
}

function put(byKey: Map<string, PlayEpisode>, key: string | null, ep: PlayEpisode): void {
  if (!key || byKey.has(key)) return;
  byKey.set(key, ep);
}

function indexEpisodes(episodes: PlayEpisode[]): BpEpisodeIds {
  const byKey = new Map<string, PlayEpisode>();
  for (const ep of episodes) {
    put(byKey, ep.kitsuStreamId ? `vid:${ep.kitsuStreamId}` : null, ep);
    put(byKey, ep.videoId ? `vid:${ep.videoId}` : null, ep);
    put(byKey, `se:${ep.season}:${ep.episode}`, ep);
    if (ep.absoluteNumber != null) put(byKey, `abs:${ep.absoluteNumber}`, ep);
  }
  return { episodes, byKey };
}

type BpEpisodeRef = Pick<PlayEpisode, "season" | "episode"> &
  Partial<Pick<PlayEpisode, "videoId" | "kitsuStreamId" | "absoluteNumber">>;

// season and episode here are the SOURCE pair, the one the meta itself reports.
// Never hand this an imdb pair: a kitsu list numbered 1..12 that maps onto
// imdbEpisode 5..16 would answer `se:1:5` with kitsu episode 5, whose real imdb
// episode is 9, and the addons would be asked for the wrong episode.
function bpLookupEpisode(ids: BpEpisodeIds, want: BpEpisodeRef): PlayEpisode | null {
  if (ids.byKey.size === 0) return null;
  const keys: Array<string | null> = [
    want.kitsuStreamId ? `vid:${want.kitsuStreamId}` : null,
    want.videoId ? `vid:${want.videoId}` : null,
    `se:${want.season}:${want.episode}`,
    want.absoluteNumber != null ? `abs:${want.absoluteNumber}` : null,
  ];
  for (const k of keys) {
    if (!k) continue;
    const hit = ids.byKey.get(k);
    if (hit) return hit;
  }
  return null;
}

// buildStreamIds reads a present kitsuStreamId as proof the title is anime and
// from then on suppresses every plain tt:S:E candidate, so the imdb pair has to
// travel with it or a Cinemeta backed anime loses the ids it used to resolve on.
function bpEpisodeIdPatch(ids: BpEpisodeIds, want: BpEpisodeRef): Partial<PlayEpisode> {
  const hit = bpLookupEpisode(ids, want);
  if (!hit) return {};
  // Absent keys, not undefined values. A spread of undefined would erase a field
  // the caller already resolved.
  const patch: Partial<PlayEpisode> = {};
  if (hit.kitsuStreamId != null) patch.kitsuStreamId = hit.kitsuStreamId;
  if (hit.imdbId != null) patch.imdbId = hit.imdbId;
  if (hit.imdbSeason != null) patch.imdbSeason = hit.imdbSeason;
  if (hit.imdbEpisode != null) patch.imdbEpisode = hit.imdbEpisode;
  if (hit.absoluteNumber != null) patch.absoluteNumber = hit.absoluteNumber;
  if (hit.tvdbEpisodeId != null) patch.tvdbEpisodeId = hit.tvdbEpisodeId;
  return patch;
}

function applyBpEpisodeIds(ids: BpEpisodeIds, ep: PlayEpisode): PlayEpisode {
  return { ...ep, ...bpEpisodeIdPatch(ids, ep) };
}

export function bpPlayEpisode(v: BpMetaVideo, ids: BpEpisodeIds): PlayEpisode {
  return applyBpEpisodeIds(ids, {
    season: v.season ?? 1,
    episode: v.episode ?? v.number ?? 1,
    name: v.name ?? v.title,
    videoId: v.id,
    still: v.thumbnail,
    overview: v.overview ?? v.description,
    airDate: v.released ?? v.firstAired,
  });
}

// A series with no resolvable episode still plays, so the synthetic premiere is
// mapped too. It is the one path that would otherwise ask addons for streams
// under an id no anime addon answers.
export function bpEpisodeAt(season: number, episode: number, ids: BpEpisodeIds): PlayEpisode {
  return applyBpEpisodeIds(ids, { season, episode });
}

export function useBpEpisodeIds(meta: Meta | null | undefined): BpEpisodeIds {
  const { settings } = useSettings();
  const source = useMemo(() => bpEpisodeIdSource(meta), [meta?.id, meta?.videos?.length]);
  const [ids, setIds] = useState<BpEpisodeIds>(
    () => (source ? indexCache.get(source) : null) ?? BP_NO_EPISODE_IDS,
  );

  useEffect(() => {
    if (!source) {
      setIds(BP_NO_EPISODE_IDS);
      return;
    }
    const cached = indexCache.get(source);
    if (cached) {
      setIds(cached);
      return;
    }
    setIds(BP_NO_EPISODE_IDS);
    let cancelled = false;
    void (async () => {
      const shell: Meta = { id: source, type: "series", name: "" };
      const eps = await fetchEpisodeList(shell, { tmdbKey: settings.tmdbKey }).catch(
        () => [] as PlayEpisode[],
      );
      if (cancelled || eps.length === 0) return;
      const built = indexEpisodes(eps);
      lruSet(indexCache, source, built, INDEX_MAX);
      setIds(built);
    })();
    return () => {
      cancelled = true;
    };
  }, [source, settings.tmdbKey]);

  return ids;
}
