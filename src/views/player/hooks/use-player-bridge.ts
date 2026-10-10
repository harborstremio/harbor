import { useEffect, useRef, useState, type RefObject } from "react";
import {
  emptySnapshot,
  initialPlayerSnapshot,
  type PlayerBridge,
  type PlayerSnapshot,
} from "@/lib/player/bridge";
import { probeMpv } from "@/lib/player/mpv";
import { mergeMpvOptions } from "@/lib/player/mpv-tuning";
import { anime4kPackComplete, repairAnime4kPack } from "@/lib/anime4k";
import { metaIsAnime } from "@/lib/player/anime-src";
import { fullShaderChain, type Anime4kChoice } from "./use-anime4k";
import { generalShaderKey, shaderCompanionOptions } from "@/lib/player/shader-chain";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { setPlaybackClock, setPlaybackStatus } from "@/lib/player/playback-clock";
import { isLinuxDesktop, isMacDesktop, isWindowsDesktop } from "@/lib/platform";
import { isLivePlaybackSrc } from "@/lib/player/live-src";
import { readEmbedRect } from "@/lib/player/embed-rect";
import { svpEnsureRunning, svpStatus } from "@/lib/svp";
import { isSvpActiveForMedia } from "@/lib/player/svp-policy";
import { pickBridge } from "../player-utils";

function snapChangedIgnoringClock(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return (
    a.status !== b.status ||
    a.buffering !== b.buffering ||
    a.firstFrameReady !== b.firstFrameReady ||
    a.durationSec !== b.durationSec ||
    a.volume !== b.volume ||
    a.muted !== b.muted ||
    a.rate !== b.rate ||
    a.audioTracks !== b.audioTracks ||
    a.subtitleTracks !== b.subtitleTracks ||
    a.chapters !== b.chapters ||
    a.subDelaySec !== b.subDelaySec ||
    a.audioDelaySec !== b.audioDelaySec ||
    a.subText !== b.subText ||
    a.subStartSec !== b.subStartSec ||
    a.secondarySubText !== b.secondarySubText ||
    a.noAudio !== b.noAudio ||
    a.audioNormalize !== b.audioNormalize ||
    a.videoWidth !== b.videoWidth ||
    a.videoHeight !== b.videoHeight ||
    a.videoSourceWidth !== b.videoSourceWidth ||
    a.videoSourceHeight !== b.videoSourceHeight ||
    a.hdrGamma !== b.hdrGamma ||
    a.errorMessage !== b.errorMessage ||
    a.errorCode !== b.errorCode
  );
}

