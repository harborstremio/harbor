import { useEffect, useRef, useState, type RefObject } from "react";
import { emptySnapshot, type PlayerBridge, type PlayerSnapshot } from "@/lib/player/bridge";
import { probeMpv } from "@/lib/player/mpv";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { setPlaybackClock } from "@/lib/player/playback-clock";
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

  const bridgeKey = `${autoFallbackTried ? "mpv" : settings.playerEngine}|${settings.playerAnime4k}|${settings.playerHdrToSdr}|${settings.playerAnime4kShaders.join(",")}`;
  const [bridgeReady, setBridgeReady] = useState(false);
  useEffect(() => {
    const host = videoMountRef.current;
    if (!host) return;
    let cancelled = false;
    let off: (() => void) | null = null;
    let bridge: PlayerBridge | null = null;
    setBridgeReady(false);
    (async () => {
      const want = autoFallbackTried ? "mpv" : settings.playerEngine;
      const getEmbedRect = async () => {
        const el = videoMountRef.current;
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        const left = Math.floor(r.left * dpr);
        const top = Math.floor(r.top * dpr);
        const right = Math.ceil((r.left + r.width) * dpr);
        const bottom = Math.ceil((r.top + r.height) * dpr);
        return {
          screenX: left,
          screenY: top,
          w: Math.max(1, right - left),
          h: Math.max(1, bottom - top),
        };
      };
      const { bridge: choose, engine: chosen } = await pickBridge(want, src.notWebReady === true, {
        anime4k: settings.playerAnime4k,
        hdrToSdr: settings.playerHdrToSdr,
        embed: settings.playerMpvEmbed,
        d3d11Flip: settings.playerD3d11Flip,
        anime4kShaders: settings.playerAnime4k && settings.playerAnime4kShaders.length > 0
          ? settings.playerAnime4kShaders
          : [],
        getEmbedRect,
        preferredLangs: settings.subtitlesOffByDefault ? [] : (settings.preferredSubLangs ?? []),
      });
      if (cancelled) return;
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
    if (snap.errorCode !== "decode" && snap.errorCode !== "codec") return;
    (async () => {
      const probe = await probeMpv();
      if (probe.available) setAutoFallbackTried(true);
    })();
  }, [engine, autoFallbackTried, snap.errorCode, settings.playerEngine]);

  return { snap, engine, bridgeReady, bridgeKey };
}