import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n";
import { acquireMusicMeter, type MusicAudioMeterState } from "@/lib/music/audio-meter";
import type { MusicTrack } from "@/lib/music/types";
import { DOCK_VISUALIZER_BARS, musicDockSpectrum } from "@/lib/music/dock-visualizer";
import "./music-dock-visualizer.css";

/** Acquires the native meter and streams it. The returned function releases both. */
export type MusicMeterStream = (listener: (state: MusicAudioMeterState) => void) => () => void;

/**
 * Deliberately not useMusicAudioMeter. That hook is useSyncExternalStore over a store that
 * publishes every 50ms, so it re-renders its owner at 20Hz, and the dock is mounted under
 * every page. That pressure has already starved LazyMount's transitions once and left music
 * rows blank. This subscribes once and writes custom properties through a ref, leaving the
 * interpolation to a CSS transition on the compositor. No setState, no rAF.
 */
export function MusicDockVisualizer({
  track,
  enabled,
  playing,
  stream = acquireMusicMeter,
}: {
  track: MusicTrack | null | undefined;
  enabled: boolean;
  playing: boolean;
  stream?: MusicMeterStream;
}) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const bars = useRef<HTMLSpanElement[]>([]);

  const trackId = track?.id ?? null;
  const connectorId = track?.connectorId ?? null;
  // Videos play through HTML5 on a cross-origin stream; the native tap never sees that audio.
  const live = enabled && !!trackId && connectorId !== "spotify" && track?.mediaKind !== "video";

  useEffect(() => {
    let levels = musicDockSpectrum(undefined, false);

    const paint = () => {
      const host = root.current;
      if (!host) return;
      for (let i = 0; i < bars.current.length; i += 1) {
        const bar = bars.current[i];
        if (!bar) continue;
        const previous = Number(bar.style.getPropertyValue("--v")) || 0;
        bar.style.setProperty("--response", levels[i] > previous ? "45ms" : "180ms");
        bar.style.setProperty("--v", levels[i].toFixed(3));
      }
      host.dataset.resting = levels.every((value) => value === 0) ? "true" : "false";
    };

    const take = (state: MusicAudioMeterState) => {
      const data = state.data;
      // A snapshot from the outgoing track would paint its levels across the switch.
      const mine = !!data && data.trackId === trackId && (data.connectorId ?? null) === connectorId;
      levels = musicDockSpectrum(data?.spectrumDb, mine && data.active && state.status === "ready");
      paint();
    };

    let release: (() => void) | undefined;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Hidden, paused, and compact docks must not hold native analysis open.
    const visibility = () => {
      if (!live || !playing || document.hidden || motion.matches || !root.current?.offsetWidth) {
        release?.();
        release = undefined;
        levels = musicDockSpectrum(undefined, false);
        paint();
      } else if (!release) {
        release = stream(take);
      }
    };

    paint();
    visibility();
    const size = new ResizeObserver(visibility);
    if (root.current) size.observe(root.current);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", visibility);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", visibility);
      size.disconnect();
      release?.();
      levels = musicDockSpectrum(undefined, false);
      paint();
    };
  }, [live, playing, trackId, connectorId, stream]);

  if (!live) return null;

  return (
    <div
      ref={root}
      className="music-dock-viz"
      data-resting="true"
      role="img"
      aria-label={t("music.quality.levels")}
      title={t("music.quality.levels")}
    >
      <span className="music-dock-viz-strip" aria-hidden="true">
        {Array.from({ length: DOCK_VISUALIZER_BARS }, (_, index) => (
          <span
            key={index}
            ref={(node) => {
              if (node) bars.current[index] = node;
            }}
            className="music-dock-viz-bar"
          />
        ))}
      </span>
    </div>
  );
}
