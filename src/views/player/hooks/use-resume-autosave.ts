import { useEffect, useRef } from "react";
import { markAnimeWatching, syncAnimeProgress } from "@/lib/anilist/sync";
import { markMalWatching, syncMalProgress } from "@/lib/mal/sync";
import { animeIdentityEligible, resolveAnimeIdentity } from "@/lib/streams/anime-identity";
import {
  isForeignSplitSeason,
  splitFranchiseDisplaySeason,
} from "@/lib/streams/anime-identity-core";
import { isSplitFranchiseKitsu } from "@/lib/providers/anime-franchise-root";
import { parseKitsuId } from "@/lib/providers/kitsu";
import { profileFromMeta } from "@/lib/discover/profile";
import { trackEvent } from "@/lib/discover/store";
import { isExternalPlaylistId } from "@/lib/iptv/vod";
import { clearLocalCw, localCwEntry, saveLocalCw } from "@/lib/local-cw";
import { recordWatchEvent } from "@/lib/watch-events";
import { isLocalUrl } from "@/lib/player/local-url";
import { isManuallyWatched, recordManualWatchedMeta, setManualWatched } from "@/lib/manual-watched";
import { savePlayback } from "@/lib/playback-history";
import { clearResume, saveResumeMs } from "@/lib/resume";
import { isMovieWatchedLocal, setMovieWatchedLocal } from "@/lib/movie-watched";
import { setViewedSeason } from "@/lib/season-view-pref";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import { ANIME_CLOUD_ID, CLOUD_OK } from "@/lib/stremio";
import { syncSeriesWatchedToStremio } from "@/lib/stremio-episode-watched";
import { isNaturalEnd } from "@/lib/player/playback-end";

const TICK_MS = 4000;
const MIN_POSITION_SEC = 5;
const TASTE_MIN_SEC = 90;
const WATCHED_RATIO = 0.85;
const REWATCH_RESUME_SEC = 45;
const SYNC_RATIO = 0.7;
const STUB_MAX_SEC = 150;

const isAnimeId = (id: string) =>
  id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");

const animeTrackId = (s: PlayerSrc): string | null => {
  if (isAnimeId(s.meta.id)) return s.meta.id;
  const ks = s.episode?.kitsuStreamId;
  if (ks?.startsWith("kitsu:")) return ks.split(":").slice(0, 2).join(":");
  return null;
};

// Per-season sync resolution that also applies when a kitsu stream id is set.
// Off the split-franchise allowlist this defers to stock eligibility.
const animeIdentityEligibleForSync = (
  metaId: string,
  episode: PlayEpisode | undefined | null,
): boolean => {
  if (typeof episode?.imdbSeason !== "number" || episode.imdbSeason < 1) return false;
  if (!(isAnimeId(metaId) || metaId.startsWith("tt") || metaId.startsWith("tmdb:tv:")))
    return false;
  const kid = parseKitsuId(metaId) ?? parseKitsuId(episode?.kitsuStreamId ?? "");
  if (!isSplitFranchiseKitsu(kid)) return animeIdentityEligible(metaId, episode);
  return true;
};

