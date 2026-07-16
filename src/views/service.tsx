import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { PickCard } from "@/components/pick-card";
import { Row } from "@/components/row";
import { ServiceLogo } from "@/components/service-logo";
import { TopRankCard } from "@/components/top-rank-card";
import type { Meta } from "@/lib/cinemeta";
import { SERVICES, providerIdsFor } from "@/lib/providers/streaming";
import { safeFetch } from "@/lib/safe-fetch";
import { useSettings, type StreamingService } from "@/lib/settings";
import { useScrollMemory } from "@/lib/view";
import { useT } from "@/lib/i18n";

type Category = {
  id: string;
  label: string;
  fetchMovies: boolean;
  fetchTv: boolean;
  movieGenres: number[];
  tvGenres: number[];
};

const CATEGORIES: Category[] = [
  { id: "all", label: "All", fetchMovies: true, fetchTv: true, movieGenres: [], tvGenres: [] },
  {
    id: "movies",
    label: "Movies",
    fetchMovies: true,
    fetchTv: false,
    movieGenres: [],
    tvGenres: [],
  },
  { id: "tv", label: "TV Shows", fetchMovies: false, fetchTv: true, movieGenres: [], tvGenres: [] },
  {
    id: "docs",
    label: "Documentaries",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [99],
    tvGenres: [99],
  },
  {
    id: "anim",
    label: "Animation",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [16],
    tvGenres: [16],
  },
  {
    id: "kids",
    label: "Kids & Family",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [10751],
    tvGenres: [10751],
  },
  {
    id: "reality",
    label: "Reality",
    fetchMovies: false,
    fetchTv: true,
    movieGenres: [],
    tvGenres: [10764],
  },
  {
    id: "action",
    label: "Action",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [28],
    tvGenres: [10759],
  },
  {
    id: "comedy",
    label: "Comedy",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [35],
    tvGenres: [35],
  },
  {
    id: "drama",
    label: "Drama",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [18],
    tvGenres: [18],
  },
  {
    id: "horror",
    label: "Horror",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [27],
    tvGenres: [9648],
  },
  {
    id: "scifi",
    label: "Sci-Fi & Fantasy",
    fetchMovies: true,
    fetchTv: true,
    movieGenres: [878],
    tvGenres: [10765],
  },
  {
    id: "thriller",
    label: "Thriller",
    fetchMovies: true,
    fetchTv: false,
    movieGenres: [53],
    tvGenres: [],
  },
  {
    id: "romance",
    label: "Romance",
    fetchMovies: true,
    fetchTv: false,
    movieGenres: [10749],
    tvGenres: [],
  },
];

const MAX_PER_BUCKET = 200;

type Bucket = { movies: Meta[]; series: Meta[] };

