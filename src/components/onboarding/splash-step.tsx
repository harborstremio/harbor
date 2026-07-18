import { useEffect, useMemo, useRef, useState } from "react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { Poster } from "@/components/poster";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";

const SPLASH_DURATION_MS = 2600;

export function SplashStep({ onAdvance }: { onAdvance: () => void }) {
  const t = useT();
  const [posters, setPosters] = useState<string[]>([]);
  const [out, setOut] = useState(false);
  const advanced = useRef(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([topMovies(), topSeries()])
      .then(([m, s]) => {
        if (cancelled) return;
        const all: Meta[] = [...m, ...s];
        const urls = all.map((x) => x.poster).filter((p): p is string => !!p);
        for (let i = urls.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [urls[i], urls[j]] = [urls[j], urls[i]];
        }
        setPosters(urls.slice(0, 60));
      })
      .catch(() => {});

    const fadeAt = window.setTimeout(() => setOut(true), SPLASH_DURATION_MS - 380);
    const advanceAt = window.setTimeout(() => {
      if (advanced.current) return;
      advanced.current = true;
      onAdvance();
    }, SPLASH_DURATION_MS);

    return () => {
      cancelled = true;
      clearTimeout(fadeAt);
      clearTimeout(advanceAt);
    };
  }, [onAdvance]);

  return (
    <div
      className={`relative h-[528px] w-full overflow-hidden bg-canvas ${out ? "animate-splash-out" : ""}`}
    >
      <div className="absolute inset-0 flex gap-2 px-2">
        {[0, 1, 2, 3, 4].map((col) => (
          <PosterColumn key={col} idx={col} posters={posters} />
        ))}
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0.96) 100%)",
        }}
      />
      <div className="relative flex h-full flex-col items-center justify-center gap-3 text-center">
        <h1 className="animate-splash-title flex items-center gap-3 font-display text-[88px] font-medium leading-none tracking-tight text-ink">
          <HarborMark className="h-[1em] w-[1em] shrink-0" />
          <span style={{ transform: "translateY(0.04em)" }}>
            Harb
            <span
              className="inline-block"
              style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
            >
              o
            </span>
            r
          </span>
        </h1>
        <p
          className="animate-splash-title text-[14px] uppercase tracking-[0.42em] text-ink-muted"
          style={{ animationDelay: "260ms" }}
        >
          {t("For watching things")}
        </p>
      </div>
    </div>
  );
}

const COLUMN_SPEEDS = [22, 32, 26, 38, 30];
const COLUMN_DELAYS = [-5, -14, -3, -19, -9];
const COLUMN_DIRS = ["up", "down", "up", "down", "up"] as const;

function PosterColumn({ idx, posters }: { idx: number; posters: string[] }) {
  const slice = useMemo(() => {
    const out: (string | null)[] = [];
    for (let i = 0; i < 8; i++) {
      const k = (idx * 8 + i) % Math.max(posters.length, 1);
      out.push(posters[k] ?? null);
    }
    return out;
  }, [idx, posters]);

  return (
    <div className="flex-1 overflow-hidden opacity-55">
      <div
        className="flex flex-col gap-3 will-change-transform"
        style={{
          animation: `splash-scroll-${COLUMN_DIRS[idx]} ${COLUMN_SPEEDS[idx]}s linear infinite`,
          animationDelay: `${COLUMN_DELAYS[idx]}s`,
        }}
      >
        {[...slice, ...slice].map((url, i) => (
          <Poster key={i} src={url ?? undefined} seed={`splash-${idx}-${i}`} className="w-full" />
        ))}
      </div>
    </div>
  );
}
