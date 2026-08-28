import { useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { cloudWriteId } from "@/lib/stremio";
import { isResumeStartReady, resolveStartMs } from "@/lib/player/resume-start";
import type { PlayerSrc } from "@/lib/view";
import { videoIdFor } from "./use-stremio-sync";
import { useSettings } from "@/lib/settings";
import { playbackStartupProfile } from "@/lib/player/startup-profile";
import { releaseStreamProxy, retainStreamProxy } from "@/lib/stream-proxy";

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
  const ackRef = useRef<((action: "resume" | "start-over") => void) | null>(null);

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
    const loadKey = `${playUrl}|s${season ?? ""}e${episode ?? ""}`;
    if (lastLoadedUrlRef.current === loadKey) return;
    lastLoadedUrlRef.current = loadKey;
    const isFirstLoad = firstLoadRef.current;
    firstLoadRef.current = false;
    const isAutoRetry = (src.attempt ?? 0) > 0;
    const isLive =
      !!src.meta.id?.startsWith("iptv:") ||
      (!!src.meta.type &&
        !["movie", "series", "anime"].includes(String(src.meta.type).toLowerCase()));
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
      const loadMedia = () =>
        bridge.load({
          url: playUrl,
          traceId: src.playbackTraceId,
          startupProfile: playbackStartupProfile(src.streamRef),
          subtitles: src.subtitles,
          notWebReady: src.notWebReady,
          isLive,
          headers: src.headers,
        });
      let resolved: Awaited<typeof resumePromise>;
      try {
        const waitBeforeLoad =
          shouldResolveResume && !!authKey && !isResumeStartReady(resumeIdentity);
        if (waitBeforeLoad) {
          resolved = await resumePromise;
          await loadMedia();
        } else {
          [resolved] = await Promise.all([resumePromise, loadMedia()]);
        }
      } catch (e) {
        if (cancelled) return;
        console.warn("[player] load failed", e);
        return;
      }
      const startMs = resolved.ms;
      const runtimeMin = src.episode?.runtime ?? null;
      const durationMs = runtimeMin && runtimeMin > 0 ? runtimeMin * 60_000 : 0;
      const finishedNearEnd =
        resolved.finished || (durationMs > 0 && startMs / durationMs >= RESTART_THRESHOLD);
      const startSec = (!resumePlaybackRef.current || finishedNearEnd ? 0 : startMs) / 1000;
      const guestInRoom = inRoomRef.current && !isHostRef.current;
      const eligibleForPrompt =
        isFirstLoad &&
        !isAutoRetry &&
        !isLive &&
        resumePromptRef.current &&
        startSec > RESUME_PROMPT_MIN_SEC &&
        !guestInRoom;
      if (cancelled) return;
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
        // On Linux's embedded mpv renderer, supplying `start` during load can
        // race the initial render context with a network seek. Load the first
        // frame normally, then seek once the bridge reports a duration.
        setPendingSeekSec(startSec);
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
    src.playbackTraceId,
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
