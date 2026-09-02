import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Layers, Search as SearchIcon, Trophy, X } from "lucide-react";
import type { Meta, MetaType } from "@/lib/cinemeta";
import { Poster, usePosterChain } from "@/components/poster";
import { Laurel } from "@/components/icons/laurel";
import { AwardLogo } from "@/components/icons/award-logo";
import { HarborLoader } from "@/components/harbor-loader";
import { AiModeButton } from "@/components/search/ai-mode-button";
import { AiSearchSection } from "@/components/search/ai-search-section";
import { providerTabFor } from "@/lib/ai-models";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { tmdbCollection, tmdbDiscover, tmdbTrending } from "@/lib/providers/tmdb";
import { topMovies, topSeries } from "@/lib/cinemeta";
import { rpdbPoster } from "@/lib/providers/rpdb";
import { listBrowseCatalogs, browseFetcher } from "@/lib/catalog-browse";
import { fetchAddonCatalogPage, fetchAddonMeta, isCollectionCatalog } from "@/lib/addons";
import { MobileDetail } from "./mobile-detail";
import { MobileAwards } from "./mobile-awards";
import { MobileGenrePage } from "./mobile-genre-page";
import { useMobileRemote } from "./mobile-remote";
import { LocalLibraryBrand } from "@/components/local-library-brand";
import { MediaServerBrand } from "@/components/media-server-brand";
import type { MediaServerProvider } from "@/lib/media-server/types";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const VIEW_SWAP_CSS = `
@keyframes ms-view-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.ms-view-in { animation: ms-view-in 280ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) {
  .ms-view-in { animation: none; }
}
`;

const CATEGORIES = [
  { label: "Action", genre: "Action" },
  { label: "Adventure", genre: "Adventure" },
  { label: "Comedy", genre: "Comedy" },
  { label: "Crime", genre: "Crime" },
  { label: "Drama", genre: "Drama" },
  { label: "Fantasy", genre: "Fantasy" },
  { label: "Horror", genre: "Horror" },
  { label: "Mystery", genre: "Mystery" },
  { label: "Romance", genre: "Romance" },
  { label: "Sci-Fi", genre: "Sci-Fi" },
  { label: "Thriller", genre: "Thriller" },
  { label: "Animation", genre: "Animation" },
  { label: "Documentary", genre: "Documentary" },
  { label: "Family", genre: "Family" },
  { label: "War", genre: "War" },
  { label: "Western", genre: "Western" },
];

const EXPLORE = [
  {
    label: "Recently added",
    kind: "recent" as const,
    caption: "Just landed",
    img: "recently_added",
  },
  { label: "Popular", kind: "popular" as const, caption: "Most watched", img: "popular" },
  { label: "Trending", kind: "trending" as const, caption: "On the rise", img: "trending" },
];

function interleave(a: Meta[], b: Meta[]): Meta[] {
  const out: Meta[] = [];
  const seen = new Set<string>();
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    for (const m of [a[i], b[i]]) {
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
  }
  return out;
}

type Catalog = { title: string; metas: Meta[] | null; empty?: string };

