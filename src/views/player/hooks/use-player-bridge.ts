import { useEffect, useRef, useState, type RefObject } from "react";
import { emptySnapshot, type PlayerBridge, type PlayerSnapshot } from "@/lib/player/bridge";
import { probeMpv } from "@/lib/player/mpv";
import { mergeMpvOptions } from "@/lib/player/mpv-tuning";
import { anime4kShadersFor, type Anime4kChoice } from "./use-anime4k";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { setPlaybackClock } from "@/lib/player/playback-clock";
import { isWindowsDesktop } from "@/lib/platform";
import { svpEnsureRunning } from "@/lib/svp";
import { isAnimeMedia, isSvpActiveForMedia } from "@/lib/player/svp-policy";
import { pickBridge } from "../player-utils";

function snapChangedIgnoringClock(a: PlayerSnapshot, b: PlayerSnapshot): boolean {
  return (
    a.status !== b.status ||
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
    a.audioNormalize !== b.audioNormalize ||
    a.videoWidth !== b.videoWidth ||
    a.videoHeight !== b.videoHeight ||
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

  const [snap, setSnap] = useState<PlayerSnapshot>(emptySnapshot);
  const prevSnapRef = useRef<PlayerSnapshot>(emptySnapshot);
  const [engine, setEngine] = useState<"html5" | "mpv">("html5");
  const [autoFallbackTried, setAutoFallbackTried] = useState(false);

  const hdrOpaqueWindow = isWindowsDesktop() && settings.playerHdrOpaqueWindow;
  const embedActive = settings.playerMpvEmbed && !hdrOpaqueWindow;
  const isAnimeSrc = isAnimeMedia(src.meta);
  const anime4kOn = settings.playerAnime4k && (!settings.playerAnime4kAnimeOnly || isAnimeSrc);
  const svpOn = isSvpActiveForMedia(settings, src.meta);
  useEffect(() => {
    if (svpOn) void svpEnsureRunning().catch(() => {});
  }, [svpOn]);
  const isLiveLike =
    !!src.meta.id?.startsWith("iptv:") ||
    (!!src.meta.type &&
      !["movie", "series", "anime"].includes(String(src.meta.type).toLowerCase()));
  const chosenEngine =
    isLiveLike && !src.notWebReady ? "html5" : autoFallbackTried ? "mpv" : settings.playerEngine;
  const bridgeKey = `${chosenEngine}|${anime4kOn}|${embedActive}|${anime4kOn ? settings.playerAnime4kShaders.join(",") : ""}|${svpOn}|${svpOn ? settings.svpVpyPath : ""}`;
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    const host = videoMountRef.current;
    if (!host) return;
    let cancelled = false;
    let off: (() => void) | null = null;
    let bridge: PlayerBridge | null = null;
    setBridgeReady(false);
    (async () => {
      const want = chosenEngine;
      const getEmbedRect = async () => {
        const el = videoMountRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          cssLeft: r.left,
          cssTop: r.top,
          cssWidth: r.width,
          cssHeight: r.height,
          cssViewW: document.documentElement.clientWidth,
          cssViewH: document.documentElement.clientHeight,
        };
      };
      const { bridge: choose, engine: chosen } = await pickBridge(want, src.notWebReady === true, {
        anime4k: anime4kOn,
        hdrToSdr: settings.playerHdrToSdr,
        rtxHdr: settings.playerRtxHdr && !settings.playerHdrToSdr && !svpOn,
        embed: embedActive,
        d3d11Flip: settings.playerD3d11Flip,
        anime4kShaders: anime4kShadersFor(
          settings,
          src,
          (settings.playerAnime4kOverride as Anime4kChoice) || "auto",
        ),
        macEdr: false,
        extraOptions: mergeMpvOptions(settings, svpOn),
        getEmbedRect,
      });
      if (cancelled) {
        choose.destroy();
        return;
      }
      bridge = choose;
      bridge.attach(host);
      bridgeRef.current = bridge;
      setEngine(chosen);
      off = bridge.subscribe((s) => {
        setPlaybackClock(s.positionSec, s.bufferedSec);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridgeKey]);

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
