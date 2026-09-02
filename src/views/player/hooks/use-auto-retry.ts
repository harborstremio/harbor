import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import {
  getPlaybackBuffered,
  getPlaybackPosition,
  usePlaybackFlag,
} from "@/lib/player/playback-clock";
import { isTruncatedEnd } from "@/lib/player/playback-end";
import { isLocalUrl } from "@/lib/player/local-url";
import { clearOnePickerCache } from "@/lib/picker-cache";
import { resolveViaDebrids } from "@/lib/streams/resolve";
import { registerStreamProxy } from "@/lib/stream-proxy";
import { buildTranscodedUrl, probeStremioServer } from "@/lib/stremio-server";
import type { DebridStore } from "@/lib/debrid/types";
import type { Meta } from "@/lib/cinemeta";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import {
  BLACK_SCREEN_GRACE_MS,
  MAX_AUTORETRY_ATTEMPTS,
  NEVER_STARTED_CEILING_MS,
  ROOM_STALL_MS,
  SLOW_LOAD_MS,
  STUCK_AUTORETRY_MS,
} from "../player-utils";
import { GENUINE_FAILURE_WINDOW_MS, type EngineStats } from "@/lib/torrent/engine-stats";

type OpenPicker = (
  meta: Meta,
  episode?: PlayEpisode,
  opts?: { autoPlay?: boolean; attempt?: number },
) => void;

export type SourceError = { status: number; host: string; exhausted?: boolean };

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