export function MobileSearch() {
  const t = useT();
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const { query, results, status, recent, setQuery, clear, recordRecent, removeRecent } =
    useSearch();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [collections, setCollections] = useState(false);
  const [genreView, setGenreView] = useState<(typeof CATEGORIES)[number] | null>(null);
  const [aiMode, setAiMode] = useState(false);
  const [awardsOpen, setAwardsOpen] = useState(false);
  const [detailMeta, setDetailMeta] = useState<Meta | null>(null);
  const key = settings.tmdbKey;
  const hasAiKey = !!(settings.aiSearchKey.trim() || settings.aiGroqKey.trim());

  const leaveOverlays = () => {
    setCatalog(null);
    setCollections(false);
    setGenreView(null);
  };

  const openCatalog = async (title: string, fetcher: () => Promise<Meta[]>, empty?: string) => {
    setCollections(false);
    setCatalog({ title, metas: null, empty });
    try {
      setCatalog({ title, metas: await fetcher(), empty });
    } catch {
      setCatalog({ title, metas: [], empty });
    }
  };

  const openGenre = (c: (typeof CATEGORIES)[number]) => {
    setCatalog(null);
    setCollections(false);
    setGenreView({ ...c, label: t(c.label) });
  };

  const openExplore = (e: (typeof EXPLORE)[number]) =>
    openCatalog(t(e.label), async () => {
      if (key) {
        if (e.kind === "trending") {
          const [m, t] = await Promise.all([
            tmdbTrending(key, "movie", "week"),
            tmdbTrending(key, "tv", "week"),
          ]);
          return interleave(m, t);
        }
        if (e.kind === "popular") {
          const [m, t] = await Promise.all([
            tmdbDiscover(key, "movie", { sort_by: "popularity.desc" }),
            tmdbDiscover(key, "tv", { sort_by: "popularity.desc" }),
          ]);
          return interleave(m, t);
        }
        return tmdbDiscover(key, "movie", {
          sort_by: "primary_release_date.desc",
          "vote_count.gte": "60",
        });
      }
      const skip = e.kind === "trending" ? 100 : 0;
      const [m, t] = await Promise.all([
        topMovies(undefined, skip).catch(() => []),
        topSeries(undefined, skip).catch(() => []),
      ]);
      return interleave(m, t);
    });

  const searching = query.trim().length > 0;
  const resultMetas = useMemo(() => {
    if (!results) return [];
    const base = interleave(results.movies ?? [], results.series ?? []);
    const top = results.topMatch?.meta;
    if (top && !base.some((m) => m.id === top.id)) return [top, ...base];
    return base;
  }, [results]);

  const viewKey = searching
    ? "results"
    : collections
      ? "collections"
      : catalog
        ? `catalog:${catalog.title}`
        : "landing";

  if (genreView) {
    return <MobileGenrePage genre={genreView} onBack={() => setGenreView(null)} />;
  }

  return (
    <div
      className="flex flex-col gap-7 px-5"
      style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 14px)" }}
    >
      <style>{VIEW_SWAP_CSS}</style>
      <div className="flex items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <SearchBar
            value={query}
            onChange={(v) => {
              setQuery(v);
              if (v.trim()) leaveOverlays();
            }}
            onSubmit={() => query.trim() && recordRecent(query)}
            onClear={() => {
              clear();
              leaveOverlays();
            }}
          />
        </div>
        {hasAiKey && (
          <AiModeButton
            active={aiMode}
            currentModel={settings.aiSearchModel}
            onToggle={() => setAiMode((v) => !v)}
            onSelectModel={(id) => {
              update({ aiSearchModel: id, aiSearchProvider: providerTabFor(id) });
              setAiMode(true);
            }}
          />
        )}
      </div>

      <div key={viewKey} className="ms-view-in">
        {searching ? (
          aiMode && hasAiKey ? (
            <AiSearchSection
              query={query}
              aiMode
              onClose={() => query.trim() && recordRecent(query)}
            />
          ) : (
            <Results status={status} metas={resultMetas} onOpenDetail={setDetailMeta} />
          )
        ) : collections ? (
          <CollectionsBrowser
            authKey={authKey}
            onBack={() => setCollections(false)}
            onOpenDetail={setDetailMeta}
          />
        ) : catalog ? (
          <CatalogView
            catalog={catalog}
            onBack={() => setCatalog(null)}
            onOpenDetail={setDetailMeta}
          />
        ) : (
          <Landing
            recent={recent}
            onRecent={setQuery}
            onRemoveRecent={removeRecent}
            onExplore={openExplore}
            onGenre={openGenre}
            onAwards={() => setAwardsOpen(true)}
            onCollections={() => setCollections(true)}
          />
        )}
      </div>

      {awardsOpen && (
        <MobileAwards onClose={() => setAwardsOpen(false)} onOpenDetail={setDetailMeta} />
      )}

      {detailMeta && <MobileDetail meta={detailMeta} onClose={() => setDetailMeta(null)} />}
    </div>
  );
}

