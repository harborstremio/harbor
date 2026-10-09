import { useEffect, useRef } from "react";
import { acquireMusicMeter } from "@/lib/music/audio-meter";
import { createMikuGroove } from "@/lib/music/miku-motion";
import { createGifClock, type GifTiming } from "@/lib/music/gif-clock";
import { musicGifFrameAt, type MusicGifFrames } from "@/lib/music/gif-frames";
import { useMusicGif } from "@/lib/music/gif-asset";
import { useMusicAppearance } from "@/lib/music/appearance";
import type { MusicTrack } from "@/lib/music/types";
import "./music-gif-visualizer.css";

export function MusicGifCanvas({ animation, playing = true, track, timing = "auto" }: {
  animation: MusicGifFrames; playing?: boolean; track?: MusicTrack; timing?: GifTiming;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const playback = useRef({ playing, track, timing }); playback.current = { playing, track, timing };
  const refresh = useRef<(() => void) | null>(null);
  useEffect(() => { refresh.current?.(); }, [playing, track?.id, track?.connectorId]);
  useEffect(() => {
    const surface = canvas.current, context = surface?.getContext("2d");
    if (!surface || !context) return;
    surface.width = animation.width; surface.height = animation.height;
    const frames = animation.frames.map(data => new ImageData(new Uint8ClampedArray(data), animation.width, animation.height));
    const clock = createGifClock(animation.duration), groove = createMikuGroove();
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0, last = 0, shown = -1, trackKey = "", inView = true, release: (() => void) | null = null;
    const paint = (index: number) => {
      if (index === shown) return;
      context.putImageData(frames[index], 0, 0); shown = index; surface.dataset.frame = String(index);
    };
    const tick = (now: number) => {
      const elapsed = last ? now - last : 16, dt = Math.min(250, elapsed); last = now;
      const pulse = groove.advance(elapsed, playback.current.playing, now);
      paint(musicGifFrameAt(animation, clock.advance(dt, true, pulse, playback.current.timing)));
      raf = requestAnimationFrame(tick);
    };
    const reconcile = () => {
      const { track, playing } = playback.current;
      const key = track ? JSON.stringify([track.connectorId, track.id]) : "";
      if (key !== trackKey) { trackKey = key; groove.reset(); clock.retime(); }
      const animate = playing && inView && !document.hidden && !motion.matches && !!surface.offsetWidth;
      const analyze = animate && track && track.connectorId !== "spotify" && track.mediaKind !== "video";
      if (!analyze) { release?.(); release = null; }
      else if (!release) release = acquireMusicMeter(state => {
        const current = playback.current.track;
        if (current) groove.sample(state, current.id, current.connectorId ?? null, performance.now());
      });
      if (animate && !raf) { last = 0; raf = requestAnimationFrame(tick); }
      if (!animate) { cancelAnimationFrame(raf); raf = 0; }
    };
    paint(0); reconcile(); refresh.current = reconcile;
    const resize = new ResizeObserver(reconcile); resize.observe(surface);
    const intersection = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; reconcile(); });
    intersection.observe(surface);
    document.addEventListener("visibilitychange", reconcile); motion.addEventListener("change", reconcile);
    return () => { release?.(); cancelAnimationFrame(raf); resize.disconnect(); intersection.disconnect(); refresh.current = null;
      document.removeEventListener("visibilitychange", reconcile); motion.removeEventListener("change", reconcile); };
  }, [animation]);
  return <canvas ref={canvas} className="music-gif-canvas" aria-hidden="true" />;
}

export function MusicGifVisualizer({ track, playing }: { track: MusicTrack; playing: boolean }) {
  const appearance = useMusicAppearance(), asset = useMusicGif(appearance.gifId);
  if (!asset?.frames) return null;
  return <div className="music-gif-perch" style={{ height: appearance.gifSize, width: Math.min(288, appearance.gifSize * asset.frames.width / asset.frames.height) }} aria-hidden="true">
    <MusicGifCanvas animation={asset.frames} track={track} playing={playing} timing={appearance.gifTiming} />
  </div>;
}
