import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { fetchEpisodeList, nextUnwatchedAfter } from "@/lib/series-episodes";
import type { Meta } from "@/lib/cinemeta";
import type { PlayEpisode } from "@/lib/view";
import { getEpisodeProgress } from "@/lib/episode-progress";
import {
  loadSimklProgress,
  simklWatchedForId,
  statusForId,
  type SimklProgress,
  type WatchlistStatus,
} from "@/lib/simkl/list-status";
import { getSession as getSimklSession, subscribeSession } from "@/lib/simkl/session";
import { manualWatchedState } from "@/lib/manual-watched";
import {
  episodeFromVideoId,
  isAnimeCwItem,
  isCwMember,
  libraryMetaType,
  type LibraryItem,
} from "@/lib/stremio";
import { isEpisodeHidden } from "@/lib/hidden-episodes";
import { isNextAired, resurfaceCandidates, type AnimeMode } from "@/lib/cw-resurface";
import { lastPlayedEpisode, readResumeEntry } from "@/lib/resume";
import { getViewedSeason } from "@/lib/season-view-pref";
import { getAnimeCwId } from "@/lib/anime-cw-ids";
import {
  preferredMixedSeason,
  providerAliasCoords,
  resolveEffectiveEpisode,
} from "@/lib/cw-anime-episode";
import { isSplitFranchiseKitsu } from "@/lib/providers/anime-franchise-root";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { franchiseDedupKey } from "@/lib/providers/jikan";
import { useSettings } from "@/lib/settings";
import { isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { anyProfileSharesStremioWith, useProfiles } from "@/lib/profiles";
import { listLocalCw } from "@/lib/local-cw";
import { localToLibraryItem } from "@/lib/continue-watching";

const FINISHED_RATIO = 0.9;
const ANIME_ID = /^(kitsu|mal|anilist|anidb):/;

const EMPTY_TRAKT_WATCHED: Set<string> = new Set();
const EMPTY_SIMKL_WATCHED: Map<string, Set<string>> = new Map();
const EMPTY_ANILIST_WATCHED: Map<string, Set<string>> = new Map();
const EMPTY_SIMKL_STATUS: Map<string, WatchlistStatus> = new Map();

function isFinishedSeries(i: LibraryItem): boolean {
  if (i.type !== "series" || !i.state) return false;
  const dur = i.state.duration ?? 0;
  const off = i.state.timeOffset ?? 0;
  if ((i.state.flaggedWatched ?? 0) > 0) return dur <= 0 || off / dur >= FINISHED_RATIO;
  return dur > 0 && off / dur >= FINISHED_RATIO;
}

function currentEpisode(i: LibraryItem): { season: number; episode: number } | null {
  const season = i.state?.season;
  const episode = i.state?.episode;
  if (season && episode) return { season, episode };
  const videoId = i.state?.video_id ?? "";
  if (ANIME_ID.test(i._id) && videoId.split(":").length === 3) {
    const number = Number(videoId.split(":")[2]);
    return Number.isInteger(number) && number > 0 ? { season: 1, episode: number } : null;
  }
  return episodeFromVideoId(i.state?.video_id ?? "");
}

function scopedSplitItem(id: string): boolean {
  return isSplitFranchiseKitsu(parseKitsuId(id) ?? parseKitsuId(getAnimeCwId(id) ?? ""));
}

export function shouldDropFinished(
  list: PlayEpisode[],
  fetchOk: boolean,
  state: { duration?: number; timeOffset?: number } | undefined,
  animeMode: AnimeMode,
  effCur: { season: number; episode: number },
  nextEp: PlayEpisode | null | undefined,
  hideCaughtUp = false,
): boolean {
  if (!fetchOk || list.length === 0) return false;
  const finaleEp = list[list.length - 1];
  const dur = state?.duration ?? 0;
  const off = state?.timeOffset ?? 0;
  const midEpisode = off > 0 && (dur <= 0 || off / dur < FINISHED_RATIO);
  const freshMidResume =
    animeMode === "only" && midEpisode && finaleEp != null && effCur.episode < finaleEp.episode;
  if (freshMidResume || midEpisode) return false;
  return hideCaughtUp || !nextEp;
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
  privateOnly = false,
) {
  const finished = isFinishedSeries(i);
  if (privateOnly) {
    return (season: number, episode: number) =>
      season === cur.season && episode === cur.episode && finished;
  }
  const traktImdb = i._id.startsWith("tt") ? i._id : null;
  const simklSet = simklWatchedForId(simklWatched, i._id);
  const aniSet = anilistWatched.get(i._id);
  const simklCompleted = statusForId(simklStatus, i._id) === "completed";
  return (season: number, episode: number): boolean => {
    if (manualWatchedState(i._id, season, episode) === false) return false;
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
    if (simklCompleted && (season < cur.season || (season === cur.season && episode < cur.episode)))
      return true;
    return false;
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
  episodeHiding = false,
  animeCwEnd: "hide" | "timer" = "hide",
): LibraryItem[] {
  useCwDismissVersion();
  const { settings } = useSettings();
  const hideCaughtUp = settings.cwHideCaughtUp;
  const { activeProfile, profiles } = useProfiles();
  const privacyOwner =
    settings.cwPerProfile && anyProfileSharesStremioWith(activeProfile, profiles)
      ? (activeProfile?.id ?? null)
      : null;
  const simklSession = useSyncExternalStore(subscribeSession, getSimklSession, getSimklSession);
  const simklEnabled = settings.cwSources.simkl;
  const profileId = activeProfile?.id ?? null;
  const [resolvedOwner, setResolvedOwner] = useState({
    privacyOwner,
    profileId,
    simklSession,
    simklEnabled,
  });
  const [advanced, setAdvanced] = useState<Map<string, LibraryItem>>(new Map());
  const [extra, setExtra] = useState<LibraryItem[]>([]);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const listCacheRef = useRef<Map<string, PlayEpisode[]>>(new Map());
  const [airTick, setAirTick] = useState(0);
  const airTimerRef = useRef<number | null>(null);
  const [remoteProgress, setRemoteProgress] = useState<{
    profileId: string | null;
    session: typeof simklSession;
    data: SimklProgress;
  } | null>(null);
  const simkl =
    !privacyOwner &&
    simklEnabled &&
    simklSession &&
    remoteProgress?.profileId === profileId &&
    remoteProgress.session === simklSession
      ? remoteProgress.data
      : null;

  // A slow provider must not hold up local completion. Refresh in the background;
  // the shared activity gate/cache coalesces readers across retained pages.
  useEffect(() => {
    if (!enabled || privacyOwner || !simklEnabled || !simklSession) return;
    let cancelled = false;
    let refreshing = false;
    const refresh = () => {
      if (refreshing || document.visibilityState === "hidden") return;
      refreshing = true;
      void loadSimklProgress()
        .then((data) => {
          if (!cancelled)
            setRemoteProgress((prev) =>
              prev?.profileId === profileId && prev.session === simklSession && prev.data === data
                ? prev
                : { profileId, session: simklSession, data },
            );
        })
        .catch(() => {})
        .finally(() => {
          refreshing = false;
        });
    };
    refresh();
    // Completed sessions disappear from /playback, so an unchanged empty playback
    // list must still discover progress made in another app.
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [
    enabled,
    privacyOwner,
    profileId,
    simklEnabled,
    simklSession,
    items,
    library,
    watchedVersion,
    simklWatched,
    simklStatus,
    airTick,
  ]);

  useEffect(() => {
    if (!enabled) {
      setAdvanced((prev) => (prev.size === 0 ? prev : new Map()));
      setExtra((prev) => (prev.length === 0 ? prev : []));
      setRemoved((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    void (async () => {
      // Parent maps may still belong to the outgoing account during a profile
      // switch. Only the snapshot tied to this session can drive advancement.
      const effectiveSimklWatched = simkl?.watched ?? EMPTY_SIMKL_WATCHED;
      const effectiveSimklStatus = simkl?.statuses ?? EMPTY_SIMKL_STATUS;
      const completedRemotely = (i: LibraryItem): boolean => {
        const cur = currentEpisode(i);
        if (!cur || i.type !== "series" || !simkl) return false;
        const at = simkl.watchedAt.get(i._id)?.get(`${cur.season}:${cur.episode}`);
        if (!at) return false;
        const resume = readResumeEntry(i._id, cur.season, cur.episode);
        const lastPlayed = lastPlayedEpisode(i._id);
        // Imported resume timestamps record fetch time, not playback time. Only
        // locally played progress can overrule the provider's pause/completion dates.
        const mtime: unknown = i._mtime;
        const stamps = [
          Date.parse(i.state?.lastWatched ?? ""),
          typeof mtime === "number" ? mtime : Date.parse(String(mtime)),
        ];
        if (resume && !resume.source) stamps.push(resume.t);
        if (lastPlayed && !lastPlayed.source) stamps.push(lastPlayed.t);
        const activity = Math.max(0, ...stamps.filter(Number.isFinite));
        return (
          at >= activity &&
          watchedPredicate(
            i,
            cur,
            traktWatched,
            effectiveSimklWatched,
            anilistWatched,
            effectiveSimklStatus,
          )(cur.season, cur.episode)
        );
      };
      const candidates = items.filter(
        (i) => currentEpisode(i) != null && (isFinishedSeries(i) || completedRemotely(i)),
      );
      const next = new Map<string, LibraryItem>();
      const remove = new Set<string>();
      for (const i of candidates) {
        const cur = currentEpisode(i)!;
        const isAnime = isAnimeCwItem(i) || ANIME_ID.test(i._id);
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
        // Bulletproof phantom guard: an entry can never show an episode past the last one
        // its own fully-fetched list actually contains. Ordering key = season*1e5+episode so
        // it holds for both season-relative and absolute numbering. Only fires on a clean
        // fetch with a non-empty list, so a transient/partial fetch never clears a good item.
        const orderKey = (s: number, e: number) => s * 100000 + e;
        const origCur = cur;
        let effCur = cur;
        let remappedMixed = false;
        const scoped = scopedSplitItem(i._id);
        if (fetchOk && list.length > 0) {
          const maxKey = list.reduce((m, e) => Math.max(m, orderKey(e.season, e.episode)), 0);
          if (
            orderKey(effCur.season, effCur.episode) > maxKey &&
            list.some((e) => e.season === effCur.season)
          ) {
            const abs = list.find((e) => e.absoluteNumber === effCur.episode);
            if (!abs) {
              remove.add(i._id);
              continue;
            }
            effCur = { season: abs.season, episode: abs.episode };
          }
          if (!list.some((e) => e.season === effCur.season && e.episode === effCur.episode)) {
            if (scoped) {
              const hintSeason = preferredMixedSeason(
                privacyOwner ? undefined : getViewedSeason(i._id),
                lastPlayedEpisode(i._id)?.season,
              );
              const resolved = resolveEffectiveEpisode(
                list,
                effCur.season,
                effCur.episode,
                hintSeason,
              );
              effCur = { season: resolved.season, episode: resolved.episode };
              remappedMixed = resolved.remappedMixed;
            } else {
              const mapped = list.find(
                (e) => e.imdbSeason === effCur.season && e.imdbEpisode === effCur.episode,
              );
              if (mapped) effCur = { season: mapped.season, episode: mapped.episode };
            }
          }
        }
        const checkWatched = watchedPredicate(
          i,
          effCur,
          traktWatched,
          effectiveSimklWatched,
          anilistWatched,
          effectiveSimklStatus,
          !!privacyOwner,
        );
        const aliasCur = scoped ? providerAliasCoords(list, effCur.season, effCur.episode) : [];
        const watchedCur =
          checkWatched(effCur.season, effCur.episode) ||
          aliasCur.some((a) => checkWatched(a.season, a.episode));
        if (!watchedCur) continue;
        const nextEp = nextUnwatchedAfter(
          list,
          effCur,
          (s: number, e: number): boolean => {
            if (s === effCur.season && e === effCur.episode) return true;
            if (privacyOwner) return false;
            if (checkWatched(s, e)) return true;
            if (!scoped) return false;
            return providerAliasCoords(list, s, e).some((a) => checkWatched(a.season, a.episode));
          },
          episodeHiding ? (s, e) => isEpisodeHidden(i._id, s, e) : undefined,
        );
        if (nextEp && nextEpAired(list, nextEp, isAnime)) {
          const displaySeason = remappedMixed
            ? nextEp.season
            : origCur.season !== effCur.season
              ? origCur.season
              : nextEp.season;
          next.set(i._id, {
            ...i,
            state: {
              ...i.state!,
              season: displaySeason,
              episode: nextEp.episode,
              video_id: `${i._id}:${displaySeason}:${nextEp.episode}`,
              timeOffset: 0,
              flaggedWatched: 0,
            },
            upNext: true,
          });
        } else if (animeCwEnd === "timer" && nextEp && nextEp.airDate) {
          next.set(i._id, {
            ...i,
            waitingForAir: true as const,
            nextAirDate: nextEp.airDate,
          } as LibraryItem);
        } else if (
          shouldDropFinished(
            list,
            fetchOk,
            completedRemotely(i) ? undefined : i.state,
            animeMode,
            effCur,
            nextEp,
            hideCaughtUp,
          )
        ) {
          remove.add(i._id);
        }
      }
      const baseLibrary = privacyOwner
        ? listLocalCw(true).map(localToLibraryItem)
        : (library ?? items);
      // Playback endpoints remove finished sessions. Keep recent completion anchors
      // available to the existing aired-episode resurfacing path, without saving fake progress.
      const libById = new Map(baseLibrary.map((i) => [i._id, i]));
      const remoteSeries = (simkl?.completedSeries ?? [])
        .filter((i) => {
          const status = simkl?.statuses.get(i._id);
          return (status === "watching" || status === "completed") && completedRemotely(i);
        })
        .sort((a, b) => Date.parse(b._mtime) - Date.parse(a._mtime))
        .slice(0, 40);
      for (const remote of remoteSeries) {
        const times = simkl!.watchedAt.get(remote._id);
        const existing = baseLibrary.find(
          (i) => i._id === remote._id || (times && simkl!.watchedAt.get(i._id) === times),
        );
        if (existing) {
          // A removed title, a newer local watch, or an active pause owns its slot.
          // Only replace an older inactive anchor, preserving its identity and art.
          if (
            (existing.removed && !existing.temp) ||
            isCwMember(existing) ||
            Date.parse(existing.state?.lastWatched ?? existing._mtime) > Date.parse(remote._mtime)
          )
            continue;
          const cur = currentEpisode(remote)!;
          if (manualWatchedState(existing._id, cur.season, cur.episode) === false) continue;
          libById.set(existing._id, {
            ...existing,
            state: { ...remote.state!, video_id: `${existing._id}:${cur.season}:${cur.episode}` },
          });
        } else {
          libById.set(remote._id, remote);
        }
      }
      const lib = [...libById.values()];
      const inCw = new Set(items.map((i) => i._id));
      const watchedFor = (item: LibraryItem, c: { season: number; episode: number }) =>
        watchedPredicate(
          item,
          c,
          traktWatched,
          effectiveSimklWatched,
          anilistWatched,
          effectiveSimklStatus,
          !!privacyOwner,
        );
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
      if (!cancelled && animeCwEnd === "timer") {
        let soonest = Infinity;
        for (const it of next.values()) {
          const air = (it as Record<string, unknown>).nextAirDate;
          if (typeof air !== "string") continue;
          const at = Date.parse(air);
          if (Number.isFinite(at) && at > Date.now() && at < soonest) soonest = at;
        }
        if (airTimerRef.current !== null) window.clearTimeout(airTimerRef.current);
        airTimerRef.current = null;
        if (soonest !== Infinity) {
          const delay = Math.min(Math.max(soonest - Date.now() + 30000, 30000), 21600000);
          airTimerRef.current = window.setTimeout(() => setAirTick((n) => n + 1), delay);
        }
      }
      if (!cancelled) {
        setResolvedOwner({ privacyOwner, profileId, simklSession, simklEnabled });
        setAdvanced((prev) => (sameMap(prev, next) ? prev : next));
        setExtra((prev) => (sameList(prev, extraItems) ? prev : extraItems));
        setRemoved((prev) => (sameSet(prev, remove) ? prev : remove));
      }
    })();
    return () => {
      cancelled = true;
      if (airTimerRef.current !== null) {
        window.clearTimeout(airTimerRef.current);
        airTimerRef.current = null;
      }
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
    episodeHiding,
    hideCaughtUp,
    animeCwEnd,
    airTick,
    privacyOwner,
    profileId,
    simklSession,
    simklEnabled,
    simkl,
  ]);

  if (
    !enabled ||
    resolvedOwner.privacyOwner !== privacyOwner ||
    resolvedOwner.profileId !== profileId ||
    resolvedOwner.simklSession !== simklSession ||
    resolvedOwner.simklEnabled !== simklEnabled
  )
    return items.filter((i) => !isCwDismissed(i));
  // Dismissal targets the displayed up-next episode, which may differ from the
  // library entry. Filter stored display results immediately, without refetching.
  const base = items
    .map((i) => advanced.get(i._id) ?? i)
    .filter((i) => !removed.has(i._id) && !isCwDismissed(i));
  if (extra.length === 0) return base;
  const keyOf = (i: LibraryItem) => `${i.type}|${franchiseDedupKey(i.name ?? "")}`;
  const baseKeys = new Set(base.map(keyOf));
  const dedupExtra = extra.filter((i) => !baseKeys.has(keyOf(i)) && !isCwDismissed(i));
  return dedupExtra.length === 0 ? base : base.concat(dedupExtra);
}
