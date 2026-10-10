import { useEffect, useState } from "react";
import { posterPlate } from "@/components/poster";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const BOTTOM_SCRIM =
  "linear-gradient(to top, var(--color-canvas) 0%, color-mix(in srgb, var(--color-canvas) 88%, transparent) 14%, color-mix(in srgb, var(--color-canvas) 62%, transparent) 30%, color-mix(in srgb, var(--color-canvas) 32%, transparent) 46%, transparent 64%)";
const SIDE_SCRIM =
  "linear-gradient(100deg, var(--color-canvas) 0%, color-mix(in srgb, var(--color-canvas) 58%, transparent) 34%, transparent 60%)";

export function PeopleHeroBackdrop({
  stills,
  fallback,
  seed,
}: {
  stills: string[];
  fallback?: string;
  seed: string;
}) {
  const reduce = useReducedMotion();
  const frames = stills.length
    ? stills.map((s) => `https://image.tmdb.org/t/p/w1280${s}`)
    : fallback
      ? [fallback]
      : [];
  const usingStills = stills.length > 0;
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (reduce || frames.length < 2) return;
    const id = window.setInterval(() => setIdx((i) => (i + 1) % frames.length), 7000);
    return () => window.clearInterval(id);
  }, [reduce, frames.length]);

  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      {frames.length > 0 ? (
        frames.map((f, i) => (
          <div
            key={f}
            className="absolute inset-0 scale-105 bg-cover bg-center transition-opacity duration-[1800ms] ease-out motion-reduce:transition-none"
            style={{
              backgroundImage: `url(${f})`,
              opacity: i === idx ? (usingStills ? 0.52 : 0.42) : 0,
              filter: usingStills ? "saturate(1.08)" : "blur(64px) saturate(1.25)",
            }}
          />
        ))
      ) : (
        <div className="absolute inset-0" style={{ background: posterPlate(seed), opacity: 0.5 }} />
      )}
      <div className="absolute inset-0" style={{ background: BOTTOM_SCRIM }} />
      <div className="absolute inset-0" style={{ background: SIDE_SCRIM }} />
    </div>
  );
}
