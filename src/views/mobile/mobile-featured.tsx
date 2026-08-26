import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useHeroLogos } from "@/components/anime-hero/use-hero-logos";
import { ImdbIcon } from "@/components/icons/imdb-icon";
import { mergePreferredMeta } from "@/lib/preferred-meta";
import { usePreferredMeta } from "@/lib/use-preferred-meta";

const AUTO_MS = 7000;
const GUTTER = 16;

function upsize(url?: string): string | undefined {
  if (!url) return url;
  return url.replace(/\/t\/p\/w\d+\//, "/t/p/w1280/");
}

function yearOf(m: Meta): string {
  return (m.releaseInfo ?? m.releaseDate ?? "").slice(0, 4);
}

export function MobileFeatured({ items, onOpen }: { items: Meta[]; onOpen: (m: Meta) => void }) {
  const { settings } = useSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const activeRef = useRef(0);
  activeRef.current = active;
  const pausedUntil = useRef(0);
  const reduceRef = useRef(false);
  const shown = useMemo(() => items.filter((m) => m.background).slice(0, 8), [items]);
  const t = useT();
  const logos = useHeroLogos(shown, settings);

  useEffect(() => {
    reduceRef.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || shown.length === 0) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const contLeft = el.getBoundingClientRect().left;
        const center = el.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < el.children.length; i++) {
          const r = (el.children[i] as HTMLElement).getBoundingClientRect();
          const cc = r.left - contLeft + r.width / 2;
          const d = Math.abs(cc - center);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        }
        setActive(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [shown.length]);

  const goTo = (i: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const kid = el.children[i] as HTMLElement | undefined;
    if (!kid) return;
    const delta = kid.getBoundingClientRect().left - el.getBoundingClientRect().left;
    el.scrollTo({ left: el.scrollLeft + delta - GUTTER, behavior: reduceRef.current ? "auto" : "smooth" });
  };

  useEffect(() => {
    if (shown.length < 2 || reduceRef.current) return;
    const id = window.setInterval(() => {
      if (Date.now() < pausedUntil.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const next = (activeRef.current + 1) % shown.length;
      const kid = el.children[next] as HTMLElement | undefined;
      if (!kid) return;
      const delta = kid.getBoundingClientRect().left - el.getBoundingClientRect().left;
      el.scrollTo({ left: el.scrollLeft + delta - GUTTER, behavior: "smooth" });
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [shown.length]);

  if (shown.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="px-4 font-display text-[22px] font-medium tracking-tight text-ink">
        {t("Recommended")}
      </h2>
      <div
        ref={scrollRef}
        onPointerDown={() => {
          pausedUntil.current = Date.now() + 14000;
        }}
        style={{ scrollPaddingInlineStart: GUTTER }}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {shown.map((m) => (
          <FeaturedCard key={m.id} meta={m} logo={logos[m.id] ?? m.logo} onOpen={onOpen} />
        ))}
      </div>
      {shown.length > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {shown.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Go to featured item ${i + 1}`}
              onClick={() => goTo(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === active ? "w-5 bg-accent" : "w-1.5 bg-ink/20"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function FeaturedCard({ meta, logo, onOpen }: { meta: Meta; logo?: string; onOpen: (m: Meta) => void }) {
  const preferredMeta = usePreferredMeta(meta);
  const displayMeta = mergePreferredMeta(meta, preferredMeta);
  const bg = upsize(meta.background) ?? meta.poster;
  const year = yearOf(meta);
  const badge = meta.providerBadge;
  return (
    <button
      type="button"
      onClick={() => onOpen(displayMeta)}
      className="relative block aspect-[4/5] w-[86%] shrink-0 snap-start overflow-hidden rounded-[22px] bg-surface text-start ring-1 ring-edge-soft/50 transition-transform duration-150 active:scale-[0.98]"
    >
      {bg && (
        <img src={bg} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/35 to-black/10" />
      <div className="absolute inset-x-0 top-0 flex p-4">
        {badge ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/45 py-1 pe-1.5 ps-2.5 text-[10.5px] font-semibold text-white/90 backdrop-blur-md">
            Popular on
            <span className="flex h-[17px] items-center rounded-full bg-white px-1.5">
              <img src={badge.logo} alt={badge.name} className="h-2.5 w-auto max-w-[52px] object-contain" />
            </span>
          </span>
        ) : (
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent backdrop-blur-md">
            Featured
          </span>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-5">
        {logo ? (
          <img
            src={logo}
            alt={displayMeta.name}
            loading="lazy"
            decoding="async"
            className="max-h-[64px] max-w-[80%] object-contain object-left drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]"
          />
        ) : (
          <h3 className="font-display text-[26px] font-medium leading-[1.05] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
            {displayMeta.name}
          </h3>
        )}
        <div className="flex items-center gap-2.5 text-[12.5px] text-white/80">
          {year && <span className="font-medium">{year}</span>}
          {meta.imdbRating && (
            <span className="flex items-center gap-1.5">
              <ImdbIcon className="h-[14px] w-auto rounded-[3px]" />
              <span className="font-semibold text-white">{meta.imdbRating}</span>
            </span>
          )}
          {meta.genres?.[0] && <span className="text-white/65">{meta.genres[0]}</span>}
        </div>
        {displayMeta.description && (
          <p className="line-clamp-2 max-w-[92%] text-[12.5px] leading-relaxed text-white/70">{displayMeta.description}</p>
        )}
      </div>
    </button>
  );
}
