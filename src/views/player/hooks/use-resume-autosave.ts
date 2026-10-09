import { useEffect, useMemo, useRef } from "react";
import { markAnimeWatching, syncAnimeProgress } from "@/lib/anilist/sync";
import { markMalWatching, syncMalProgress } from "@/lib/mal/sync";
import { getSession as getAnilistSession } from "@/lib/anilist/session";
import { getSession as getMalSession } from "@/lib/mal/session";
import { activeProfileId } from "@/lib/active-profile-id";
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
import { animeTrackerTarget } from "@/lib/tracker-progress";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import { useProfiles } from "@/lib/profiles";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import { ANIME_CLOUD_ID, CLOUD_OK } from "@/lib/stremio";
import { syncSeriesWatchedToStremio } from "@/lib/stremio-episode-watched";
import { isNaturalEnd } from "@/lib/player/playback-end";
import { playerLoadIdentity } from "@/lib/player/load-identity";

const TICK_MS = 4000;
const MIN_POSITION_SEC = 5;
const TASTE_MIN_SEC = 90;
const WATCHED_RATIO = 0.85;
const REWATCH_RESUME_SEC = 45;
const SYNC_RATIO = 0.7;
const STUB_MAX_SEC = 150;

const isAnimeId = (id: string) =>
  id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");

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

type ResumeAutosaveParams = {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  season: number | undefined;
  episode: number | undefined;
  resolvedImdbId: string | null;
  resolvedImdbVerified: boolean;
};

type ResumeSession = {
  ownerId: string | undefined;
  latest: ResumeAutosaveParams | null;
  ready: boolean;
  position: number;
  lastSaved: number;
};

