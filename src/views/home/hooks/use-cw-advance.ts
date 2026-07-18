import { useEffect, useRef, useState } from "react";
import { fetchEpisodeList, nextUnwatchedAfter } from "@/lib/series-episodes";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { getEpisodeProgress } from "@/lib/episode-progress";
import { simklWatchedForId, statusForId, type WatchlistStatus } from "@/lib/simkl/list-status";
import {
  episodeFromVideoId,
  isAnimeCwItem,
  libraryMetaType,
  type LibraryItem,
} from "@/lib/stremio";
import { isNextAired, resurfaceCandidates, type AnimeMode } from "@/lib/cw-resurface";

const FINISHED_RATIO = 0.9;
const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

const EMPTY_TRAKT_WATCHED: Set<string> = new Set();
const EMPTY_SIMKL_WATCHED: Map<string, Set<string>> = new Map();
const EMPTY_ANILIST_WATCHED: Map<string, Set<string>> = new Map();
const EMPTY_SIMKL_STATUS: Map<string, WatchlistStatus> = new Map();

function isFinishedSeries(i: LibraryItem): boolean {
  if (i.type !== "series" || !i.state) return false;
  if ((i.state.flaggedWatched ?? 0) <= 0) return false;
  const dur = i.state.duration ?? 0;
  const off = i.state.timeOffset ?? 0;
  return dur <= 0 || off / dur >= FINISHED_RATIO;
}

function currentEpisode(i: LibraryItem): { season: number; episode: number } | null {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const vid = i.state?.video_id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3) {
    const ep = Number(vid.split(":")[2]);
    return Number.isFinite(ep) && ep > 0 ? { season: 1, episode: ep } : null;
  }
  return episodeFromVideoId(vid);
}

function nextEpAired(list: PlayEpisode[], nextEp: PlayEpisode, isAnime: boolean): boolean {
  if (isNextAired(isAnime, nextEp.airDate)) return true;
  if (!isAnime || nextEp.airDate) return false;
  const now = Date.now();
  let boundary = -1;
  for (let k = 0; k < list.length; k++) {
    const raw = list[k].airDate;
    const t = raw ? Date.parse(raw) : NaN;
    if (Number.isFinite(t) && t <= now) boundary = k;
  }
  if (boundary < 0) return false;
  const idx = list.findIndex((e) => e.season === nextEp.season && e.episode === nextEp.episode);
  return idx >= 0 && idx <= boundary;
}

function watchedPredicate(
  i: LibraryItem,
  cur: { season: number; episode: number },
  traktWatched: Set<string>,
  simklWatched: Map<string, Set<string>>,
  anilistWatched: Map<string, Set<string>>,
  simklStatus: Map<string, WatchlistStatus>,
) {
  const finished = isFinishedSeries(i);
  const traktImdb = i._id.startsWith("tt") ? i._id : null;
  const simklSet = simklWatchedForId(simklWatched, i._id);
  const aniSet = anilistWatched.get(i._id);
  const simklCompleted = statusForId(simklStatus, i._id) === "completed";
  return (season: number, episode: number): boolean => {
    const prog = getEpisodeProgress(
      i._id,
      season,
      episode,
      null,
      traktImdb,
      traktWatched,
      undefined,
      aniSet,
      simklSet,
    );
    if (prog.watched) return true;
    if (season === cur.season && episode === cur.episode) return finished;
    return simklCompleted;
  };
}

function sameMap(a: Map<string, LibraryItem>, b: Map<string, LibraryItem>): boolean {
  if (a.size !== b.size) return false;
  for (const [k, v] of a) if (b.get(k) !== v) return false;
  return true;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

function sameList(a: LibraryItem[], b: LibraryItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i]._id !== b[i]._id) return false;
    if (a[i].state?.season !== b[i].state?.season) return false;
    if (a[i].state?.episode !== b[i].state?.episode) return false;
  }
  return true;
}

