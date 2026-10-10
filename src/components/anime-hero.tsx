import { Check, Plus, TrendingUp } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useMemo, useState } from "react";
import { useArtFallback } from "./anime-hero-art-fallback";
import { NavArrow } from "@/components/nav-arrow";
import { PopIcon } from "@/components/pop-icon";
import { HeroPips } from "./anime-hero/hero-pips";
import { HeroSlideBadges } from "./anime-hero/hero-slide-badges";
import { HeroMangaAdaptation } from "./anime-hero/hero-manga-adaptation";
import { awardSourceMeta, findTopAward, parseAwardYear } from "@/lib/anime-awards";
import { useAwardMasterVersion } from "@/lib/anime-awards-source";
import { useAwardIcon } from "@/lib/award-icons";
import type { Meta } from "@/lib/cinemeta";
import { isSaved, toggleSaved } from "@/lib/feed";
import { useT } from "@/lib/i18n";
import { useMalRating } from "@/lib/mal-rating";
import { useSettings } from "@/lib/settings";
import { useTitleLogo } from "@/lib/title-logo";
import { useView } from "@/lib/view";
import { observe, usePageVisible } from "@/lib/visibility";
import { useHeroLogos } from "./anime-hero/use-hero-logos";
import { MalLogo } from "./icons/mal-logo";
import { PickCard } from "./pick-card";
import { Row } from "./row";

const ROTATE_MS = 14000;
const FADE_MS = 700;

