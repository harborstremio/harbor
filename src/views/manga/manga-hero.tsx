import { BookOpen, Star } from "lucide-react";
import { CoverImg } from "@/components/cover-img";
import { useEffect, useState } from "react";
import { usePageVisible } from "@/lib/visibility";
import { useT } from "@/lib/i18n";
import { NavArrow } from "@/components/nav-arrow";
import { useIsMangaFavorite, useMangaFavorites } from "@/lib/manga-favorites";
import type { MangaSummary } from "@/lib/manga/model";
import { CollectionBadges } from "./collection-badge";

const ROTATE_MS = 9000;

function statusLabel(s?: string): string | null {
  if (!s) return null;
  const m: Record<string, string> = {
    ongoing: "Ongoing",
    completed: "Completed",
    hiatus: "Hiatus",
    cancelled: "Cancelled",
  };
  return m[s] ?? s;
}

export function MangaHero({
  featured,
  onOpen,
}: {
  featured: MangaSummary[];
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const { toggle } = useMangaFavorites();

  const pageVisible = usePageVisible();
  useEffect(() => {
    if (paused || featured.length < 2 || !pageVisible) return;
    const id = window.setInterval(() => setActive((i) => (i + 1) % featured.length), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused, featured.length, pageVisible]);

  useEffect(() => {
    if (active >= featured.length) setActive(0);
  }, [featured.length, active]);

  useEffect(() => {
    if (active === shown) return;
    setVisible(false);
    const timer = window.setTimeout(() => {
      setShown(active);
      setVisible(true);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [active, shown]);

  const current = featured[shown];
  const fav = useIsMangaFavorite(current?.id);

  const meta = current
    ? [
        current.year != null ? String(current.year) : null,
        statusLabel(current.status),
        current.lastChapter ? `${current.lastChapter} chapters` : null,
      ].filter(Boolean)
    : [];

  const fade = {
    transition: "opacity 420ms cubic-bezier(0.22,1,0.36,1), transform 420ms cubic-bezier(0.22,1,0.36,1)",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(14px)",
  };

  return (
    <section
      className="group relative harbor-hero-bleed harbor-hero-bleed-top overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 z-0">
        <img
          src="/mangahero.png"
          alt=""
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: "center 20%" }}
        />
        <div className="absolute inset-0 bg-canvas/45" />
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--color-canvas)] from-5% via-[color-mix(in_oklch,var(--color-canvas),transparent_45%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_88%)]" />
        <div
          className="absolute inset-x-0 bottom-0 h-[55%]"
          style={{
            background:
              "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 55%) 55%, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-[440px] items-center gap-10 px-20 pt-28 pb-14">
        {current && (
          <>
        <div className="flex max-w-[540px] flex-1 flex-col gap-5" style={fade}>
          <span className="inline-flex items-center gap-2 self-start text-[12px] font-semibold uppercase tracking-[0.18em] text-accent">
            <BookOpen size={15} strokeWidth={2.4} />
            {t("Featured manga")}
          </span>
          <h1
            className="text-[48px] font-medium leading-[1.02] tracking-tight text-ink drop-shadow-[0_2px_22px_rgba(0,0,0,0.55)]"
            style={{ fontFamily: '"QR Ames Beta", var(--font-display), serif' }}
          >
            {current.title}
          </h1>
          {current.author && (
            <p className="text-[16px] font-medium text-ink-muted">{current.author}</p>
          )}
          {meta.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 text-[13.5px] text-ink-muted">
              {meta.map((p, i) => (
                <span key={`${p}-${i}`} className="inline-flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="text-ink-subtle">·</span>}
                  <span>{p}</span>
                </span>
              ))}
            </div>
          )}
          {current.description && (
            <p className="line-clamp-3 max-w-lg text-[14.5px] leading-relaxed text-ink-muted">
              {current.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpen(current.id)}
              className="flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              <BookOpen size={16} strokeWidth={2.6} />
              {t("Read Now")}
            </button>
            <button
              type="button"
              onClick={() => toggle({ id: current.id, title: current.title, cover: current.cover })}
              aria-label={fav ? t("Remove from favorites") : t("Add to favorites")}
              aria-pressed={fav}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.98] ${
                fav ? "bg-ink/15 hover:bg-ink/20" : "bg-canvas/80 hover:bg-canvas/95"
              }`}
            >
              <Star size={18} strokeWidth={2.2} fill={fav ? "currentColor" : "none"} className={fav ? "text-accent" : "text-ink"} />
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(current.id)}
          className="relative hidden shrink-0 lg:block"
          aria-label={current.title}
          style={fade}
        >
          <CoverImg
            src={current.cover}
            alt=""
            decoding="async"
            className="h-[340px] w-auto rounded-2xl object-cover shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] ring-1 ring-edge-soft transition-transform duration-300 hover:-translate-y-1"
          />
          <span className="absolute -bottom-4 -end-4 z-10">
            <CollectionBadges title={current.title} size={72} />
          </span>
        </button>
          </>
        )}
      </div>

      {featured.length > 1 && (
        <>
          <NavArrow
            dir="left"
            onClick={() => setActive((i) => (i - 1 + featured.length) % featured.length)}
            label={t("Previous")}
            size={38}
            className="absolute start-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 opacity-25 group-hover:opacity-100"
          />
          <NavArrow
            dir="right"
            onClick={() => setActive((i) => (i + 1) % featured.length)}
            label={t("Next")}
            size={38}
            className="absolute end-2 top-1/2 z-20 h-14 w-14 -translate-y-1/2 opacity-25 group-hover:opacity-100"
          />
          <div className="absolute bottom-6 start-20 z-10 flex gap-1.5">
            {featured.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActive(i)}
                aria-label={t("Slide {n}", { n: i + 1 })}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === active ? "w-8 bg-accent" : "w-4 bg-ink-subtle/40 hover:bg-ink-subtle/70"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