export function usePlayerBridge(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  videoMountRef: RefObject<HTMLDivElement | null>;
  src: PlayerSrc;
  settings: Settings;
}) {
  const { bridgeRef, videoMountRef, src, settings } = params;

  const [snap, setSnap] = useState<PlayerSnapshot>(initialPlayerSnapshot);
  const prevSnapRef = useRef<PlayerSnapshot>(emptySnapshot);
  const [engine, setEngine] = useState<"html5" | "mpv">("html5");
  const [autoFallbackTried, setAutoFallbackTried] = useState(false);

  const hdrOpaqueWindow = isWindowsDesktop() && settings.playerHdrOpaqueWindow;
  const embedActive = settings.playerMpvEmbed && !hdrOpaqueWindow;
  const isAnimeSrc = metaIsAnime(src.meta) || !!src.isAnime;
  const anime4kWanted = settings.playerAnime4k && (!settings.playerAnime4kAnimeOnly || isAnimeSrc);
  // mpv only compiles a shader chain whose files it can open, and it drops the
  // rest without a word. Presets that name a kernel the installed pack predates
  // would silently run short, so the gap is filled before the chain is built
  // rather than only when the settings panel happens to be open.
  const [anime4kPack, setAnime4kPack] = useState<boolean | null>(
    anime4kWanted && settings.playerAnime4kFolder ? null : true,
  );
  useEffect(() => {
    if (anime4kPack !== null) return;
    let active = true;
    anime4kPackComplete()
      .then((complete) => {
        if (!active) return;
        if (complete) {
          setAnime4kPack(true);
          return;
        }
        setAnime4kPack(false);
        void repairAnime4kPack().then(() => {
          if (active) setAnime4kPack(true);
        });
      })
      .catch(() => {
        if (active) setAnime4kPack(true);
      });
    return () => {
      active = false;
    };
  }, [anime4kPack]);
  const anime4kOn = anime4kWanted && anime4kPack === true;
  const anime4kPending = anime4kPack === null;
  const svpRequested = isSvpActiveForMedia(settings, src.meta);
  const [svpRuntimeReady, setSvpRuntimeReady] = useState<boolean | null>(
    isLinuxDesktop() && svpRequested ? null : true,
  );
  useEffect(() => {
    if (!svpRequested || !isLinuxDesktop()) {
      setSvpRuntimeReady(true);
      return;
    }
    let active = true;
    setSvpRuntimeReady(null);
    void svpStatus()
      .then((status) => {
        if (active)
          setSvpRuntimeReady(status.supported && status.ready && status.loadable !== false);
      })
      .catch(() => {
        if (active) setSvpRuntimeReady(false);
      });
    return () => {
      active = false;
    };
  }, [svpRequested, settings.svpVpyPath]);
  const svpPending = svpRequested && svpRuntimeReady === null;
  const svpOn = svpRequested && svpRuntimeReady === true;
  useEffect(() => {
    if (svpOn) void svpEnsureRunning().catch(() => {});
  }, [svpOn]);
  const isLiveLike = isLivePlaybackSrc(src);
  const chosenEngine =
    isLiveLike && !src.notWebReady ? "html5" : autoFallbackTried ? "mpv" : settings.playerEngine;
  const bridgeKey = `${chosenEngine}|${anime4kOn}|${embedActive}|${anime4kOn ? settings.playerAnime4kShaders.join(",") : ""}|${generalShaderKey(settings)}|${svpOn}|${svpOn ? settings.svpVpyPath : ""}`;
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    if (svpPending || anime4kPending) return;
    const host = videoMountRef.current;
    if (!host) return;
    let cancelled = false;
    let off: (() => void) | null = null;
    let bridge: PlayerBridge | null = null;
    setBridgeReady(false);
    (async () => {
      const want = chosenEngine;
      const getEmbedRect = () => readEmbedRect(videoMountRef.current);
      const { bridge: choose, engine: chosen } = await pickBridge(want, src.notWebReady === true, {
        anime4k: anime4kOn,
        hdrToSdr: settings.playerHdrToSdr,
        rtxHdr: settings.playerRtxHdr && !settings.playerHdrToSdr && !svpOn,
        rtxVsr: settings.playerRtxVsr && !svpOn,
        embed: embedActive,
        d3d11Flip: settings.playerD3d11Flip,
        renderer: settings.mpvRenderer,
        forceYuv420p: settings.mpvForceYuv420p,
        anime4kShaders: fullShaderChain(
          settings,
          src,
          (settings.playerAnime4kOverride as Anime4kChoice) || "auto",
        ),
        macEdr:
          isMacDesktop() && embedActive && settings.playerMacEdr && !settings.playerHdrToSdr,
        fullDownload: settings.torrentFullDownload,
        separateDisplay:
          settings.playerSeparateDisplay.mode === "explicit"
            ? settings.playerSeparateDisplay.monitor
            : null,
        separateCoverTaskbar: settings.playerSeparateCoverTaskbar,
        cacheDir: settings.playbackCacheDir,
        extraOptions: [mergeMpvOptions(settings, svpOn, { anime4k: anime4kOn }), shaderCompanionOptions(settings)]
          .filter(Boolean)
          .join("\n"),
        getEmbedRect,
      });
      if (cancelled) return;
      bridge = choose;
      bridge.attach(host);
      bridgeRef.current = bridge;
      setEngine(chosen);
      off = bridge.subscribe((s) => {
        setPlaybackClock(s.positionSec, s.bufferedSec);
        setPlaybackStatus(s.status);
        if (snapChangedIgnoringClock(prevSnapRef.current, s)) {
          prevSnapRef.current = s;
          setSnap(s);
        }
      });
      setBridgeReady(true);
    })();
    return () => {
      cancelled = true;
      setBridgeReady(false);
      off?.();
      bridge?.destroy();
      bridgeRef.current = null;
      setPlaybackClock(0, 0);
      setPlaybackStatus("idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeKey, svpPending, anime4kPending]);

  useEffect(() => {
    if (engine !== "html5") return;
    if (autoFallbackTried) return;
    if (settings.playerEngine !== "auto") return;
    if (snap.errorCode !== "decode" && snap.errorCode !== "codec" && !snap.noAudio) return;
    (async () => {
      const probe = await probeMpv();
      if (probe.available) setAutoFallbackTried(true);
    })();
  }, [engine, autoFallbackTried, snap.errorCode, snap.noAudio, settings.playerEngine]);

  useEffect(() => {
    if (!bridgeReady || engine !== "mpv") return;
    bridgeRef.current?.setHdrToSdr?.(
      settings.playerHdrToSdr,
      settings.playerDisplayPanel === "oled",
    );
  }, [bridgeReady, engine, settings.playerHdrToSdr, settings.playerDisplayPanel, bridgeRef]);

  return { snap, engine, bridgeReady, bridgeKey, embedActive, svpActive: svpOn };
}