export function useResumeAutosave(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  season: number | undefined;
  episode: number | undefined;
  resolvedImdbId: string | null;
  resolvedImdbVerified: boolean;
}) {
  const { src, snap, season, episode, resolvedImdbId, resolvedImdbVerified } = params;
  const { settings } = useSettings();
  const lastSavedRef = useRef(0);
  const taughtRef = useRef<Set<string>>(new Set());
  const anilistAutoSyncRef = useRef(settings.anilistAutoSync);
  anilistAutoSyncRef.current = settings.anilistAutoSync;
  const malAutoSyncRef = useRef(settings.malAutoSync);
  malAutoSyncRef.current = settings.malAutoSync;
  const anilistCountRewatchesRef = useRef(settings.anilistCountRewatches);
  anilistCountRewatchesRef.current = settings.anilistCountRewatches;
  const malCountRewatchesRef = useRef(settings.malCountRewatches);
  malCountRewatchesRef.current = settings.malCountRewatches;
  const latestRef = useRef({ src, snap, season, episode, resolvedImdbId, resolvedImdbVerified });
  latestRef.current = { src, snap, season, episode, resolvedImdbId, resolvedImdbVerified };
  const lastGoodPosRef = useRef(0);

  useEffect(() => {
    lastGoodPosRef.current = 0;
  }, [src.url, src.meta.id, season, episode]);

  useEffect(
    () =>
      subscribePlaybackClock(() => {
        const pos = getPlaybackPosition();
        if (pos >= MIN_POSITION_SEC) lastGoodPosRef.current = pos;
      }),
    [],
  );

  const canonSeason = (s: PlayerSrc, se?: number): number | undefined =>
    s.episode?.imdbSeason != null && s.episode.imdbSeason >= 1 ? s.episode.imdbSeason : se;

  const splitKitsuId = (s: PlayerSrc): number | null =>
    parseKitsuId(s.meta.id) ?? parseKitsuId(s.episode?.kitsuStreamId ?? "");

  const displaySeasonFor = (
    s: PlayerSrc,
    se: number | undefined,
    cs: number | undefined,
    foreign: boolean,
  ): number | undefined => splitFranchiseDisplaySeason(splitKitsuId(s)) ?? (foreign ? se : cs);

  const splitSeasonForeign = (s: PlayerSrc, se?: number): boolean => {
    if (!isSplitFranchiseKitsu(splitKitsuId(s))) return false;
    return isForeignSplitSeason(true, se, s.episode?.imdbSeason);
  };

  const record = (s: PlayerSrc, sn: PlayerSnapshot, se?: number, ep?: number): void => {
    const id = s.meta.id;
    if (!id || id.startsWith("iptv:")) return;
    if (sn.durationSec > 0 && sn.durationSec < STUB_MAX_SEC) return;
    const pos = getPlaybackPosition() || lastGoodPosRef.current;
    if (pos < MIN_POSITION_SEC) return;
    const seasonForeign = splitSeasonForeign(s, se);
    const cs = seasonForeign ? se : canonSeason(s, se);
    const finished =
      (sn.durationSec > 0 && pos / sn.durationSec >= WATCHED_RATIO) || isNaturalEnd(sn, pos);
    lastSavedRef.current = pos * 1000;
    const covered =
      s.episodeSpan && cs === s.episodeSpan.season
        ? Array.from(
            { length: s.episodeSpan.episodeEnd - s.episodeSpan.episode + 1 },
            (_, index) => s.episodeSpan!.episode + index,
          )
        : typeof ep === "number"
          ? [ep]
          : [];
    if (finished) {
      if (covered.length) for (const coveredEpisode of covered) clearResume(id, se, coveredEpisode);
      else clearResume(id, se, ep);
    } else if (covered.length) {
      for (const coveredEpisode of covered)
        saveResumeMs(
          id,
          pos * 1000,
          se,
          coveredEpisode,
          displaySeasonFor(s, se, cs, seasonForeign),
        );
    } else saveResumeMs(id, pos * 1000, se, ep, displaySeasonFor(s, se, cs, seasonForeign));
    if (typeof cs === "number") setViewedSeason(id, cs);
    if (isExternalPlaylistId(id)) return;
    if (s.streamRef) {
      savePlayback(id, { ...s.streamRef, url: s.historyUrl ?? s.url, title: s.meta.name }, cs, ep);
    } else {
      savePlayback(id, { title: s.meta.name, parsedTitle: s.meta.name }, cs, ep);
    }
    if (
      (s.meta.type === "series" || s.meta.type === "anime" || isAnimeId(id)) &&
      typeof cs === "number" &&
      typeof ep === "number" &&
      finished &&
      !isManuallyWatched(id, cs, ep)
    ) {
      recordManualWatchedMeta(id, {
        type: "series",
        name: s.meta.name,
        poster: s.meta.poster,
        background: s.meta.background,
      });
      for (const coveredEpisode of covered.length ? covered : [ep])
        setManualWatched(id, cs, coveredEpisode, true);
      const { resolvedImdbId: rid, resolvedImdbVerified: rv } = latestRef.current;
      void syncSeriesWatchedToStremio(s.meta, rv ? rid : null);
    }
    if (s.meta.type === "movie" && finished) {
      setMovieWatchedLocal(id, true);
      clearLocalCw(id);
    }
    if (finished) {
      recordWatchEvent({
        id,
        type: s.meta.type === "movie" ? "movie" : "series",
        name: s.meta.name,
        poster: s.meta.poster,
        season: cs,
        episode: ep,
        at: Date.now(),
      });
    }
    const animeLocal = ANIME_CLOUD_ID.test(id);
    const ttAnimeUnmapped =
      id.startsWith("tt") &&
      !!s.episode?.kitsuStreamId &&
      (s.episode.imdbSeason == null || s.episode.imdbEpisode == null);
    // Rewatching an already-finished movie (resumed past 45s, still below the finish ratio)
    // must put it back in Continue Watching even when the Stremio cloud write is skipped (e.g.
    // signed out). Clearing the local watched marker and tracking it locally yields an in-progress
    // item with flaggedWatched=0 that isCwMember accepts, independent of authKey.
    const movieWasWatched = s.meta.type === "movie" && isMovieWatchedLocal(id);
    const rewatchMovie =
      s.meta.type === "movie" &&
      sn.durationSec > 0 &&
      pos >= REWATCH_RESUME_SEC &&
      pos / sn.durationSec < WATCHED_RATIO &&
      (movieWasWatched || localCwEntry(id) !== null);
    if (rewatchMovie && movieWasWatched) setMovieWatchedLocal(id, false);
    if (
      (s.meta.type === "series" || s.meta.type === "movie" || animeLocal) &&
      (!CLOUD_OK.test(id) || isLocalUrl(s.url) || animeLocal || ttAnimeUnmapped || rewatchMovie)
    ) {
      saveLocalCw({
        id,
        type: s.meta.type === "movie" ? "movie" : "series",
        name: s.meta.name,
        poster: s.meta.poster,
        background: s.meta.background,
        season: cs,
        episode: ep,
        videoId: s.episode?.videoId ?? s.episode?.kitsuStreamId,
        positionMs: Math.floor(pos * 1000),
        durationMs: Math.max(0, Math.floor(sn.durationSec * 1000)),
        t: Date.now(),
      });
    }
    if (pos < TASTE_MIN_SEC) return;
    const trackId = s.episode?.sourceMetaId ?? animeTrackId(s);
    const absEp = s.episode?.absoluteNumber;
    const trackEp =
      seasonForeign && typeof ep === "number"
        ? ep
        : s.episode?.sourceMetaId
          ? ep
          : (s.episode?.imdbEpisode ?? ep);
    const syncReady = finished || (sn.durationSec > 0 && pos / sn.durationSec >= SYNC_RATIO);
    const fireTrackers = (tid: string, tep: number | undefined): void => {
      if (anilistAutoSyncRef.current) void markAnimeWatching(tid, s.meta.name);
      if (malAutoSyncRef.current) void markMalWatching(tid, s.meta.name);
      if (!syncReady) return;
      if (anilistAutoSyncRef.current)
        void syncAnimeProgress(
          tid,
          tep,
          s.meta.name,
          absEp,
          cs,
          anilistCountRewatchesRef.current,
        );
      if (malAutoSyncRef.current)
        void syncMalProgress(tid, tep, s.meta.name, absEp, cs, malCountRewatchesRef.current);
    };
    const useIdentity =
      (anilistAutoSyncRef.current || malAutoSyncRef.current) &&
      animeIdentityEligibleForSync(id, s.episode);
    if (trackId && !useIdentity) {
      fireTrackers(trackId, trackEp);
    } else if (useIdentity) {
      void resolveAnimeIdentity(id, latestRef.current.resolvedImdbId, {
        season: cs,
        episode: ep,
        imdbSeason: s.episode?.imdbSeason,
        imdbEpisode: s.episode?.imdbEpisode,
      })
        .then((identity) => {
          // Prefer the season-scoped entry so multi-season franchises sync to
          // the correct per-season AniList/MAL media, not the season-1 entry.
          if (identity) fireTrackers(`kitsu:${identity.kitsuId}`, identity.number);
          else if (trackId) fireTrackers(trackId, trackEp);
        })
        .catch(() => {
          if (trackId) fireTrackers(trackId, trackEp);
        });
    }
    const kind = finished ? "watched" : "play";
    const key = `${id}|${kind}`;
    if (taughtRef.current.has(key)) return;
    taughtRef.current.add(key);
    trackEvent(id, kind, profileFromMeta(s.meta));
  };

  const persistNow = (force: boolean): void => {
    const { src: s, snap: sn, season: se, episode: ep } = latestRef.current;
    if (s.meta.id?.startsWith("iptv:")) return;
    const pos = getPlaybackPosition() || lastGoodPosRef.current;
    if (pos < MIN_POSITION_SEC) return;
    const ms = pos * 1000;
    if (!force && Math.abs(ms - lastSavedRef.current) < 1500) return;
    record(s, sn, se, ep);
  };

  useEffect(() => {
    if (snap.status !== "playing") return;
    const id = window.setInterval(() => persistNow(false), TICK_MS);
    return () => window.clearInterval(id);
  }, [snap.status]);

  useEffect(() => {
    if (
      snap.status === "playing" ||
      snap.status === "loading" ||
      snap.status === "idle" ||
      snap.status === "ready"
    )
      return;
    persistNow(true);
  }, [snap.status]);

  useEffect(() => {
    const mySeason = season;
    const myEpisode = episode;
    return () => {
      record(latestRef.current.src, latestRef.current.snap, mySeason, myEpisode);
    };
  }, [src.url, src.meta.id, season, episode]);

  useEffect(() => {
    const onUnload = () => persistNow(true);
    window.addEventListener("pagehide", onUnload);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("pagehide", onUnload);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);
}