export function AnimeHero({
  slides,
  topPicks,
  trendingByMetaId,
  topBleed = true,
}: {
  slides: Meta[];
  topPicks: Meta[];
  trendingByMetaId?: Record<string, string>;
  topBleed?: boolean;
}) {
  const { openMeta } = useView();
  const { settings } = useSettings();
  const t = useT();
  useAwardMasterVersion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const visible = usePageVisible();
  const [savedTick, setSavedTick] = useState(0);
  const n = slides.length;
  const windowIdx = useMemo(() => {
    const AHEAD = 3;
    const BEHIND = 1;
    const set = new Set<number>();
    if (n > 0) for (let d = -BEHIND; d <= AHEAD; d += 1) set.add(((active + d) % n + n) % n);
    return set;
  }, [active, n]);
  const windowSlides = useMemo(() => slides.filter((_, i) => windowIdx.has(i)), [slides, windowIdx]);
  const logos = useHeroLogos(windowSlides, settings);

  useEffect(() => {
    if (slides.length === 0) return;
    const el = document.getElementById("anime-hero-section");
    if (!el) return;
    return observe(el, setInView);
  }, [slides.length]);

  useEffect(() => {
    if (paused || !inView || !visible || slides.length < 2) return;
    const id = setInterval(() => setActive((i) => (i + 1) % slides.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [paused, inView, visible, slides.length]);

  useEffect(() => {
    if (active >= slides.length && slides.length > 0) setActive(0);
  }, [slides.length, active]);

  const malRating = useMalRating(slides[active]);
  const pinnedLogo = useTitleLogo(slides[active]?.id);
  if (slides.length === 0) return null;

  const current = slides[active] ?? slides[0];
  if (!current) return null;
  const logo = pinnedLogo ?? logos[current.id] ?? current.logo;
  const saved = isSaved(current.id);

  const next = () => setActive((i) => (i + 1) % slides.length);
  const prev = () => setActive((i) => (i - 1 + slides.length) % slides.length);

  return (
    <section
      id="anime-hero-section"
      className={`group relative harbor-hero-bleed ${topBleed ? "harbor-hero-bleed-top" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        {slides.map((m, i) => {
          if (!windowIdx.has(i)) return null;
          if (!m.background && !m.poster) return null;
          return (
            <div
              key={m.id}
              aria-hidden={i !== active}
              className="absolute inset-0"
              style={{
                opacity: i === active ? 1 : 0,
                transition: `opacity ${FADE_MS}ms cubic-bezier(0.32, 0.72, 0.24, 1)`,
              }}
            >
              <HeroBackdrop meta={m} />
            </div>
          );
        })}
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--color-canvas)] from-0% via-[color-mix(in_oklch,var(--color-canvas),transparent_50%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_92%)] to-100%"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[60%]"
          style={{
            background:
              "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 60%) 50%, transparent)",
          }}
        />
      </div>

      <div className="relative z-10 flex min-h-[520px] items-end px-20 pt-24 pb-10">
        <div
          className="flex max-w-[520px] flex-col gap-5"
          style={{ transition: `opacity ${FADE_MS}ms ease-out` }}
        >
          <CrunchyrollBadge name={current.name} year={parseAwardYear(current.releaseInfo)} id={current.id} />
          {!findTopAward(current.name, parseAwardYear(current.releaseInfo), current.id) &&
            trendingByMetaId?.[current.id] && (
              <TrendingBadge source={trendingByMetaId[current.id]} />
            )}
          <HeroLogo title={current.name} logo={logo} />
          <HeroTags meta={current} />
          {current.description && (
            <p className="line-clamp-3 text-[14.5px] leading-relaxed text-ink-muted">
              {current.description}
            </p>
          )}
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => openMeta(current)}
              className="flex h-12 items-center gap-2.5 rounded-full bg-ink px-7 text-[15px] font-semibold text-canvas transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              <Play size={18} fill="currentColor" />
              {t("Start Watching")}
            </button>
            <button
              type="button"
              onClick={() => {
                toggleSaved(current.id);
                setSavedTick((t) => t + 1);
              }}
              aria-label={saved ? t("Remove from saved") : t("Save for later")}
              aria-pressed={saved}
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-[transform,background-color] duration-200 active:scale-[0.98] ${
                saved ? "bg-ink/15 text-ink hover:bg-ink/20" : "bg-canvas/80 text-ink hover:bg-canvas/95"
              }`}
            >
              <PopIcon
                active={saved}
                activeIcon={<Check size={18} strokeWidth={2.4} />}
                inactiveIcon={<Plus size={18} strokeWidth={2} />}
              />
            </button>
            <span className="ms-1 hidden items-center gap-1.5 text-[13px] text-ink-muted sm:inline-flex">
              {malRating && (
                <>
                  <MalLogo className="h-[12px] w-auto text-ink-muted" />
                  <span className="font-semibold text-ink">{malRating}</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <NavArrow
            dir="left"
            onClick={prev}
            label={t("Previous")}
            size={38}
            className="absolute start-2 top-1/2 z-30 h-14 w-14 -translate-y-1/2 opacity-25 transition-opacity group-hover:opacity-100"
          />
          <NavArrow
            dir="right"
            onClick={next}
            label={t("Next")}
            size={38}
            className="absolute end-2 top-1/2 z-30 h-14 w-14 -translate-y-1/2 opacity-25 transition-opacity group-hover:opacity-100"
          />
        </>
      )}

      <div className="relative z-10 flex flex-col gap-5 px-12 pb-12" data-saved={savedTick}>
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-[20px] font-medium tracking-tight text-ink">{t("Top Picks for You")}</h2>
          <div className="flex flex-col items-end gap-2.5">
            <div className="flex min-h-[48px] items-center gap-3">
              <HeroMangaAdaptation meta={current} />
              <HeroSlideBadges meta={current} />
            </div>
            {slides.length > 1 && <HeroPips total={slides.length} active={active} onSelect={setActive} />}
          </div>
        </div>
        {topPicks.length > 0 ? (
          <Row scrollKey="anime:topPicks">
            {topPicks.map((m) => (
              <PickCard key={m.id} meta={m} />
            ))}
          </Row>
        ) : (
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-xl bg-elevated/35"
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function AnimeHeroSkeleton() {
  return (
    <section className="relative -mx-12 -mt-28" aria-hidden>
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-elevated/45 via-surface/30 to-canvas" />
        <div className="absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l from-[var(--color-canvas)] from-0% via-[color-mix(in_oklch,var(--color-canvas),transparent_50%)] via-55% to-[color-mix(in_oklch,var(--color-canvas),transparent_92%)] to-100%" />
        <div
          className="absolute inset-x-0 bottom-0 h-[60%]"
          style={{
            background:
              "linear-gradient(to top, var(--color-canvas), color-mix(in oklch, var(--color-canvas), transparent 60%) 50%, transparent)",
          }}
        />
      </div>
      <div className="relative z-10 flex min-h-[520px] items-end px-12 pt-24 pb-10">
        <div className="flex max-w-[520px] flex-col gap-5">
          <div className="h-4 w-40 animate-pulse rounded-full bg-elevated/50" />
          <div className="h-16 w-[360px] max-w-full animate-pulse rounded-2xl bg-elevated/50" />
          <div className="h-4 w-56 animate-pulse rounded-full bg-elevated/40" />
          <div className="flex flex-col gap-2">
            <div className="h-3 w-[440px] max-w-full animate-pulse rounded-full bg-elevated/30" />
            <div className="h-3 w-[400px] max-w-full animate-pulse rounded-full bg-elevated/30" />
            <div className="h-3 w-[280px] max-w-full animate-pulse rounded-full bg-elevated/30" />
          </div>
          <div className="mt-1 flex items-center gap-3">
            <div className="h-12 w-44 animate-pulse rounded-md bg-elevated/55" />
            <div className="h-12 w-12 animate-pulse rounded-md bg-elevated/40" />
          </div>
        </div>
      </div>
      <div className="relative z-10 flex flex-col gap-5 px-12 pb-12">
        <div className="h-5 w-44 animate-pulse rounded-full bg-elevated/45" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-36 shrink-0 animate-pulse rounded-xl bg-elevated/35" />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroLogo({ title, logo }: { title: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logo]);
  if (logo && !failed) {
    return <HeroLogoImage logo={logo} title={title} onFail={() => setFailed(true)} />;
  }
  return (
    <h1 className="font-display text-[56px] font-medium leading-[0.98] tracking-tight text-ink drop-shadow-[0_2px_22px_rgba(0,0,0,0.6)]">
      {title}
    </h1>
  );
}

function CrunchyrollBadge({ name, year, id }: { name: string; year?: number; id?: string }) {
  const [hover, setHover] = useState(false);
  const win = findTopAward(name, year, id);
  const srcIcon = useAwardIcon(win?.source ?? "");
  if (!win) return null;
  const src = awardSourceMeta(win.source);
  const label = win.isAOTY
    ? `${win.year} Anime of the Year`
    : `${win.year} ${win.categoryName.replace(/^Best\s+/i, "Best ")}`;
  const iconUrl = srcIcon ?? src.iconSmall;
  const invert =
    !srcIcon && win.source === "animation_kobe" ? "brightness-0 invert" : "";
  const iconCls = `h-4 w-4 shrink-0 object-contain ${invert}`;
  const tipIconCls = `h-3.5 w-3.5 object-contain ${invert}`;
  return (
    <div
      className="relative inline-flex items-center gap-2 self-start"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <img
        src={iconUrl}
        alt=""
        width={16}
        height={16}
        className={iconCls}
        draggable={false}
      />
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink">
        {label}
      </span>
      <div
        role="tooltip"
        className={`pointer-events-none absolute start-0 top-full z-30 mt-2 w-max max-w-[280px] origin-top-left rtl:origin-top-right rounded-xl border border-edge-soft/70 bg-elevated/95 px-3.5 py-2.5 text-start shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] backdrop-blur-md transition-all duration-150 ${
          hover ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="flex items-center gap-2">
          <img src={iconUrl} alt="" width={14} height={14} className={tipIconCls} draggable={false} />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-accent">
            {src.name}
          </span>
        </div>
        <div className="mt-1 text-[13.5px] font-semibold text-ink">
          {win.year} {win.categoryName}
        </div>
        <div className="mt-0.5 text-[11.5px] text-ink-muted">
          {win.year} ceremony · {win.title}
        </div>
      </div>
    </div>
  );
}

function TrendingBadge({ source }: { source: string }) {
  const t = useT();
  return (
    <div className="inline-flex items-center gap-2 self-start">
      <TrendingUp size={16} strokeWidth={2.4} className="shrink-0 text-accent" />
      <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-ink">
        {t("Trending on {source}", { source })}
      </span>
    </div>
  );
}

function HeroTags({ meta }: { meta: Meta }) {
  const parts: string[] = [];
  if (meta.releaseInfo) parts.push(meta.releaseInfo);
  parts.push("Subtitled");
  if (meta.genres && meta.genres.length > 0) {
    parts.push(meta.genres.slice(0, 3).join(", "));
  }
  return (
    <div className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink-muted">
      {parts.map((p, i) => (
        <span key={`${p}-${i}`} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden className="text-ink-subtle">·</span>}
          <span>{p}</span>
        </span>
      ))}
    </div>
  );
}

function HeroBackdrop({ meta }: { meta: Meta }) {
  const art = useArtFallback([meta.background, meta.poster]);
  if (!art.src) return null;
  return (
    <img
      src={art.src}
      alt=""
      decoding="async"
      onLoad={art.onLoad}
      onError={art.onError}
      className="absolute inset-0 h-full w-full object-cover"
      style={{ objectPosition: "75% center" }}
    />
  );
}

function HeroLogoImage({
  logo,
  title,
  onFail,
}: {
  logo: string;
  title: string;
  onFail: () => void;
}) {
  const art = useArtFallback([logo]);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (art.exhausted) onFail();
  }, [art.exhausted, onFail]);
  if (!art.src) return null;
  return (
    <img
      src={art.src}
      alt={title}
      decoding="async"
      onLoad={() => {
        art.onLoad();
        setShown(true);
      }}
      onError={art.onError}
      className="max-h-[120px] w-auto max-w-[420px] object-contain object-left rtl:object-right drop-shadow-[0_6px_24px_rgba(0,0,0,0.55)]"
      style={{
        opacity: shown ? 1 : 0,
        transition: "opacity 420ms cubic-bezier(0.32, 0.72, 0.24, 1)",
      }}
    />
  );
}
