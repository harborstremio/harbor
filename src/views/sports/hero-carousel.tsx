import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { useMediaQuery } from "@/lib/use-media-query";
import { useInViewport, usePageVisible } from "@/lib/visibility";
import type { SportsGame } from "@/lib/sports/espn";
import { HeroSlide } from "./hero-slide";
import "./hero-carousel.css";

const MAX_SLIDES = 8;
const DWELL_MS = 9000;

type Nav = { seq: number; dir: 1 | -1; from: string | null };

const pad = (n: number) => String(n).padStart(2, "0");

export function SportsHeroCarousel({
  games,
  pending = false,
  onOpen,
  onWatch,
  className = "",
}: {
  games: SportsGame[];
  pending?: boolean;
  onOpen: (game: SportsGame) => void;
  onWatch?: (game: SportsGame) => void;
  className?: string;
}) {
  const t = useT();
  const lang = useUiLanguage();
  const rtl = isRtl(lang);
  const rootRef = useRef<HTMLElement>(null);
  const inView = useInViewport(rootRef, true);
  const pageVisible = usePageVisible();
  const reduce = useMediaQuery("(prefers-reduced-motion: reduce)");

  const slides = useMemo(() => games.slice(0, MAX_SLIDES), [games]);
  const [idx, setIdx] = useState(0);
  const [nav, setNav] = useState<Nav>({ seq: 0, dir: 1, from: null });
  const idxRef = useRef(0);
  const activeIdRef = useRef<string | null>(null);

  const go = useCallback(
    (delta: 1 | -1) => {
      const n = slides.length;
      if (n < 2) return;
      const cur = idxRef.current;
      const next = (((cur + delta) % n) + n) % n;
      idxRef.current = next;
      setNav((p) => ({ seq: p.seq + 1, dir: delta, from: slides[cur]?.id ?? null }));
      setIdx(next);
    },
    [slides],
  );

  const lastAutoRef = useRef(0);
  const onDwellEnd = useCallback(() => {
    const stamp = Date.now();
    if (stamp - lastAutoRef.current < DWELL_MS / 2) return;
    lastAutoRef.current = stamp;
    go(1);
  }, [go]);

  useEffect(() => {
    const want = activeIdRef.current;
    const found = want ? slides.findIndex((g) => g.id === want) : -1;
    const target = found >= 0 ? found : 0;
    if (target === idxRef.current) return;
    idxRef.current = target;
    setNav((p) => ({ seq: p.seq + 1, dir: 1, from: null }));
    setIdx(target);
  }, [slides]);

  const safeIdx = Math.min(idx, Math.max(0, slides.length - 1));
  const active = slides[safeIdx];
  const activeId = active?.id;

  useEffect(() => {
    if (activeId) activeIdRef.current = activeId;
  }, [activeId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (slides.length < 2) return;
    e.preventDefault();
    const forward = rtl ? e.key === "ArrowLeft" : e.key === "ArrowRight";
    go(forward ? 1 : -1);
  };

  if (!active) {
    if (!pending) return null;
    return (
      <section aria-hidden className={`sports-hero bg-canvas ${className}`}>
        <div className="sports-hero-stage animate-pulse bg-elevated/40 motion-reduce:animate-none" />
      </section>
    );
  }

  const seq = nav.seq;
  const exiting = nav.from ? slides.find((g) => g.id === nav.from) ?? null : null;
  const live = active.state === "in";
  const clockPaused = !pageVisible || !inView;
  const ticking = !clockPaused;
  const autoAdvance = slides.length > 1 && !reduce;
  const Back = rtl ? ChevronRight : ChevronLeft;
  const Forward = rtl ? ChevronLeft : ChevronRight;
  const stepper =
    "flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink";

  return (
    <section
      ref={rootRef}
      role="region"
      aria-roledescription={t("Carousel")}
      aria-label={t("Featured matches")}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`sports-hero bg-canvas ${className}`}
    >
      <div className="sports-hero-stage">
        <div className="sports-hero-panel bg-surface" />

        {exiting && (
          <div
            key={`exit-${seq}`}
            aria-hidden
            className={`sports-hero-slide sports-hero-slide-out ${
              nav.dir === 1 ? "sports-hero-slide-out-next" : "sports-hero-slide-out-prev"
            }`}
            onAnimationEnd={(e) => {
              if (e.target !== e.currentTarget) return;
              setNav((p) => (p.seq === seq ? { ...p, from: null } : p));
            }}
          >
            <HeroSlide game={exiting} lang={lang} ticking={false} onOpen={onOpen} onWatch={onWatch} />
          </div>
        )}

        <div
          key={`in-${seq}`}
          className={`sports-hero-slide ${
            nav.dir === 1 ? "sports-hero-slide-in-next" : "sports-hero-slide-in-prev"
          }`}
        >
          <HeroSlide game={active} lang={lang} ticking={ticking} onOpen={onOpen} onWatch={onWatch} />
        </div>

        {slides.length > 1 && (
          <div className="absolute bottom-3 end-4 z-[3] flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label={t("Previous match")}
              className={stepper}
            >
              <Back size={15} />
            </button>
            <span className="px-1 text-[11px] font-semibold tabular-nums text-ink-subtle">
              {pad(safeIdx + 1)} / {pad(slides.length)}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label={t("Next match")}
              className={stepper}
            >
              <Forward size={15} />
            </button>
          </div>
        )}

        {autoAdvance && (
          <div className="absolute inset-x-0 bottom-0 z-[3] h-0.5 bg-ink/25">
            <div
              key={seq}
              onAnimationEnd={onDwellEnd}
              style={{
                animationDuration: `${DWELL_MS}ms`,
                animationPlayState: clockPaused ? "paused" : undefined,
              }}
              className={`sports-hero-rail-fill h-full w-full ${live ? "bg-danger" : "bg-ink"}`}
            />
          </div>
        )}
      </div>
    </section>
  );
}