export function useResumeAutosave(params: ResumeAutosaveParams) {
  const { src, snap, season, episode } = params;
  const { settings } = useSettings();
  const { activeProfile } = useProfiles();
  const ownerId = activeProfile?.id;
  const taughtRef = useRef<Set<string>>(new Set());
  const anilistAutoSyncRef = useRef(settings.anilistAutoSync);
  anilistAutoSyncRef.current = settings.anilistAutoSync;
  const malAutoSyncRef = useRef(settings.malAutoSync);
  malAutoSyncRef.current = settings.malAutoSync;
  // Cleanup must retain the outgoing source, duration and position together.
  // A new episode can render before the bridge publishes its loading reset.
  const sourceIdentity = playerLoadIdentity(src, src.url, season, episode);
  const session = useMemo<ResumeSession>(
    () => ({ latest: null, ready: false, position: 0, lastSaved: 0, ownerId }),
    [sourceIdentity, ownerId],
  );
  const activeSessionRef = useRef(session);
  activeSessionRef.current = session;
  useEffect(() => {
    if (
      snap.status === "loading" ||
      snap.status === "idle" ||
      (snap.positionSec === 0 && snap.durationSec === 0)
    ) {
      session.ready = true;
      return;
    }
    if (!session.ready) return;
    // Keep the last usable duration through the bridge's teardown/reset event.
    if (snap.durationSec > 0 || !session.latest) session.latest = params;
    // Position-only events update the playback clock, not this React snapshot.
    // A subtitle/settings rerender must not replace that newer clock position.
    if (session.position === 0 && snap.positionSec >= MIN_POSITION_SEC)
      session.position = snap.positionSec;
  });

  useEffect(
    () =>
      subscribePlaybackClock(() => {
        const current = activeSessionRef.current;
        if (!current.ready) return;
        const pos = getPlaybackPosition();
        if (pos >= MIN_POSITION_SEC) current.position = pos;
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

  const record = (current: ResumeSession): void => {
    if (!current.ready || !current.latest) return;
    const {
      src: s, snap: sn, season: se, episode: ep,
      resolvedImdbId: rid, resolvedImdbVerified: rv,
    } = current.latest;
    const id = s.meta.id;
    if (!id || id.startsWith("iptv:")) return;
    if (sn.durationSec > 0 && sn.durationSec < STUB_MAX_SEC) return;
    const pos = current.position;
    if (pos < MIN_POSITION_SEC) return;
    const seasonForeign = splitSeasonForeign(s, se);
    const cs = seasonForeign ? se : canonSeason(s, se);
    const finished =
      (sn.durationSec > 0 && pos / sn.durationSec >= WATCHED_RATIO) || isNaturalEnd(sn, pos);
    current.lastSaved = pos * 1000;
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
      if (covered.length) {
        for (const coveredEpisode of covered) clearResume(id, se, coveredEpisode, current.ownerId);
      } else clearResume(id, se, ep, current.ownerId);
    } else if (covered.length) {
      for (const coveredEpisode of covered)
        saveResumeMs(
          id,
          pos * 1000,
          se,
          coveredEpisode,
          displaySeasonFor(s, se, cs, seasonForeign),
          undefined,
          undefined,
          current.ownerId,
        );
    } else {
      saveResumeMs(
        id, pos * 1000, se, ep, displaySeasonFor(s, se, cs, seasonForeign),
        undefined, undefined, current.ownerId,
      );
    }
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
      void syncSeriesWatchedToStremio(s.meta, rv ? rid : null);
    }
    if (s.meta.type === "movie" && finished) {
      setMovieWatchedLocal(id, true);
      clearLocalCw(id, current.ownerId);
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
      (movieWasWatched || localCwEntry(id, true, current.ownerId) !== null);
    if (rewatchMovie && movieWasWatched) setMovieWatchedLocal(id, false);
    if (
      (s.meta.type === "series" || s.meta.type === "movie" || s.meta.type === "anime" || animeLocal) &&
      !(s.meta.type === "movie" && finished)
    ) {
      saveLocalCw(
        {
          id,
          type: s.meta.type === "movie" ? "movie" : "series",
          name: s.meta.name,
          poster: s.meta.poster,
          background: s.meta.background,
          isAnime: animeLocal || s.meta.type === "anime" || !!s.isAnime || !!s.episode?.kitsuStreamId,
          source: CLOUD_OK.test(id) && !isLocalUrl(s.url) ? "library" : "local",
          season: cs,
          episode: ep,
          videoId: s.episode?.videoId ?? s.episode?.kitsuStreamId,
          positionMs: Math.floor(pos * 1000),
          durationMs: Math.max(0, Math.floor(sn.durationSec * 1000)),
          t: Date.now(),
        },
        current.ownerId,
        !CLOUD_OK.test(id) || isLocalUrl(s.url) || animeLocal || ttAnimeUnmapped || rewatchMovie,
      );
    }
    if (pos < TASTE_MIN_SEC) return;
    const track = animeTrackerTarget(id, s.episode, ep);
    const profile = activeProfileId();
    const anilistSession = getAnilistSession();
    const malSession = getMalSession();
    const syncReady = finished || (sn.durationSec > 0 && pos / sn.durationSec >= SYNC_RATIO);
    const fireTrackers = (tid: string, tep: number | undefined): void => {
      // Resolution may finish after a profile switch or tracker reconnect.
      if (activeProfileId() !== profile || activeSessionRef.current.ownerId !== current.ownerId) return;
      if (anilistAutoSyncRef.current && getAnilistSession() === anilistSession) {
        if (syncReady) void syncAnimeProgress(tid, tep, s.meta.name, cs);
        else void markAnimeWatching(tid, s.meta.name);
      }
      if (malAutoSyncRef.current && getMalSession() === malSession) {
        if (syncReady) void syncMalProgress(tid, tep, s.meta.name, cs);
        else void markMalWatching(tid, s.meta.name);
      }
    };
    const useIdentity =
      (anilistAutoSyncRef.current || malAutoSyncRef.current) &&
      animeIdentityEligibleForSync(id, s.episode);
    if (track && !useIdentity) {
      fireTrackers(track.id, track.episode);
    } else if (useIdentity) {
      void resolveAnimeIdentity(id, rid, {
        season: cs,
        episode: ep,
        imdbSeason: s.episode?.imdbSeason,
        imdbEpisode: s.episode?.imdbEpisode,
      })
        .then((identity) => {
          // Prefer the season-scoped entry so multi-season franchises sync to
          // the correct per-season AniList/MAL media, not the season-1 entry.
          if (identity) fireTrackers(`kitsu:${identity.kitsuId}`, identity.number);
          else if (track) fireTrackers(track.id, track.episode);
        })
        .catch(() => {
          if (track) fireTrackers(track.id, track.episode);
        });
    }
    const kind = finished ? "watched" : "play";
    const key = `${id}|${kind}`;
    if (taughtRef.current.has(key)) return;
    taughtRef.current.add(key);
    trackEvent(id, kind, profileFromMeta(s.meta));
  };

  const persistNow = (force: boolean): void => {
    const current = activeSessionRef.current;
    if (!current.ready || !current.latest || current.latest.src.meta.id?.startsWith("iptv:")) return;
    const pos = getPlaybackPosition() || current.position;
    if (pos < MIN_POSITION_SEC) return;
    const ms = pos * 1000;
    if (!force && Math.abs(ms - current.lastSaved) < 1500) return;
    current.position = pos;
    record(current);
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
    return () => record(session);
  }, [session]);

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
