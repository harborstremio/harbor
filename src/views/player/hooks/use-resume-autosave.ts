import { useEffect, useRef } from "react";
import { markAnimeWatching, syncAnimeProgress } from "@/lib/anilist/sync";
import { markMalWatching, syncMalProgress } from "@/lib/mal/sync";
import { profileFromMeta } from "@/lib/discover/profile";
import { trackEvent } from "@/lib/discover/store";
import { isExternalPlaylistId } from "@/lib/iptv/vod";
import { saveLocalCw } from "@/lib/local-cw";
import { isLocalUrl } from "@/lib/player/local-url";
import { isManuallyWatched, recordManualWatchedMeta, setManualWatched } from "@/lib/manual-watched";
import { savePlayback } from "@/lib/playback-history";
import { saveResumeMs } from "@/lib/resume";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useSettings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { CLOUD_OK } from "@/lib/stremio";

const TICK_MS = 4000;
const MIN_POSITION_SEC = 5;
const TASTE_MIN_SEC = 90;
const WATCHED_RATIO = 0.85;
const STUB_MAX_SEC = 150;

const isAnimeId = (id: string) =>
  id.startsWith("kitsu:") || id.startsWith("mal:") || id.startsWith("anilist:");

const animeTrackId = (s: PlayerSrc): string | null => {
  if (isAnimeId(s.meta.id)) return s.meta.id;
  const ks = s.episode?.kitsuStreamId;
  if (ks?.startsWith("kitsu:")) return ks.split(":").slice(0, 2).join(":");
  return null;
};

export function useResumeAutosave(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  season: number | undefined;
  episode: number | undefined;
}) {
  const { src, snap, season, episode } = params;
  const { settings } = useSettings();
  const lastSavedRef = useRef(0);
  const taughtRef = useRef<Set<string>>(new Set());
  const anilistAutoSyncRef = useRef(settings.anilistAutoSync);
  anilistAutoSyncRef.current = settings.anilistAutoSync;
  const malAutoSyncRef = useRef(settings.malAutoSync);
  malAutoSyncRef.current = settings.malAutoSync;
  const latestRef = useRef({ src, snap, season, episode });
  latestRef.current = { src, snap, season, episode };
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

  const record = (s: PlayerSrc, sn: PlayerSnapshot, se?: number, ep?: number): void => {
    const id = s.meta.id;
    if (!id || id.startsWith("iptv:")) return;
    if (sn.durationSec > 0 && sn.durationSec < STUB_MAX_SEC) return;
    const pos = getPlaybackPosition() || lastGoodPosRef.current;
    if (pos < MIN_POSITION_SEC) return;
    const displaySeason =
      s.episode?.imdbSeason != null && s.episode.imdbSeason >= 1 ? s.episode.imdbSeason : se;
    const displayEpisode =
      s.episode?.imdbEpisode != null && s.episode.imdbEpisode >= 1 ? s.episode.imdbEpisode : ep;
    const finished =
      (sn.durationSec > 0 && pos / sn.durationSec >= WATCHED_RATIO) || sn.status === "ended";
    lastSavedRef.current = pos * 1000;
    saveResumeMs(id, pos * 1000, se, ep, displaySeason, displayEpisode);
    if (isExternalPlaylistId(id)) return;
    if (s.streamRef) {
      savePlayback(id, { ...s.streamRef, url: s.url, title: s.meta.name }, se, ep);
    } else {
      savePlayback(id, { title: s.meta.name, parsedTitle: s.meta.name }, se, ep);
    }
    if (
      (s.meta.type === "series" || s.meta.type === "anime" || isAnimeId(id)) &&
      typeof se === "number" &&
      typeof ep === "number" &&
      finished &&
      !isManuallyWatched(id, se, ep)
    ) {
      recordManualWatchedMeta(id, {
        type: "series",
        name: s.meta.name,
        poster: s.meta.poster,
        background: s.meta.background,
      });
      setManualWatched(id, se, ep, true);
    }
    if (
      (s.meta.type === "series" || s.meta.type === "movie") &&
      (!CLOUD_OK.test(id) || isLocalUrl(s.url))
    ) {
      saveLocalCw({
        id,
        type: s.meta.type,
        name: s.meta.name,
        poster: s.meta.poster,
        background: s.meta.background,
        season: displaySeason,
        episode: displayEpisode,
        videoId: s.episode?.videoId,
        positionMs: Math.floor(pos * 1000),
        durationMs: Math.max(0, Math.floor(sn.durationSec * 1000)),
        t: Date.now(),
      });
    }
    if (pos < TASTE_MIN_SEC) return;
    const trackId = animeTrackId(s);
    if (anilistAutoSyncRef.current && trackId) {
      void markAnimeWatching(trackId, s.meta.name);
    }
    if (malAutoSyncRef.current && trackId) {
      void markMalWatching(trackId, s.meta.name);
    }
    if (finished && anilistAutoSyncRef.current && trackId) {
      void syncAnimeProgress(trackId, ep, s.meta.name);
    }
    if (finished && malAutoSyncRef.current && trackId) {
      void syncMalProgress(trackId, ep, s.meta.name);
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