export function useCwAdvance(
  items: LibraryItem[],
  tmdbKey: string,
  enabled: boolean,
  library?: LibraryItem[],
  animeMode: AnimeMode = "all",
  watchedVersion = 0,
  traktWatched: Set<string> = EMPTY_TRAKT_WATCHED,
  simklWatched: Map<string, Set<string>> = EMPTY_SIMKL_WATCHED,
  anilistWatched: Map<string, Set<string>> = EMPTY_ANILIST_WATCHED,
  simklStatus: Map<string, WatchlistStatus> = EMPTY_SIMKL_STATUS,
  animeVersion = 0,
): LibraryItem[] {
  const [advanced, setAdvanced] = useState<Map<string, LibraryItem>>(new Map());
  const [extra, setExtra] = useState<LibraryItem[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const listCacheRef = useRef<Map<string, PlayEpisode[]>>(new Map());

  useEffect(() => {
    if (!enabled) {
      setAdvanced((prev) => (prev.size === 0 ? prev : new Map()));
      setExtra((prev) => (prev.length === 0 ? prev : []));
      setRemoved((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    const targets = items.filter((i) => {
      const cur = currentEpisode(i);
      return (
        cur != null &&
        watchedPredicate(
          i,
          cur,
          traktWatched,
          simklWatched,
          anilistWatched,
          simklStatus,
        )(cur.season, cur.episode)
      );
    });
    void (async () => {
      const next = new Map<string, LibraryItem>();
      const remove = new Set<string>();
      for (const i of targets) {
        const cur = currentEpisode(i)!;
        let list = listCacheRef.current.get(i._id);
        let fetchOk = list !== undefined;
        if (list === undefined) {
          const meta: Meta = {
            id: i._id,
            type: libraryMetaType(i.type),
            name: i.name,
            poster: i.poster,
            background: i.background,
          };
          const res = await fetchEpisodeList(meta, { tmdbKey })
            .then((eps) => ({ ok: true, eps }))
            .catch(() => ({ ok: false, eps: [] as PlayEpisode[] }));
          if (cancelled) return;
          fetchOk = res.ok;
          if (res.ok) {
            list = res.eps;
            listCacheRef.current.set(i._id, list);
          }
        }
        if (!list) continue;
        const nextEp = nextUnwatchedAfter(
          list,
          cur,
          watchedPredicate(i, cur, traktWatched, simklWatched, anilistWatched, simklStatus),
        );
        if (nextEp && nextEpAired(list, nextEp, isAnimeCwItem(i) || ANIME_ID.test(i._id))) {
          next.set(i._id, {
            ...i,
            state: {
              ...i.state!,
              season: nextEp.season,
              episode: nextEp.episode,
              video_id: `${i._id}:${nextEp.season}:${nextEp.episode}`,
              timeOffset: 0,
              flaggedWatched: 0,
            },
            upNext: true,
          });
        } else if (fetchOk && list.length > 0) {
          const finaleEp = list[list.length - 1];
          const dur = i.state?.duration ?? 0;
          const off = i.state?.timeOffset ?? 0;
          const midEpisode = off > 0 && dur > 0 && off / dur < FINISHED_RATIO;
          const freshMidResume =
            animeMode === "only" &&
            midEpisode &&
            finaleEp != null &&
            cur.episode < finaleEp.episode;
          if (!freshMidResume) remove.add(i._id);
        }
      }
      const lib = library ?? items;
      const inCw = new Set(items.map((i) => i._id));
      const watchedFor = (item: LibraryItem, c: { season: number; episode: number }) =>
        watchedPredicate(item, c, traktWatched, simklWatched, anilistWatched, simklStatus);
      const resurfaced = await resurfaceCandidates(
        lib,
        inCw,
        { tmdbKey, animeMode },
        watchedFor,
      ).catch(() => new Map<string, { season: number; episode: number }>());
      if (cancelled) return;
      const extraItems: LibraryItem[] = [];
      for (const [id, ep] of resurfaced) {
        if (next.has(id)) continue;
        const src = lib.find((i) => i._id === id);
        if (!src?.state) continue;
        extraItems.push({
          ...src,
          state: {
            ...src.state,
            season: ep.season,
            episode: ep.episode,
            video_id: `${id}:${ep.season}:${ep.episode}`,
            timeOffset: 0,
            flaggedWatched: 0,
          },
          upNext: true,
        });
      }
      if (!cancelled) {
        setAdvanced((prev) => (sameMap(prev, next) ? prev : next));
        setExtra((prev) => (sameList(prev, extraItems) ? prev : extraItems));
        setRemoved((prev) => (sameSet(prev, remove) ? prev : remove));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    items,
    tmdbKey,
    enabled,
    library,
    animeMode,
    watchedVersion,
    traktWatched,
    simklWatched,
    anilistWatched,
    simklStatus,
    animeVersion,
  ]);

  if (!enabled) return items;
  const base =
    advanced.size === 0 && removed.size === 0
      ? items
      : items.map((i) => advanced.get(i._id) ?? i).filter((i) => !removed.has(i._id));
  if (extra.length === 0) return base;
  const keyOf = (i: LibraryItem) => `${i.type}|${(i.name ?? "").trim().toLowerCase()}`;
  const baseKeys = new Set(base.map(keyOf));
  const dedupExtra = extra.filter((i) => !baseKeys.has(keyOf(i)));
  return dedupExtra.length === 0 ? base : base.concat(dedupExtra);
}