export function useAutoRetry(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  stremioServerTranscode: boolean;
  instantPlay: boolean;
  inRoom: boolean;
  debrids: DebridStore[];
  selfFrameReadyRef: RefObject<boolean>;
  openPicker: OpenPicker;
  engineFailure: boolean;
  isP2pEngine: boolean;
  engineStats: EngineStats | null;
}) {
  const {
    bridgeRef,
    src,
    snap,
    stremioServerTranscode,
    instantPlay,
    inRoom,
    debrids,
    selfFrameReadyRef,
    openPicker,
    engineFailure,
    isP2pEngine,
    engineStats,
  } = params;
  const isLocal = isLocalUrl(src.url);
  const isLive = src.meta.id.startsWith("iptv:");
  const ENGINE_FIRST_FRAME_GRACE_MS = 20_000;
  const ENGINE_HARD_CEILING_MS = 75_000;
  const ENGINE_COMPLETE_RELOAD_MS = 8_000;
  const ENGINE_COMPLETE_FAILURE_MS = 20_000;
  const urlAtRef = useRef(0);
  const urlSeenRef = useRef<string | null>(null);
  if (urlSeenRef.current !== src.url) {
    urlSeenRef.current = src.url;
    urlAtRef.current = Date.now();
  }
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const engineStatsRef = useRef(engineStats);
  engineStatsRef.current = engineStats;
  const dlRef = useRef({ bytes: 0, at: 0 });

  const hasProgress = usePlaybackFlag(
    () => getPlaybackPosition() > 0.5 || getPlaybackBuffered() > 0.5,
  );
  const startedPlaying = usePlaybackFlag(() => getPlaybackPosition() > 0.5);
  const [slowLoad, setSlowLoad] = useState(false);
  useEffect(() => {
    setSlowLoad(false);
    if (isLocal) return;
    const hasMeaningful = hasProgress || snap.firstFrameReady;
    if (hasMeaningful) return;
    const t = window.setTimeout(() => setSlowLoad(true), SLOW_LOAD_MS);
    return () => window.clearTimeout(t);
  }, [src.url, snap.firstFrameReady, hasProgress, isLocal]);

  const autoRetriedRef = useRef(false);
  const transcodedTriedRef = useRef(false);
  const sameUrlRetriedRef = useRef(false);
  const proxyRetriedRef = useRef(false);
  const transcodeRescueRef = useRef(false);
  const debridFailoverTriedRef = useRef(false);
  const p2pCompleteReloadedRef = useRef(false);
  const p2pCompleteReloadedAtRef = useRef(0);
  const liveRetryCountRef = useRef(0);
  const livePlayedRef = useRef(false);
  const truncatedReloadedRef = useRef(false);
  const resumedAfterTruncatedRef = useRef(false);
  const [transcodedUrl, setTranscodedUrl] = useState<string | null>(null);
  const [sourceError, setSourceError] = useState<SourceError | null>(null);
  useEffect(() => {
    setSourceError(null);
    autoRetriedRef.current = false;
    transcodedTriedRef.current = false;
    sameUrlRetriedRef.current = false;
    proxyRetriedRef.current = false;
    transcodeRescueRef.current = false;
    debridFailoverTriedRef.current = false;
    p2pCompleteReloadedRef.current = false;
    p2pCompleteReloadedAtRef.current = 0;
    liveRetryCountRef.current = 0;
    livePlayedRef.current = false;
    truncatedReloadedRef.current = false;
    resumedAfterTruncatedRef.current = false;
    dlRef.current = { bytes: 0, at: Date.now() };
    setTranscodedUrl(null);
  }, [src.url]);

  useEffect(() => {
    if (isLive && hasProgress) livePlayedRef.current = true;
  }, [isLive, hasProgress]);

  useEffect(() => {
    if (!isLive) return;
    if (snap.errorCode == null) return;
    const maxAttempts = livePlayedRef.current ? 2 : 1;
    if (liveRetryCountRef.current >= maxAttempts) return;
    const b = bridgeRef.current;
    if (!b) return;
    const attempt = liveRetryCountRef.current + 1;
    const timer = window.setTimeout(
      () => {
        liveRetryCountRef.current = attempt;
        console.warn(`[player] live auto-reconnect attempt ${attempt}/${maxAttempts}`);
        void b.load({
          url: src.url,
          subtitles: src.subtitles,
          notWebReady: src.notWebReady,
          isLive: true,
          headers: src.headers,
        });
      },
      livePlayedRef.current ? 4000 : 1500,
    );
    return () => window.clearTimeout(timer);
  }, [isLive, snap.errorCode, src.url, src.subtitles, src.notWebReady, bridgeRef]);

  const triggerAutoRetry = useCallback(
    (reason: string) => {
      if (autoRetriedRef.current) return;
      if (isLocal) {
        console.warn(`[player] local file: skipping auto-retry (${reason})`);
        return;
      }
      if (isLive) {
        console.warn(`[player] live channel: skipping auto-retry (${reason})`);
        return;
      }
      // An explicitly selected source must not be killed by a short startup
      // timer. Signed playback URLs often reject browser probes (CORS) even
      // though mpv can read them, which previously produced a false
      // "No response" error. Keep mpv alive and let the longer startup ceiling
      // or a genuine mpv error own the visible failure state.
      if (!instantPlay && !inRoom) {
        console.warn(`[player] manual source failed (${reason})`);
        setSourceError((prev) => prev ?? { status: 0, host: hostOf(src.url) });
        return;
      }
      const currentAttempt = src.attempt ?? 0;
      if (currentAttempt >= MAX_AUTORETRY_ATTEMPTS) {
        console.warn(`[player] giving up after ${currentAttempt} attempts (${reason})`);
        if (!isP2pEngine && getPlaybackPosition() < 0.5) {
          setSourceError((prev) => prev ?? { status: 0, host: hostOf(src.url), exhausted: true });
        }
        return;
      }
      autoRetriedRef.current = true;
      const nextAttempt = currentAttempt + 1;
      console.warn(`[player] ${reason} — retrying with candidate #${nextAttempt}`);
      if (bridgeRef.current) {
        bridgeRef.current.destroy();
        bridgeRef.current = null;
      }
      if (nextAttempt >= 2) {
        clearOnePickerCache(src.meta, src.episode);
      }
      openPicker(
        src.meta,
        src.episode,
        instantPlay || inRoom ? { autoPlay: true, attempt: nextAttempt } : { autoPlay: false },
      );
    },
    [
      src.attempt,
      src.meta,
      src.episode,
      openPicker,
      instantPlay,
      isLocal,
      isLive,
      inRoom,
      isP2pEngine,
      src.url,
      src.subtitles,
      src.notWebReady,
      bridgeRef,
    ],
  );

  useEffect(() => {
    if (snap.errorCode == null) return;
    if (snap.status === "ended") return;
    if (isLive) {
      console.warn(`[player] live channel: ignoring "${snap.errorCode}", mpv handles reconnection`);
      return;
    }
    if (getPlaybackPosition() > 5) return;
    if (
      isP2pEngine &&
      !engineFailure &&
      Date.now() - urlAtRef.current < ENGINE_FIRST_FRAME_GRACE_MS
    )
      return;
    const failoverHash = src.streamRef?.infoHash;
    if (failoverHash && debrids.length > 0 && !debridFailoverTriedRef.current) {
      debridFailoverTriedRef.current = true;
      const cached = Object.fromEntries((src.streamRef?.cachedSlugs ?? []).map((s) => [s, true]));
      const ac = new AbortController();
      const hint = src.episode
        ? { season: src.episode.season ?? null, episode: src.episode.episode ?? null }
        : undefined;
      void resolveViaDebrids(
        failoverHash,
        src.streamRef?.fileIdx ?? undefined,
        cached,
        debrids,
        ac.signal,
        false,
        {},
        hint,
      ).then(async (r) => {
        const b = bridgeRef.current;
        if (r.ok && b) {
          let url = r.data.url;
          if (r.data.headers && Object.keys(r.data.headers).length > 0) {
            try {
              url = (await registerStreamProxy(r.data.url, r.data.headers)).url;
            } catch {
              /* fall back to the raw debrid url */
            }
          }
          console.warn(`[player] debrid failover via ${r.via}`);
          void b.load({
            url,
            subtitles: src.subtitles,
            notWebReady: r.data.notWebReady ?? src.notWebReady,
          });
        } else {
          triggerAutoRetry(`playback error "${snap.errorCode}"`);
        }
      });
      return;
    }
    if (!sameUrlRetriedRef.current) {
      sameUrlRetriedRef.current = true;
      const b = bridgeRef.current;
      if (b) {
        console.warn(`[player] error "${snap.errorCode}" before playback — reloading same URL`);
        void b.load({
          url: src.url,
          subtitles: src.subtitles,
          notWebReady: src.notWebReady,
          isLive,
          headers: src.headers,
        });
        return;
      }
    }
    if (
      !proxyRetriedRef.current &&
      !isLocal &&
      !isP2pEngine &&
      /^https?:\/\//i.test(src.url) &&
      !src.url.includes("127.0.0.1")
    ) {
      proxyRetriedRef.current = true;
      const b = bridgeRef.current;
      if (b) {
        console.warn(`[player] error "${snap.errorCode}" — retrying via local stream proxy`);
        void registerStreamProxy(src.url, src.headers)
          .then((p) => {
            const bb = bridgeRef.current;
            if (bb)
              void bb.load({ url: p.url, subtitles: src.subtitles, notWebReady: src.notWebReady });
          })
          .catch(() => triggerAutoRetry(`playback error "${snap.errorCode}"`));
        return;
      }
    }
    if (
      !transcodeRescueRef.current &&
      !isLocal &&
      !isP2pEngine &&
      /^https?:\/\//i.test(src.url) &&
      !src.url.includes("127.0.0.1")
    ) {
      transcodeRescueRef.current = true;
      const b = bridgeRef.current;
      if (b) {
        console.warn(`[player] error "${snap.errorCode}" — remuxing via ffmpeg`);
        void registerStreamProxy(src.url, src.headers, { transcode: true })
          .then((p) => {
            const bb = bridgeRef.current;
            if (bb) void bb.load({ url: p.url, subtitles: src.subtitles, notWebReady: true });
          })
          .catch(() => triggerAutoRetry(`playback error "${snap.errorCode}"`));
        return;
      }
    }
    if (
      stremioServerTranscode &&
      (!isP2pEngine || engineFailure) &&
      !transcodedTriedRef.current &&
      snap.errorCode === "decode" &&
      transcodedUrl == null
    ) {
      transcodedTriedRef.current = true;
      void probeStremioServer().then((ok) => {
        if (ok) {
          console.warn("[player] decode error — retrying via p2p transcoding");
          if (bridgeRef.current) {
            bridgeRef.current.destroy();
            bridgeRef.current = null;
          }
          setTranscodedUrl(buildTranscodedUrl(src.url));
        } else {
          triggerAutoRetry(`playback error "${snap.errorCode}"`);
        }
      });
      return;
    }
    triggerAutoRetry(`playback error "${snap.errorCode}"`);
  }, [
    snap.errorCode,
    snap.status,
    triggerAutoRetry,
    stremioServerTranscode,
    transcodedUrl,
    src.url,
    src.subtitles,
    src.notWebReady,
    bridgeRef,
    isP2pEngine,
    engineFailure,
  ]);

  // Distinguishes a genuine re-truncation after reload from the same EOF re-emitted:
  // any departure from "ended" (loading/playing) after the reload marks the next
  // ended as a real second death, even if it never managed to play.
  useEffect(() => {
    if (snap.status !== "ended") resumedAfterTruncatedRef.current = true;
  }, [snap.status]);

  // Premature EOF: reload the same URL once (sidecar re-registers a fresh session),
  // and only escalate to candidate retry if the reloaded stream also dies.
  useEffect(() => {
    if (snap.status !== "ended") return;
    if (isLocal) return;
    if (isLive) return;
    const pos = snap.positionSec > 0 ? snap.positionSec : getPlaybackPosition();
    if (!isTruncatedEnd(snap, pos)) return;
    const b = bridgeRef.current;
    if (!b) return;
    if (!truncatedReloadedRef.current) {
      truncatedReloadedRef.current = true;
      resumedAfterTruncatedRef.current = false;
      console.warn(
        `[player] stream ended prematurely at ${pos.toFixed(1)}s of ${snap.durationSec.toFixed(1)}s — reloading same URL for a fresh session`,
      );
      void b.load({
        url: src.url,
        subtitles: src.subtitles,
        notWebReady: src.notWebReady,
        isLive,
        headers: src.headers,
      });
      return;
    }
    if (!resumedAfterTruncatedRef.current) return;
    triggerAutoRetry("stream ended prematurely again after reload");
  }, [
    snap.status,
    snap.durationSec,
    snap.positionSec,
    triggerAutoRetry,
    isLocal,
    isLive,
    src.url,
    src.subtitles,
    src.notWebReady,
    src.headers,
    bridgeRef,
  ]);

  const lastPosRef = useRef({ pos: 0, at: 0, started: false, urlAt: 0 });
  useEffect(() => {
    lastPosRef.current = { pos: 0, at: 0, started: false, urlAt: Date.now() };
  }, [src.url]);
  useEffect(() => {
    if (snap.status !== "playing") {
      lastPosRef.current.at = Date.now();
      lastPosRef.current.pos = getPlaybackPosition();
      lastPosRef.current.started = false;
      return;
    }
    const id = window.setInterval(() => {
      const now = Date.now();
      const ref = lastPosRef.current;
      const pos = getPlaybackPosition();
      if (!ref.started) {
        ref.started = true;
        ref.at = now;
        ref.pos = pos;
        return;
      }
      if (pos > ref.pos + 0.3) {
        ref.pos = pos;
        ref.at = now;
        return;
      }
      if (ref.pos > 5) return;
      const neverStarted = ref.pos < 0.5;
      const graceMs = neverStarted ? 75_000 : 18_000;
      if (now - ref.urlAt < graceMs) return;
      if ((!isP2pEngine || engineFailure) && now - ref.at > graceMs && pos < 5) {
        triggerAutoRetry(
          neverStarted ? "source did not start after 75s" : "position frozen for 18s",
        );
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [snap.status, triggerAutoRetry, src.url, isP2pEngine, engineFailure]);

  const noVideoSinceRef = useRef<number | null>(null);
  const videoSeenRef = useRef(false);
  useEffect(() => {
    videoSeenRef.current = false;
    noVideoSinceRef.current = null;
  }, [src.url]);
  useEffect(() => {
    const hasVideo = snap.videoWidth > 0 && snap.videoHeight > 0;
    if (hasVideo) {
      videoSeenRef.current = true;
      noVideoSinceRef.current = null;
      return;
    }
    if (snap.status !== "playing") {
      noVideoSinceRef.current = null;
      return;
    }
    if (videoSeenRef.current) return;
    if (noVideoSinceRef.current == null) {
      noVideoSinceRef.current = Date.now();
      return;
    }
    const graceMs = isP2pEngine
      ? Math.max(BLACK_SCREEN_GRACE_MS, ENGINE_FIRST_FRAME_GRACE_MS)
      : BLACK_SCREEN_GRACE_MS;
    if (Date.now() - noVideoSinceRef.current > graceMs) {
      if (!isP2pEngine || engineFailure) {
        triggerAutoRetry("audio plays but no video frames (black screen)");
      }
    }
  }, [
    snap.status,
    snap.videoWidth,
    snap.videoHeight,
    triggerAutoRetry,
    src.url,
    isP2pEngine,
    engineFailure,
  ]);

  useEffect(() => {
    if (snap.status === "ended") return;
    if (isP2pEngine && !engineFailure) return;
    if (!instantPlay && !inRoom) return;
    if (snap.durationSec > 0 || getPlaybackPosition() > 1) return;
    const t = window.setTimeout(() => {
      if (snap.durationSec === 0 && getPlaybackPosition() === 0) {
        triggerAutoRetry("stuck on load");
      }
    }, STUCK_AUTORETRY_MS);
    return () => window.clearTimeout(t);
  }, [
    src.url,
    snap.durationSec,
    snap.status,
    triggerAutoRetry,
    isP2pEngine,
    engineFailure,
    instantPlay,
    inRoom,
  ]);

  useEffect(() => {
    if (isLive || isLocal || inRoom || isP2pEngine) return;
    const remaining = NEVER_STARTED_CEILING_MS - (Date.now() - urlAtRef.current);
    const t = window.setTimeout(
      () => {
        const s = snapRef.current;
        if (s.status === "playing" || s.status === "ended") return;
        if (s.durationSec > 0 || getPlaybackPosition() > 0) return;
        console.warn(`[player] source never started within ${NEVER_STARTED_CEILING_MS}ms`);
        setSourceError((prev) => prev ?? { status: 0, host: hostOf(src.url) });
      },
      Math.max(0, remaining),
    );
    return () => window.clearTimeout(t);
  }, [src.url, isLive, isLocal, inRoom, isP2pEngine]);

  useEffect(() => {
    if (startedPlaying) setSourceError(null);
  }, [startedPlaying]);

  useEffect(() => {
    if (!inRoom || isLocal || isLive) return;
    if (selfFrameReadyRef.current) return;
    if (snap.status === "ended") return;
    if (snap.videoWidth > 0 && snap.videoHeight > 0) return;
    const t = window.setTimeout(() => {
      if (!selfFrameReadyRef.current && (snap.videoWidth <= 0 || snap.videoHeight <= 0)) {
        if (!isP2pEngine || engineFailure) {
          triggerAutoRetry("room stream produced no video");
        }
      }
    }, ROOM_STALL_MS);
    return () => window.clearTimeout(t);
  }, [
    inRoom,
    isLocal,
    isLive,
    snap.status,
    snap.videoWidth,
    snap.videoHeight,
    triggerAutoRetry,
    src.url,
    selfFrameReadyRef,
    isP2pEngine,
    engineFailure,
  ]);

  useEffect(() => {
    if (!isP2pEngine || snap.status === "ended") return;
    const id = window.setInterval(() => {
      if (getPlaybackPosition() > 5) return;
      if ((src.attempt ?? 0) >= MAX_AUTORETRY_ATTEMPTS) return;
      const age = Date.now() - urlAtRef.current;
      if (engineFailure && !debridFailoverTriedRef.current && age >= ENGINE_FIRST_FRAME_GRACE_MS) {
        triggerAutoRetry("engine reports no peers and no download progress");
        return;
      }
      const st = engineStatsRef.current;
      const selectedFileComplete =
        !!st && st.streamLen != null && st.streamLen > 0 && st.streamProgress >= st.streamLen;
      if (
        selectedFileComplete &&
        !snapRef.current.firstFrameReady &&
        snapRef.current.videoWidth <= 0 &&
        getPlaybackPosition() < 0.5
      ) {
        const now = Date.now();
        if (!p2pCompleteReloadedRef.current && age >= ENGINE_COMPLETE_RELOAD_MS) {
          const bridge = bridgeRef.current;
          if (bridge) {
            p2pCompleteReloadedRef.current = true;
            p2pCompleteReloadedAtRef.current = now;
            console.warn("[player] completed P2P file produced no frame — reloading local stream");
            void bridge.load({
              url: src.url,
              subtitles: src.subtitles,
              notWebReady: src.notWebReady,
              headers: src.headers,
            });
            return;
          }
        }
        if (
          p2pCompleteReloadedAtRef.current > 0 &&
          now - p2pCompleteReloadedAtRef.current >= ENGINE_COMPLETE_FAILURE_MS
        ) {
          triggerAutoRetry("completed P2P file produced no video frame");
          return;
        }
      }
      if (st && st.downloaded > dlRef.current.bytes + 65536) {
        dlRef.current = { bytes: st.downloaded, at: Date.now() };
      }
      const progressing =
        !!st &&
        (st.downloadSpeed > 0 ||
          st.unchoked > 0 ||
          (dlRef.current.at > 0 && Date.now() - dlRef.current.at < GENUINE_FAILURE_WINDOW_MS));
      if (
        !progressing &&
        snapRef.current.status !== "paused" &&
        snapRef.current.videoWidth <= 0 &&
        getPlaybackPosition() < 0.5 &&
        age > ENGINE_HARD_CEILING_MS
      ) {
        triggerAutoRetry("engine produced no video within ceiling");
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [
    isP2pEngine,
    snap.status,
    engineFailure,
    triggerAutoRetry,
    bridgeRef,
    src.url,
    src.subtitles,
    src.notWebReady,
    src.headers,
  ]);

  return { slowLoad, transcodedUrl, sourceError, clearSourceError: () => setSourceError(null) };
}