function SearchBar({
  value,
  onChange,
  onSubmit,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const t = useT();
  const [focused, setFocused] = useState(false);
  return (
    <div
      className={`flex h-[54px] items-center gap-3 rounded-full bg-ink px-5 shadow-[0_10px_28px_-16px_rgba(0,0,0,0.6)] ring-accent/70 transition-[transform,box-shadow] duration-200 ease-out motion-reduce:transition-none ${
        focused ? "scale-[1.015] ring-2" : "ring-0"
      }`}
      onClick={() => ref.current?.focus()}
    >
      <SearchIcon
        size={20}
        strokeWidth={2.4}
        className={`shrink-0 transition-colors duration-200 ${focused ? "text-accent" : "text-canvas/55"}`}
      />
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit();
            ref.current?.blur();
          }
        }}
        enterKeyHint="search"
        inputMode="search"
        autoComplete="off"
        spellCheck={false}
        placeholder={t("Actor, title, genre")}
        className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-canvas placeholder:text-canvas/45 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          aria-label={t("Clear")}
          onClick={(e) => {
            e.stopPropagation();
            onClear();
            ref.current?.focus();
          }}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-canvas/12 text-canvas/70 transition-transform active:scale-90 motion-reduce:transition-none"
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      )}
    </div>
  );
}