export function ServiceView({ service }: { service: StreamingService }) {
  const t = useT();
  const { settings } = useSettings();
  const meta = SERVICES[service];
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [bucket, setBucket] = useState<Bucket>({ movies: [], series: [] });
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState(0);
  const [fetching, setFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory(`service:${service}`, scrollRef);

  useEffect(() => {
    setBucket({ movies: [], series: [] });
    setBatch(0);
    setLoading(true);
    setHasMore(true);
  }, [service, category.id, settings.tmdbKey, settings.region]);

  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    fetchCategoryBatch(settings.tmdbKey, providerIdsFor(meta), settings.region, category, batch)
      .then((b) => {
        if (cancelled) return;
        if (b.movies.length === 0 && b.series.length === 0) setHasMore(false);
        setBucket((prev) => {
          if (batch === 0) return { movies: b.movies, series: b.series };
          const movies = dedupe([...prev.movies, ...b.movies]);
          const series = dedupe([...prev.series, ...b.series]);
          return {
            movies: movies.slice(0, MAX_PER_BUCKET),
            series: series.slice(0, MAX_PER_BUCKET),
          };
        });
        setLoading(false);
        setFetching(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoading(false);
        setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, service, category.id, settings.tmdbKey, settings.region, meta]);

  useEffect(() => {
    if (bucket.movies.length >= MAX_PER_BUCKET && bucket.series.length >= MAX_PER_BUCKET) {
      setHasMore(false);
    }
  }, [bucket.movies.length, bucket.series.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (fetching || loading || !hasMore) return;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1200) {
        setBatch((b) => b + 1);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [fetching, loading, hasMore]);

  const merged = useMemo(() => {
    const all = [...bucket.movies, ...bucket.series];
    const seen = new Set<string>();
    return all.filter((m) => (seen.has(m.id) ? false : (seen.add(m.id), true)));
  }, [bucket]);

  return (
    <main ref={scrollRef} className="absolute inset-0 overflow-y-auto pb-14">
      <div className="relative px-12 pt-28 pb-12">
        <div
          aria-hidden
          className="harbor-bleed-stremio pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(ellipse 90% 100% at 30% 0%, ${meta.tint}38 0%, transparent 65%)`,
          }}
        />
        <div className="relative flex items-end justify-between gap-8">
          <div className="flex flex-col gap-3">
            <span className="text-[12.5px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
              {t("Popular on")}
            </span>
            <div className="flex h-16 items-center">
              <ServiceLogo service={service} height={56} />
            </div>
            <p className="max-w-xl text-[14.5px] leading-relaxed text-ink-muted">
              {t("The most-watched movies and series on {name} right now in {region}.", {
                name: meta.name,
                region: settings.region,
              })}
            </p>
          </div>
        </div>
      </div>

      <CategoryPills active={category} onChange={setCategory} />
      <CategoryFab active={category} onChange={setCategory} />

      <div className="px-12 pt-10">
        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-9">
            {Array.from({ length: 18 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[2/3] animate-pulse rounded-xl border border-edge-soft bg-elevated/30"
              />
            ))}
          </div>
        )}

        {!loading && category.id === "all" && (
          <div className="flex flex-col gap-12">
            {bucket.movies.length === 0 && bucket.series.length === 0 ? (
              <EmptyState hasKey={!!settings.tmdbKey} />
            ) : (
              <>
                {bucket.movies.length >= 10 ? (
                  <>
                    <Row
                      title={t("Top 10 Movies on {name}", { name: meta.name })}
                      min={180}
                      shape="rank"
                    >
                      {bucket.movies.slice(0, 10).map((m, i) => (
                        <TopRankCard key={m.id} meta={m} rank={i + 1} />
                      ))}
                    </Row>
                    {bucket.movies.length > 10 && (
                      <Row title={t("More Movies")}>
                        {bucket.movies.slice(10).map((m) => (
                          <PickCard key={m.id} meta={m} />
                        ))}
                      </Row>
                    )}
                  </>
                ) : bucket.movies.length > 0 ? (
                  <Row title={t("Movies on {name}", { name: meta.name })}>
                    {bucket.movies.map((m) => (
                      <PickCard key={m.id} meta={m} />
                    ))}
                  </Row>
                ) : null}
                {bucket.series.length >= 10 ? (
                  <>
                    <Row
                      title={t("Top 10 Series on {name}", { name: meta.name })}
                      min={180}
                      shape="rank"
                    >
                      {bucket.series.slice(0, 10).map((m, i) => (
                        <TopRankCard key={m.id} meta={m} rank={i + 1} />
                      ))}
                    </Row>
                    {bucket.series.length > 10 && (
                      <Row title={t("More Series")}>
                        {bucket.series.slice(10).map((m) => (
                          <PickCard key={m.id} meta={m} />
                        ))}
                      </Row>
                    )}
                  </>
                ) : bucket.series.length > 0 ? (
                  <Row title={t("Series on {name}", { name: meta.name })}>
                    {bucket.series.map((m) => (
                      <PickCard key={m.id} meta={m} />
                    ))}
                  </Row>
                ) : null}
              </>
            )}
          </div>
        )}

        {!loading && category.id !== "all" && (
          <>
            {merged.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-9">
                {merged.map((m) => (
                  <PickCard key={m.id} meta={m} />
                ))}
              </div>
            ) : (
              <EmptyState hasKey={!!settings.tmdbKey} />
            )}
          </>
        )}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function CategoryPills({
  active,
  onChange,
}: {
  active: Category;
  onChange: (c: Category) => void;
}) {
  const t = useT();
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canLeft: false, canRight: false });

  const recompute = useCallback(() => {
    const el = trackRef.current;
    if (!el) {
      setScrollState({ canLeft: false, canRight: false });
      return;
    }
    const maxScroll = el.scrollWidth - el.clientWidth;
    setScrollState({
      canLeft: el.scrollLeft > 4,
      canRight: maxScroll > 4 && el.scrollLeft < maxScroll - 4,
    });
  }, []);

  useLayoutEffect(() => {
    recompute();
  }, [recompute]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", recompute, { passive: true });
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", recompute);
      ro.disconnect();
    };
  }, [recompute]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLButtonElement>(`button[data-cat="${active.id}"]`);
    if (target) {
      target.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
    }
  }, [active.id]);

  const page = (dir: -1 | 1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(220, el.clientWidth * 0.6), behavior: "smooth" });
  };

  return (
    <div className="px-12 pt-8">
      <div className="group/pills relative">
        <div
          ref={trackRef}
          className="flex gap-2 overflow-x-auto scroll-smooth pb-1 [scroll-padding:0_24px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {CATEGORIES.map((c) => {
            const isActive = c.id === active.id;
            return (
              <button
                key={c.id}
                data-cat={c.id}
                onClick={() => onChange(c)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-[13.5px] font-medium transition-colors [scroll-snap-align:start] ${
                  isActive
                    ? "bg-ink text-canvas"
                    : "border border-edge-soft bg-canvas/40 text-ink-muted hover:bg-elevated hover:text-ink"
                }`}
              >
                {t(c.label)}
              </button>
            );
          })}
        </div>
        <EdgeFade side="left" visible={scrollState.canLeft} />
        <EdgeFade side="right" visible={scrollState.canRight} />
        <ScrollArrow side="left" visible={scrollState.canLeft} onClick={() => page(-1)} />
        <ScrollArrow side="right" visible={scrollState.canRight} onClick={() => page(1)} />
      </div>
    </div>
  );
}

function ScrollArrow({
  side,
  visible,
  onClick,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      aria-label={side === "left" ? t("Scroll filters left") : t("Scroll filters right")}
      onClick={onClick}
      className={`absolute top-1/2 -translate-y-1/2 ${side === "left" ? "left-0 -translate-x-1/3" : "right-0 translate-x-1/3"} z-20 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/85 text-ink shadow-[0_8px_24px_-6px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all duration-200 hover:bg-canvas focus:outline-none ${
        visible
          ? "opacity-0 group-hover/pills:opacity-100 pointer-events-auto"
          : "pointer-events-none opacity-0"
      }`}
    >
      {side === "left" ? (
        <ChevronLeft size={16} strokeWidth={2.4} />
      ) : (
        <ChevronRight size={16} strokeWidth={2.4} />
      )}
    </button>
  );
}

function EdgeFade({ side, visible }: { side: "left" | "right"; visible: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-y-0 z-10 w-12 transition-opacity duration-200 ${
        side === "left"
          ? "left-0 bg-gradient-to-r from-canvas to-transparent"
          : "right-0 bg-gradient-to-l from-canvas to-transparent"
      } ${visible ? "opacity-100" : "opacity-0"}`}
    />
  );
}

function CategoryFab({ active, onChange }: { active: Category; onChange: (c: Category) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest("[data-filter-fab]")) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div data-filter-fab className="fixed bottom-16 end-5 z-40">
      {open && (
        <div className="absolute bottom-full end-0 mb-2 max-h-[60vh] w-44 overflow-y-auto rounded-2xl border border-edge-soft/60 bg-canvas py-1.5 shadow-2xl">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
              className={`block w-full px-4 py-2 text-start text-[13.5px] transition-colors ${
                c.id === active.id
                  ? "bg-ink/10 text-ink"
                  : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
              }`}
            >
              {t(c.label)}
            </button>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-md border border-edge-soft/40 bg-canvas/90 px-2.5 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
      >
        <SlidersHorizontal size={12} strokeWidth={2.2} />
        {t(active.label)}
      </button>
    </div>
  );
}

function EmptyState({ hasKey }: { hasKey: boolean }) {
  const t = useT();
  return (
    <div className="rounded-2xl border border-dashed border-edge px-6 py-16 text-center text-[14px] text-ink-muted">
      {hasKey
        ? t("Nothing matched this filter. Try another category or change your region in Settings.")
        : t("Add a TMDB key in Settings → Library to power this view.")}
    </div>
  );
}

const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const PAGE_BATCH = 5;

async function fetchPage(
  key: string,
  kind: "movie" | "tv",
  providerIds: string,
  region: string,
  page: number,
  genres: number[],
): Promise<any[]> {
  const params = new URLSearchParams({
    api_key: key,
    with_watch_providers: providerIds,
    watch_region: region,
    with_watch_monetization_types: "flatrate|free|ads",
    sort_by: "popularity.desc",
    include_adult: "false",
    page: String(page),
  });
  if (genres.length > 0) params.set("with_genres", genres.join(","));
  const url = `${TMDB}/discover/${kind}?${params.toString()}`;
  try {
    const res = await safeFetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return json.results ?? [];
  } catch (e) {
    console.warn("[service] fetchPage failed", { kind, providerIds, region, page, error: e });
    return [];
  }
}

async function fetchCategoryBatch(
  key: string,
  providerIds: string,
  region: string,
  cat: Category,
  batch: number,
): Promise<Bucket> {
  if (!key) return { movies: [], series: [] };
  const startPage = batch * PAGE_BATCH + 1;
  const pages = Array.from({ length: PAGE_BATCH }, (_, i) => startPage + i);
  const moviePromise: Promise<any[][]> = cat.fetchMovies
    ? Promise.all(
        pages.map((p) => fetchPage(key, "movie", providerIds, region, p, cat.movieGenres)),
      )
    : Promise.resolve([]);
  const tvPromise: Promise<any[][]> = cat.fetchTv
    ? Promise.all(pages.map((p) => fetchPage(key, "tv", providerIds, region, p, cat.tvGenres)))
    : Promise.resolve([]);
  const [movieResults, tvResults] = await Promise.all([moviePromise, tvPromise]);
  const movieRaw = movieResults.flat().filter((m: any) => m.poster_path);
  const tvRaw = tvResults.flat().filter((s: any) => s.poster_path);
  const movies: Meta[] = movieRaw.map((m: any) => ({
    id: `tmdb:movie:${m.id}`,
    type: "movie" as const,
    name: m.title,
    poster: `${IMG}/w342${m.poster_path}`,
    background: m.backdrop_path ? `${IMG}/w780${m.backdrop_path}` : undefined,
    description: m.overview,
    releaseInfo: m.release_date?.slice(0, 4),
    releaseDate: m.release_date,
    imdbRating: m.vote_average > 0 ? Number(m.vote_average).toFixed(1) : undefined,
  }));
  const series: Meta[] = tvRaw.map((s: any) => ({
    id: `tmdb:tv:${s.id}`,
    type: "series" as const,
    name: s.name,
    poster: `${IMG}/w342${s.poster_path}`,
    background: s.backdrop_path ? `${IMG}/w780${s.backdrop_path}` : undefined,
    description: s.overview,
    releaseInfo: s.first_air_date?.slice(0, 4),
    releaseDate: s.first_air_date,
    imdbRating: s.vote_average > 0 ? Number(s.vote_average).toFixed(1) : undefined,
  }));
  return { movies: dedupe(movies), series: dedupe(series) };
}

function dedupe(metas: Meta[]): Meta[] {
  const seen = new Set<string>();
  const out: Meta[] = [];
  for (const m of metas) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push(m);
  }
  return out;
}
