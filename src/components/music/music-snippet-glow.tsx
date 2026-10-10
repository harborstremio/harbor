import { useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { useMusicArtworkPalette } from "@/lib/music/appearance";
import type { SnippetEnergy } from "@/lib/music/snippet-energy";

export function MusicSnippetGlow({ artwork, audio, energy, frame: cover, host }: {
  artwork: string;
  audio: RefObject<HTMLAudioElement | null>;
  energy: Promise<SnippetEnergy | null> | undefined;
  frame: RefObject<HTMLDivElement | null>;
  host: RefObject<HTMLDivElement | null>;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const palette = useMusicArtworkPalette(artwork, true);
  useEffect(() => {
    let alive = true, frame = 0, previous = 0, level = 0, bass = 0;
    let measured: SnippetEnergy | null = null;
    void energy?.then(value => { if (alive) measured = value; });
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const paint = (now: number) => {
      frame = requestAnimationFrame(paint);
      if (now - previous < 30) return;
      const dt = Math.min(100, now - previous); previous = now;
      const art = cover.current, parent = host.current, glow = element.current;
      if (art && parent && glow) {
        const rect = art.getBoundingClientRect(), bounds = parent.getBoundingClientRect();
        const scale = bounds.width / parent.offsetWidth || 1;
        Object.assign(glow.style, { left: `${(rect.left - bounds.left) / scale}px`, top: `${(rect.top - bounds.top) / scale}px`, width: `${rect.width / scale}px`, height: `${rect.height / scale}px` });
      }
      const player = audio.current;
      const sounding = player && !player.paused && !player.muted && player.volume > 0 && !document.hidden;
      const position = player && measured ? Math.floor(player.currentTime * measured.rate) : -1;
      const gain = sounding ? Math.sqrt(player.volume) : 0;
      const target = gain * (measured?.level[position] ?? 0), bottom = gain * (measured?.bass[position] ?? 0);
      // Quick attack, slower decay: preserve transients without a flickering outline.
      level += (target - level) * (1 - Math.exp(-dt / (target > level ? 55 : 240)));
      bass += (bottom - bass) * (1 - Math.exp(-dt / (bottom > bass ? 70 : 300)));
      element.current?.style.setProperty("--snippet-energy", (reduced.matches ? 0 : level).toFixed(3));
      element.current?.style.setProperty("--snippet-bass", (reduced.matches ? 0 : bass).toFixed(3));
    };
    frame = requestAnimationFrame(paint);
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [audio, energy, cover, host]);

  // The shared sampler orders real artwork colors from dark to bright.
  return <span ref={element} className="music-snippet-glow" aria-hidden="true" style={{
    "--snippet-color": palette.at(-1) ?? "transparent",
    "--snippet-color-secondary": palette.at(-2) ?? palette.at(-1) ?? "transparent",
  } as CSSProperties} />;
}