function Landing({
  recent,
  onRecent,
  onRemoveRecent,
  onExplore,
  onGenre,
  onAwards,
  onCollections,
}: {
  recent: string[];
  onRecent: (q: string) => void;
  onRemoveRecent: (q: string) => void;
  onExplore: (e: (typeof EXPLORE)[number]) => void;
  onGenre: (c: (typeof CATEGORIES)[number]) => void;
  onAwards: () => void;
  onCollections: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-9">
      {recent.length > 0 && (
        <section className="flex flex-col gap-3.5">
          <SectionTitle>{t("Recent")}</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <span
                key={r}
                className="flex items-center gap-1.5 rounded-full bg-surface py-2 ps-3.5 pe-2 text-[13.5px] font-medium text-ink ring-1 ring-edge-soft"
              >
                <button type="button" onClick={() => onRecent(r)} className="max-w-[42vw] truncate">
                  {r}
                </button>
                <button
                  type="button"
                  aria-label={t("Remove {query}", { query: r })}
                  onClick={() => onRemoveRecent(r)}
                  className="grid h-5 w-5 place-items-center rounded-full text-ink-subtle transition-colors active:text-ink motion-reduce:transition-none"
                >
                  <X size={13} strokeWidth={2.6} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <AwardsCard onClick={onAwards} />
        <CollectionsCard onClick={onCollections} />
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionTitle>{t("More to explore")}</SectionTitle>
        <div className="overflow-hidden rounded-[18px] bg-surface ring-1 ring-edge-soft">
          {EXPLORE.map((e, i) => (
            <button
              key={e.label}
              type="button"
              onClick={() => onExplore(e)}
              className={`flex w-full items-center gap-3.5 px-4 py-3 text-start transition-colors active:bg-elevated/60 motion-reduce:transition-none ${
                i > 0 ? "border-t border-edge-soft/70" : ""
              }`}
            >
              <img
                src={`/explore-icons/${e.img}.png`}
                alt=""
                aria-hidden
                draggable={false}
                className="h-8 w-8 shrink-0 object-contain mix-blend-screen"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15.5px] font-semibold text-ink">{t(e.label)}</span>
                <span className="text-[12.5px] text-ink-subtle">{t(e.caption)}</span>
              </span>
              <ChevronRight size={19} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3.5">
        <SectionTitle>{t("Genres")}</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map((c) => (
            <GenreTile key={c.label} category={c} onOpen={() => onGenre(c)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FeatureCardShell({
  onClick,
  art,
  title,
  caption,
  wash,
  backdrop,
}: {
  onClick: () => void;
  art: React.ReactNode;
  title: string;
  caption: string;
  wash: string;
  backdrop?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[132px] flex-col justify-between overflow-hidden rounded-xl bg-surface p-4 text-start ring-1 ring-edge-soft transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none"
    >
      {backdrop}
      <span
        aria-hidden
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent ${wash}`}
      />
      <span className="relative flex h-12 items-center">{art}</span>
      <span className="relative mt-3 flex flex-col gap-0.5">
        <span className="font-display text-[18px] font-medium leading-tight tracking-tight text-ink">
          {title}
        </span>
        <span className="text-[12.5px] leading-snug text-ink-muted">{caption}</span>
      </span>
    </button>
  );
}

const AWARD_MARKS = ["oscar", "sag", "bafta", "golden_globe", "emmy"];

function AwardMarkCycle() {
  const [reduced] = useState(prefersReducedMotion);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % AWARD_MARKS.length), 3800);
    return () => window.clearInterval(t);
  }, [reduced]);
  if (reduced) return <AwardLogo type="oscar" size={19} />;
  return (
    <span className="relative grid h-full w-full place-items-center">
      {AWARD_MARKS.map((mark, i) => (
        <span
          key={mark}
          aria-hidden
          className="col-start-1 row-start-1 transition-opacity duration-[600ms] ease-out motion-reduce:transition-none"
          style={{ opacity: i === idx ? 1 : 0 }}
        >
          <AwardLogo type={mark} size={19} />
        </span>
      ))}
    </span>
  );
}

function AwardsCard({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <FeatureCardShell
      onClick={onClick}
      title={t("Awards")}
      caption={t("Oscar, SAG, BAFTA winners")}
      wash="from-[oklch(0.83_0.10_85_/_0.14)]"
      art={
        <span
          className="drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]"
          style={{ color: "oklch(0.83 0.10 85)" }}
        >
          <Laurel size={48}>
            <AwardMarkCycle />
          </Laurel>
        </span>
      }
    />
  );
}

const PREVIEW_COLLECTION_IDS = [1241, 328, 10, 119, 263, 87096, 87359, 645];

type CollectionSlide = { backdrop?: string; posters: string[] };

function useCollectionSlides(key: string): CollectionSlide[] {
  const [slides, setSlides] = useState<CollectionSlide[]>([]);
  useEffect(() => {
    if (!key) {
      setSlides([]);
      return;
    }
    let alive = true;
    Promise.all(
      PREVIEW_COLLECTION_IDS.slice(0, 6).map((id) => tmdbCollection(key, id).catch(() => null)),
    )
      .then((cols) => {
        if (!alive) return;
        const out: CollectionSlide[] = [];
        for (const c of cols) {
          if (!c) continue;
          const posters = c.parts
            .map((p) => p.poster)
            .filter((x): x is string => !!x)
            .slice(0, 3);
          if (posters.length < 2) continue;
          out.push({
            backdrop: c.backdrop ?? c.parts.find((p) => p.background)?.background,
            posters,
          });
        }
        setSlides(out);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);
  return slides;
}

const COLL_CSS = `
@keyframes coll-in {
  from { opacity: 0; transform: scale(1.05); }
  to { opacity: 1; transform: scale(1); }
}
.coll-in { animation: coll-in 900ms var(--ease-out) both; }
@media (prefers-reduced-motion: reduce) { .coll-in { animation: none; } }
`;

function CollectionsCard({ onClick }: { onClick: () => void }) {
  const t = useT();
  const { settings } = useSettings();
  const slides = useCollectionSlides(settings.tmdbKey);
  const [reduced] = useState(prefersReducedMotion);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (reduced || slides.length <= 1) return;
    const t = window.setInterval(() => setIdx((i) => (i + 1) % slides.length), 8000);
    return () => window.clearInterval(t);
  }, [reduced, slides.length]);
  const active = slides.length ? slides[idx % slides.length] : null;
  return (
    <>
      <style>{COLL_CSS}</style>
      <FeatureCardShell
        onClick={onClick}
        title={t("Collections")}
        caption={t("Curated sets and sagas")}
        wash={active ? "from-transparent" : "from-accent/12"}
        backdrop={
          active?.backdrop ? <CollectionBackdrop src={active.backdrop} slideKey={idx} /> : undefined
        }
        art={
          active ? <CollectionArt posters={active.posters} slideKey={idx} /> : <CollectionStack />
        }
      />
    </>
  );
}

function CollectionBackdrop({ src, slideKey }: { src: string; slideKey: number }) {
  return (
    <span key={slideKey} aria-hidden className="pointer-events-none absolute inset-0 coll-in">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover opacity-[0.2]" />
      <span className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-surface/45" />
    </span>
  );
}

function CollectionStack() {
  return (
    <span aria-hidden className="relative h-11 w-[52px]">
      <span className="absolute bottom-0 start-0 h-10 w-[30px] -rotate-[13deg] rounded-[7px] bg-elevated ring-1 ring-edge-soft" />
      <span className="absolute bottom-0 start-[11px] h-10 w-[30px] rotate-[4deg] rounded-[7px] bg-raised ring-1 ring-edge-soft" />
      <span className="absolute bottom-0 start-[22px] h-10 w-[30px] rotate-[13deg] rounded-[7px] bg-accent/20 ring-1 ring-accent/25" />
    </span>
  );
}

function CollectionArt({ posters, slideKey }: { posters: string[]; slideKey: number }) {
  return (
    <span key={slideKey} aria-hidden className="relative h-11 w-[60px] coll-in">
      <PosterCard
        src={posters[0]}
        className="absolute bottom-0 start-0 h-10 w-[29px] -rotate-[13deg]"
      />
      <PosterCard
        src={posters[1] ?? posters[0]}
        className="absolute bottom-0 start-[14px] h-10 w-[29px] rotate-[3deg]"
      />
      <PosterCard
        src={posters[2] ?? posters[1] ?? posters[0]}
        className="absolute bottom-0 start-[28px] h-10 w-[29px] rotate-[13deg]"
      />
    </span>
  );
}

function PosterCard({ src, className }: { src: string; className: string }) {
  return (
    <span
      className={`overflow-hidden rounded-[7px] bg-elevated ring-1 ring-edge-soft ${className}`}
    >
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </span>
  );
}

const GENRE_PALETTE: Record<string, { from: string; to: string; ink: string }> = {
  Action: { from: "oklch(0.40 0.18 25)", to: "oklch(0.18 0.10 20)", ink: "oklch(0.96 0.02 25)" },
  Adventure: {
    from: "oklch(0.45 0.14 145)",
    to: "oklch(0.20 0.10 155)",
    ink: "oklch(0.96 0.02 145)",
  },
  Animation: {
    from: "oklch(0.50 0.16 200)",
    to: "oklch(0.20 0.10 195)",
    ink: "oklch(0.96 0.02 200)",
  },
  Comedy: { from: "oklch(0.55 0.16 75)", to: "oklch(0.22 0.08 60)", ink: "oklch(0.96 0.02 80)" },
  Crime: { from: "oklch(0.32 0.10 50)", to: "oklch(0.14 0.04 30)", ink: "oklch(0.95 0.04 60)" },
  Documentary: {
    from: "oklch(0.36 0.10 145)",
    to: "oklch(0.18 0.06 150)",
    ink: "oklch(0.96 0.02 145)",
  },
  Drama: { from: "oklch(0.36 0.12 240)", to: "oklch(0.18 0.06 230)", ink: "oklch(0.96 0.02 240)" },
  Family: { from: "oklch(0.50 0.13 100)", to: "oklch(0.20 0.08 110)", ink: "oklch(0.96 0.02 100)" },
  Fantasy: {
    from: "oklch(0.42 0.14 320)",
    to: "oklch(0.18 0.08 305)",
    ink: "oklch(0.96 0.02 320)",
  },
  Horror: { from: "oklch(0.30 0.10 15)", to: "oklch(0.10 0.04 20)", ink: "oklch(0.94 0.02 20)" },
  Mystery: { from: "oklch(0.32 0.10 95)", to: "oklch(0.14 0.06 80)", ink: "oklch(0.95 0.04 90)" },
  Romance: { from: "oklch(0.45 0.15 0)", to: "oklch(0.20 0.08 350)", ink: "oklch(0.96 0.02 0)" },
  "Sci-Fi": {
    from: "oklch(0.38 0.16 285)",
    to: "oklch(0.18 0.10 280)",
    ink: "oklch(0.96 0.02 285)",
  },
  Thriller: {
    from: "oklch(0.32 0.10 200)",
    to: "oklch(0.14 0.04 220)",
    ink: "oklch(0.96 0.02 220)",
  },
  War: { from: "oklch(0.32 0.06 70)", to: "oklch(0.14 0.04 60)", ink: "oklch(0.95 0.02 75)" },
  Western: { from: "oklch(0.45 0.12 55)", to: "oklch(0.18 0.08 35)", ink: "oklch(0.96 0.04 60)" },
};

function GenreTile({
  category,
  onOpen,
}: {
  category: (typeof CATEGORIES)[number];
  onOpen: () => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const [art, setArt] = useState<Meta[]>([]);
  const palette = GENRE_PALETTE[category.genre] ?? GENRE_PALETTE.Action;

  useEffect(() => {
    let cancelled = false;
    topMovies(category.genre)
      .then((list) => {
        if (cancelled) return;
        setArt(list.filter((m) => m.background || m.poster).slice(0, 3));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [category.genre]);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-edge-soft text-start transition-transform duration-200 active:scale-[0.98] motion-reduce:transition-none"
      style={{ background: `linear-gradient(150deg, ${palette.from}, ${palette.to})` }}
    >
      <GenreCollage art={art} rpdbKey={settings.rpdbKey} />
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(150deg, ${palette.from} 0%, oklch(from ${palette.from} l c h / 0.5) 60%, oklch(from ${palette.to} l c h / 0.9) 100%)`,
          mixBlendMode: "multiply",
        }}
      />
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: `linear-gradient(to bottom, transparent, ${palette.to})` }}
      />
      <span className="absolute inset-x-3.5 bottom-3 flex items-end justify-between">
        <span
          className="font-display text-[17px] font-medium leading-tight tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)]"
          style={{ color: palette.ink }}
        >
          {t(category.label)}
        </span>
        <ChevronRight
          size={16}
          strokeWidth={2.4}
          className="shrink-0"
          style={{ color: palette.ink }}
        />
      </span>
    </button>
  );
}

function GenreCollage({ art, rpdbKey }: { art: Meta[]; rpdbKey: string }) {
  if (art.length === 0) return null;
  return (
    <span aria-hidden className="absolute inset-0 grid grid-cols-3">
      {art.slice(0, 3).map((m, i) => (
        <span
          key={m.id}
          className="relative overflow-hidden"
          style={{ transform: `skewX(-8deg) translateX(${(i - 1) * 5}px)` }}
        >
          <Poster
            src={rpdbPoster(rpdbKey, m.id, m.background ?? m.poster)}
            seed={m.id}
            ratio="landscape"
            className="absolute inset-0 rounded-none [transform:skewX(8deg)_scale(1.4)]"
          />
        </span>
      ))}
    </span>
  );
}

function Results({
  status,
  metas,
  onOpenDetail,
}: {
  status: string;
  metas: Meta[];
  onOpenDetail: (m: Meta) => void;
}) {
  const t = useT();
  if (metas.length === 0) {
    if (status === "loading" || status === "typing") return <LoaderBlock />;
    return <EmptyState Icon={SearchIcon} text={t("No matches yet. Try another title.")} />;
  }
  return <Grid metas={metas} onOpenDetail={onOpenDetail} />;
}

function CatalogView({
  catalog,
  onBack,
  onOpenDetail,
}: {
  catalog: Catalog;
  onBack: () => void;
  onOpenDetail: (m: Meta) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-5">
      <BackBar title={catalog.title} onBack={onBack} />
      <div key={catalog.metas === null ? "loading" : "loaded"} className="ms-view-in">
        {catalog.metas === null ? (
          <LoaderBlock />
        ) : catalog.metas.length === 0 ? (
          <EmptyState Icon={Trophy} text={catalog.empty ?? t("Nothing to show here right now.")} />
        ) : (
          <Grid metas={catalog.metas} onOpenDetail={onOpenDetail} />
        )}
      </div>
    </div>
  );
}

function CollectionsBrowser({
  authKey,
  onBack,
  onOpenDetail,
}: {
  authKey: string | null;
  onBack: () => void;
  onOpenDetail: (m: Meta) => void;
}) {
  const t = useT();
  const [list, setList] = useState<Meta[] | null>(null);
  const [active, setActive] = useState<Meta | null>(null);
  const [members, setMembers] = useState<Meta[] | null>(null);

  useEffect(() => {
    let alive = true;
    setList(null);
    (async () => {
      try {
        const cats = await listBrowseCatalogs(authKey);
        const wanted = cats.filter((c) =>
          isCollectionCatalog({ type: c.type, id: c.id, name: c.name }),
        );
        const pages = await Promise.all(
          wanted.map((c) => browseFetcher(c, null)(1).catch(() => [] as Meta[])),
        );
        if (!alive) return;
        const seen = new Set<string>();
        const merged: Meta[] = [];
        for (const page of pages) {
          for (const m of page) {
            if (!m?.id || seen.has(m.id)) continue;
            seen.add(m.id);
            merged.push(m);
          }
        }
        setList(merged);
      } catch {
        if (alive) setList([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [authKey]);

  const openCollection = async (meta: Meta) => {
    setActive(meta);
    setMembers(null);
    try {
      setMembers(await loadCollectionMembers(meta));
    } catch {
      setMembers([]);
    }
  };

  if (active) {
    return (
      <div className="flex flex-col gap-5">
        <BackBar
          title={active.name}
          onBack={() => {
            setActive(null);
            setMembers(null);
          }}
        />
        <div
          key={`members:${active.id}:${members === null ? "loading" : "loaded"}`}
          className="ms-view-in"
        >
          {members === null ? (
            <LoaderBlock />
          ) : members.length === 0 ? (
            <EmptyState Icon={Layers} text={t("This collection has no titles to show yet.")} />
          ) : (
            <Grid metas={members} onOpenDetail={onOpenDetail} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <BackBar title={t("Collections")} onBack={onBack} />
      <div key={`list:${list === null ? "loading" : "loaded"}`} className="ms-view-in">
        {list === null ? (
          <LoaderBlock />
        ) : list.length === 0 ? (
          <EmptyState
            Icon={Layers}
            text={t("No collections yet. Add a collections addon to browse curated sets.")}
          />
        ) : (
          <div className="grid grid-cols-3 gap-x-3 gap-y-4">
            {list.map((m) => (
              <CollectionTile key={m.id} meta={m} onOpen={openCollection} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Grid({ metas, onOpenDetail }: { metas: Meta[]; onOpenDetail: (m: Meta) => void }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {metas.map((m) => (
        <GridTile key={m.id} meta={m} onOpenDetail={onOpenDetail} />
      ))}
    </div>
  );
}

function GridTile({ meta, onOpenDetail }: { meta: Meta; onOpenDetail: (m: Meta) => void }) {
  const { settings } = useSettings();
  const { snapshot } = useMobileRemote();
  const local = snapshot.library?.local?.some((item) => item.id === meta.id) ?? false;
  const providers = useMemo(() => {
    const found = snapshot.library?.mediaServers?.find((item) => item.id === meta.id);
    return found?.mediaServerProviders ?? [];
  }, [snapshot.library?.mediaServers, meta.id]);
  const { src, onError } = usePosterChain(
    settings.rpdbKey,
    meta.id,
    meta.poster,
    meta.type === "series" ? "series" : "movie",
  );
  return (
    <button
      type="button"
      onClick={() => onOpenDetail(meta)}
      className="text-start transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
    >
      <div className="relative overflow-hidden rounded-[12px]">
        <Poster
          src={src}
          onError={onError}
          seed={meta.id}
          ratio="portrait"
          lazy
          className="rounded-[12px]"
        />
        {(local || providers.length > 0) && (
          <span className="absolute end-1.5 top-1.5 flex items-center gap-1 rounded-lg bg-canvas/90 px-1.5 py-1 text-ink shadow-lg ring-1 ring-edge-soft backdrop-blur-md">
            {local && <LocalLibraryBrand className="h-4 w-4" />}
            {providers.map((provider) => (
              <MediaServerBrand
                key={provider}
                provider={provider as MediaServerProvider}
                name={provider}
                compact
              />
            ))}
          </span>
        )}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink-muted">
        {meta.name}
      </p>
    </button>
  );
}

function CollectionTile({ meta, onOpen }: { meta: Meta; onOpen: (m: Meta) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(meta)}
      className="text-start transition-transform duration-150 active:scale-[0.96] motion-reduce:transition-none"
    >
      <div className="relative overflow-hidden rounded-[12px] ring-1 ring-edge-soft">
        <Poster src={meta.poster} seed={meta.id} ratio="portrait" lazy />
        <span className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-lg bg-canvas/80 text-ink ring-1 ring-edge-soft">
          <Layers size={13} strokeWidth={2.2} />
        </span>
      </div>
      <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-snug text-ink-muted">
        {meta.name}
      </p>
    </button>
  );
}

function BackBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex items-center gap-1 self-start rounded-full bg-surface py-2 pe-4 ps-2.5 text-[14px] font-semibold text-ink ring-1 ring-edge-soft transition-transform duration-150 active:scale-[0.97] motion-reduce:transition-none"
    >
      <ChevronRight size={17} strokeWidth={2.6} className="rotate-180 text-ink-subtle" />
      <span className="line-clamp-1 max-w-[70vw]">{title}</span>
    </button>
  );
}

function EmptyState({ Icon, text }: { Icon: typeof SearchIcon; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 pt-20 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-surface text-ink-subtle ring-1 ring-edge-soft">
        <Icon size={24} strokeWidth={1.9} />
      </span>
      <p className="max-w-[250px] text-[14px] leading-relaxed text-ink-muted">{text}</p>
    </div>
  );
}

function LoaderBlock() {
  return (
    <div className="flex justify-center pt-24">
      <HarborLoader size="md" />
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[19px] font-medium tracking-tight text-ink">{children}</h2>
  );
}

type CollectionVideo = NonNullable<Meta["videos"]>[number];

function memberType(id: string, fallback: "movie" | "series"): MetaType {
  if (id.startsWith("tmdb:tv:")) return "series";
  if (id.startsWith("tmdb:movie:")) return "movie";
  if (/^(kitsu|mal|anilist|anidb):/.test(id)) return "anime";
  return fallback;
}

function videoToMeta(v: CollectionVideo, fallback: "movie" | "series"): Meta | null {
  if (!v.id) return null;
  const raw = v as Record<string, unknown>;
  const poster =
    typeof raw.poster === "string"
      ? raw.poster
      : typeof v.thumbnail === "string"
        ? v.thumbnail
        : undefined;
  return {
    id: v.id,
    type: memberType(v.id, fallback),
    name: v.name ?? v.title ?? v.id,
    poster,
    background: typeof raw.background === "string" ? raw.background : undefined,
    releaseInfo: typeof v.released === "string" ? v.released.slice(0, 4) : undefined,
  };
}

function dedupeMetas(metas: Meta[], excludeId: string): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    if (!m.id || m.id === excludeId || seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}

async function loadCollectionMembers(meta: Meta): Promise<Meta[]> {
  const fallback = meta.type === "series" ? "series" : "movie";
  const fromVideos = (m: Meta | null): Meta[] =>
    (m?.videos ?? []).map((v) => videoToMeta(v, fallback)).filter((x): x is Meta => x != null);
  let found = dedupeMetas(fromVideos(meta), meta.id);
  const base = meta.addonOrigin?.base;
  if (found.length === 0 && base) {
    const full = await fetchAddonMeta(base, meta.type, meta.id).catch(() => null);
    found = dedupeMetas(fromVideos(full), meta.id);
    if (found.length === 0) {
      const page = await fetchAddonCatalogPage(base, meta.type, meta.id, 0).catch(() => []);
      found = dedupeMetas(page, meta.id);
    }
  }
  return found;
}
