import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { cloudWriteId } from "@/lib/stremio";
import { resolveStartMs } from "@/lib/player/resume-start";
import type { PlayerSrc } from "@/lib/view";
import { videoIdFor } from "./use-stremio-sync";
import { useSettings } from "@/lib/settings";
import { playbackStartupProfile } from "@/lib/player/startup-profile";
import { isLivePlaybackSrc } from "@/lib/player/live-src";
import { releaseStreamProxy, retainStreamProxy } from "@/lib/stream-proxy";
import { playerLoadIdentity } from "@/lib/player/load-identity";

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
  sourceKey: string;
  resumeReady: boolean;
} {
  const {
    bridgeRef,
    inRoomRef,
    isHostRef,
    bridgeReady,
    bridgeKey,
    src,
    transcodedUrl,
    season,
    episode,
    authKey,
  } = params;

  const { settings } = useSettings();
  const resumePromptRef = useRef(settings.resumePrompt);
  resumePromptRef.current = settings.resumePrompt;
  const resumePlaybackRef = useRef(settings.resumePlayback);
  resumePlaybackRef.current = settings.resumePlayback;

  const lastLoadedUrlRef = useRef<string | null>(null);
  const firstLoadRef = useRef(true);
  const [pendingResumeSec, setPendingResumeSec] = useState<number | null>(null);
  const [pendingSeekSec, setPendingSeekSec] = useState<number | null>(null);
  const [readyLoadKey, setReadyLoadKey] = useState<string | null>(null);
  const ackRef = useRef<((action: "resume" | "start-over") => void) | null>(null);
  const sourceIdentity = playerLoadIdentity(src, transcodedUrl ?? src.url, season, episode);
  const sourceKey = `${bridgeKey}|${sourceIdentity}`;

  useEffect(() => {
    const sessionId = src.proxySessionId;
    if (!sessionId) return;
    retainStreamProxy(sessionId);
    return () => {
      releaseStreamProxy(sessionId);
    };
  }, [src.proxySessionId]);

  useEffect(() => {
    if (!bridgeReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    const playUrl = transcodedUrl ?? src.url;
    const loadKey = sourceKey;
    if (lastLoadedUrlRef.current === loadKey) return;
    setPendingResumeSec(null);
    setPendingSeekSec(null);
    ackRef.current = null;
    const isFirstLoad = firstLoadRef.current;
    const isAutoRetry = (src.attempt ?? 0) > 0;
    const isLive = isLivePlaybackSrc(src);
    let cancelled = false;
    (async () => {
      const openingVid = videoIdFor(
        src,
        cloudWriteId(src.meta.id, src.imdbId ?? null, src.imdbIdVerified === true),
      );
      const resumeIdentity = {
        metaId: src.meta.id,
        authKey,
        imdbId: src.imdbId ?? null,
        imdbVerified: src.imdbIdVerified === true,
      };
      const shouldResolveResume =
        !isLive && !src.startFromZero && (resumePlaybackRef.current || resumePromptRef.current);
      const resumePromise = !shouldResolveResume
        ? Promise.resolve({ ms: 0, fromRemote: false, finished: false })
        : resolveStartMs({
            ...resumeIdentity,
            season,
            episode,
            openingVid,
          });
      let resolved: Awaited<typeof resumePromise>;
      try {
        resolved = await resumePromise;
      } catch (e) {
        if (!cancelled) console.warn("[player] resume lookup failed", e);
        return;
      }
      if (cancelled) return;
      const startMs = src.startPositionMs ?? resolved.ms;
      const runtimeMin = src.episode?.runtime ?? null;
      const durationMs = runtimeMin && runtimeMin > 0 ? runtimeMin * 60_000 : 0;
      const finishedNearEnd =
        resolved.finished || (durationMs > 0 && startMs / durationMs >= RESTART_THRESHOLD);
      // A source replacement (for example a home-server quality switch) carries
      // an explicit position and must preserve it regardless of the user's
      // automatic resume preference. That preference only governs stored resume
      // progress when opening an item normally.
      const hasExplicitStart = src.startPositionMs != null;
      const startSec =
        isLive || src.startFromZero
          ? 0
          : (hasExplicitStart ? startMs : !resumePlaybackRef.current || finishedNearEnd ? 0 : startMs) /
            1000;
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
          traceId: src.playbackTraceId,
          startupProfile: playbackStartupProfile(src.streamRef),
          subtitles: src.subtitles,
          notWebReady: src.notWebReady,
          isLive,
          headers: src.headers,
          // Supply resume to the initial load so mpv/HTML5 never start at zero
          // while a later seek races automatic intro skipping.
          startAtSec: !guestInRoom && !eligibleForPrompt && startSec > 5 ? startSec : undefined,
        });
      } catch (e) {
        if (!cancelled) console.warn("[player] load failed", e);
        return;
      }
      if (cancelled) return;
      lastLoadedUrlRef.current = loadKey;
      firstLoadRef.current = false;
      setReadyLoadKey(loadKey);
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
      if (!guestInRoom && startSec > 5) {
        setPendingSeekSec(startSec);
        return;
      }
      if (!inRoomRef.current && !src.startPaused) {
        bridge.play().catch(() => {});
      } else if (src.startPaused) {
        bridge.pause();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bridgeReady,
    bridgeKey,
    sourceIdentity,
    src.url,
    src.notWebReady,
    src.playbackTraceId,
    src.meta.id,
    src.subtitles,
    src.startPositionMs,
    src.startPaused,
    season,
    episode,
    transcodedUrl,
    authKey,
  ]);

  const acknowledgeResume = (action: "resume" | "start-over") => {
    ackRef.current?.(action);
  };

  const clearPendingSeek = () => setPendingSeekSec(null);

  return {
    pendingResumeSec: readyLoadKey === sourceKey ? pendingResumeSec : null,
    acknowledgeResume,
    pendingSeekSec: readyLoadKey === sourceKey ? pendingSeekSec : null,
    clearPendingSeek,
    sourceKey,
    resumeReady:
      bridgeReady &&
      readyLoadKey === sourceKey &&
      pendingResumeSec == null &&
      pendingSeekSec == null,
  };
}
