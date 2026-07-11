import type { PlayerBridge } from "@/lib/player/bridge";
import { readResumeMs, saveResumeMs } from "@/lib/resume";
import { useSettings } from "@/lib/settings";
import { cloudWriteId, episodeFromVideoId, libraryGetOne } from "@/lib/stremio";
import type { PlayerSrc } from "@/lib/view";
import { useEffect, useRef, useState, type RefObject } from "react";

import { videoIdFor } from "./use-stremio-sync";

const RESUME_PROMPT_MIN_SEC = 30;
const RESTART_THRESHOLD = 0.8;

export function useBridgeLoad(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  inRoomRef: RefObject<boolean>;
  isHostRef: RefObject<boolean>;
  bridgeReady: boolean;
  bridgeKey: string;
  src: PlayerSrc;
  transcodedUrl: string | null;
  season: number | undefined;
  episode: number | undefined;
  authKey: string | null;
}): {
  pendingResumeSec: number | null;
  acknowledgeResume: (action: "resume" | "start-over") => void;
  pendingSeekSec: number | null;
  clearPendingSeek: () => void;
} {
  const { bridgeRef, inRoomRef, isHostRef, bridgeReady, bridgeKey, src, transcodedUrl, season, episode, authKey } =
    params;

  const { settings } = useSettings();
  const resumePromptRef = useRef(settings.resumePrompt);
  resumePromptRef.current = settings.resumePrompt;
  const resumePlaybackRef = useRef(settings.resumePlayback);
  resumePlaybackRef.current = settings.resumePlayback;

  const lastLoadedUrlRef = useRef<string | null>(null);
  const firstLoadRef = useRef(true);
  const [pendingResumeSec, setPendingResumeSec] = useState<number | null>(null);
  const [pendingSeekSec, setPendingSeekSec] = useState<number | null>(null);
  const ackRef = useRef<((action: "resume" | "start-over") => void) | null>(null);

  useEffect(() => {
    if (!bridgeReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const playUrl = transcodedUrl ?? src.url;
    const loadKey = `${playUrl}|s${season ?? ""}e${episode ?? ""}`;
    if (lastLoadedUrlRef.current === loadKey) return;
    lastLoadedUrlRef.current = loadKey;
    const isFirstLoad = firstLoadRef.current;
    firstLoadRef.current = false;
    const isAutoRetry = (src.attempt ?? 0) > 0;
    const isLive =
      !!src.meta.id?.startsWith("iptv:") ||
      (!!src.meta.type && !["movie", "series", "anime"].includes(String(src.meta.type).toLowerCase()));
    let cancelled = false;
    (async () => {
      const openingVid = videoIdFor(src, cloudWriteId(src.meta.id, src.imdbId ?? null, src.imdbIdVerified === true));
      const resolved =
        isLive || src.startFromZero
          ? { ms: 0, fromRemote: false, finished: false }
          : await resolveStartMs(
              src.meta.id,
              season,
              episode,
              authKey,
              src.imdbId ?? null,
              src.imdbIdVerified === true,
              openingVid,
            );
      const startMs = resolved.ms;
      const runtimeMin = src.episode?.runtime ?? null;
      const durationMs = runtimeMin && runtimeMin > 0 ? runtimeMin * 60_000 : 0;
      const finishedNearEnd = resolved.finished || (durationMs > 0 && startMs / durationMs >= RESTART_THRESHOLD);
      const startSec = (!resumePlaybackRef.current || finishedNearEnd ? 0 : startMs) / 1000;
      const guestInRoom = inRoomRef.current && !isHostRef.current;
      const eligibleForPrompt =
        isFirstLoad &&
        !isAutoRetry &&
        !isLive &&
        resumePromptRef.current &&
        startSec > RESUME_PROMPT_MIN_SEC &&
        !guestInRoom;
      try {
        await bridge.load({
          url: playUrl,
          subtitles: src.subtitles,
          notWebReady: src.notWebReady,
          isLive,
          headers: src.headers,
          startAtSec: guestInRoom
            ? undefined
            : eligibleForPrompt
              ? undefined
              : startSec > 5
                ? startSec
                : isFirstLoad
                  ? undefined
                  : 0,
        });
      } catch (e) {
        if (cancelled) return;
        console.warn("[player] load failed", e);
        return;
      }
      if (cancelled) return;
      if (!eligibleForPrompt && !guestInRoom && startSec > 5) {
        let unsub: (() => void) | null = null;
        let synced = false;
        const stop = () => {
          synced = true;
          unsub?.();
        };
        unsub = bridge.subscribe((s) => {
          if (cancelled) {
            stop();
            return;
          }
          if (s.durationSec <= 0) return;
          stop();
          if (startSec >= s.durationSec - 20) bridge.seek(0);
        });
        if (synced) unsub?.();
      }
      if (eligibleForPrompt) {
        bridge.pause();
        setPendingResumeSec(startSec);
        ackRef.current = (action) => {
          ackRef.current = null;
          setPendingResumeSec(null);
          if (action === "resume") {
            setPendingSeekSec(startSec);
          } else {
            setPendingSeekSec(0);
          }
        };
        return;
      }
      if (!inRoomRef.current) {
        bridge.play().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bridgeReady,
    bridgeKey,
    src.url,
    src.notWebReady,
    src.meta.id,
    src.subtitles,
    season,
    episode,
    transcodedUrl,
    authKey,
  ]);

  useEffect(() => {
    lastLoadedUrlRef.current = null;
  }, [bridgeKey]);

  const acknowledgeResume = (action: "resume" | "start-over") => {
    ackRef.current?.(action);
  };

  const clearPendingSeek = () => setPendingSeekSec(null);

  return { pendingResumeSec, acknowledgeResume, pendingSeekSec, clearPendingSeek };
}

async function resolveStartMs(
  metaId: string,
  season: number | undefined,
  episode: number | undefined,
  authKey: string | null,
  imdbId: string | null,
  imdbVerified: boolean,
  openingVid: string | null,
): Promise<{ ms: number; fromRemote: boolean; finished: boolean }> {
  const local = readResumeMs(metaId, season, episode);
  const isEpisode = typeof season === "number" && typeof episode === "number";
  if (!authKey) return { ms: local, fromRemote: false, finished: false };
  const matchesEpisode = (item: { state?: { season?: number; episode?: number; video_id?: string } } | null) => {
    if (!item) return false;
    if (typeof season !== "number" || typeof episode !== "number") return true;
    const vid = item.state?.video_id;
    if (openingVid && vid && vid === openingVid) return true;
    const fromVid = episodeFromVideoId(vid);
    const se = item.state?.season ?? fromVid?.season;
    const ep = item.state?.episode ?? fromVid?.episode;
    return se === season && ep === episode;
  };
  const lookups: string[] = [];
  if (metaId.startsWith("tt")) lookups.push(metaId);
  else if (imdbVerified && imdbId?.startsWith("tt")) lookups.push(imdbId, metaId);
  else lookups.push(metaId);
  for (const lookupId of lookups) {
    const remote = await libraryGetOne(authKey, lookupId).catch(() => null);
    if (!remote || !matchesEpisode(remote)) continue;
    const remoteMs = remote.state?.timeOffset ?? 0;
    if (remoteMs <= 0) continue;
    const remoteDuration = remote.state?.duration ?? 0;
    const flaggedWatched = (remote.state as { flaggedWatched?: number })?.flaggedWatched === 1;
    const finished =
      isEpisode && (flaggedWatched || (remoteDuration > 0 && remoteMs / remoteDuration >= RESTART_THRESHOLD));
    if (remoteMs >= local) {
      if (remoteMs > local) saveResumeMs(metaId, remoteMs, season, episode);
      return { ms: remoteMs, fromRemote: true, finished };
    }
    return { ms: local, fromRemote: false, finished };
  }
  return { ms: local, fromRemote: false, finished: false };
}
