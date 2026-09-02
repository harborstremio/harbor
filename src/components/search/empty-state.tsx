import { ArrowLeft, Loader2, Shuffle, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AddonsIcon } from "@/components/icons/addons-icon";
import { AnimeIcon } from "@/components/icons/anime-icon";
import { CalendarIcon } from "@/components/icons/calendar-icon";
import { DiscoverIcon } from "@/components/icons/discover-icon";
import { HomeIcon } from "@/components/icons/home-icon";
import { LibraryIcon } from "@/components/icons/library-icon";
import { LiveTvIcon } from "@/components/icons/live-tv-icon";
import { MoviesIcon } from "@/components/icons/movies-icon";
import { TvIcon } from "@/components/icons/tv-icon";
import { NavGlyph } from "@/components/icons/nav-glyph";
import { MOVIE_GENRES } from "@/lib/feed/tags";

const TV_GENRE_FOR_MOVIE: Record<string, number> = {
  Action: 10759,
  Adventure: 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Fantasy: 10765,
  Mystery: 9648,
  "Sci-Fi": 10765,
  War: 10768,
  Family: 10751,
};
import { useParental } from "@/lib/parental";
import { useT } from "@/lib/i18n";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";
import { surpriseMe } from "@/lib/surprise-me";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { SERVICES, providerIdsFor } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";
import { useView, type View } from "@/lib/view";
import type { LockableTab } from "@/lib/lockable-tabs";
import { topMovies, topSeries, type Meta } from "@/lib/cinemeta";
import { PickCard } from "@/components/pick-card";

type Jump = {
  view: View;
  label: string;
  parentalKey: LockableTab;
  icon: React.ReactNode;
};

const JUMP_TARGETS: Jump[] = [
  { view: "home", label: "Home", parentalKey: "discover", icon: <HomeIcon /> },
  { view: "discover", label: "Discover", parentalKey: "discover", icon: <DiscoverIcon /> },
  { view: "movies", label: "Movies", parentalKey: "movies", icon: <MoviesIcon /> },
  { view: "shows", label: "Shows", parentalKey: "shows", icon: <TvIcon /> },
  { view: "anime", label: "Anime", parentalKey: "anime", icon: <AnimeIcon /> },
  { view: "live", label: "Live TV", parentalKey: "liveTv", icon: <LiveTvIcon /> },
  { view: "calendar", label: "Calendar", parentalKey: "calendar", icon: <CalendarIcon /> },
  { view: "library", label: "My Library", parentalKey: "library", icon: <LibraryIcon /> },
  { view: "addons", label: "Addons", parentalKey: "addons", icon: <AddonsIcon /> },
];

type FilterTab = "all" | "movies" | "shows" | StreamingService;

const MAX_PAGES = 25;

export function EmptyState({ onClose, onOpenGuide }: { onClose: () => void; onOpenGuide: () => void }) {
  const { recent, removeRecent, clearRecent, setQuery } = useSearch();
  const { setView, openMeta } = useView();
  const { hiddenTabs } = useParental();
  const { settings } = useSettings();
  const t = useT();
  const [surpriseBusy, setSurpriseBusy] = useState(false);
  const [genreBrowse, setGenreBrowse] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [items, setItems] = useState<Meta[]>([]);
  const [moviePage, setMoviePage] = useState(1);
  const [tvPage, setTvPage] = useState(1);
  const [movieDone, setMovieDone] = useState(false);
  const [tvDone, setTvDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const seenRef = useRef<Set<string>>(new Set());
  const fetchRef = useRef<AbortController | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const enabledServices: StreamingService[] = useMemo(
    () =>
      (Object.keys(settings.streaming) as StreamingService[]).filter((s) => settings.streaming[s]),
    [settings.streaming],
  );

  const movieId = genreBrowse ? MOVIE_GENRES[genreBrowse] : undefined;
  const tvId = genreBrowse ? TV_GENRE_FOR_MOVIE[genreBrowse] : undefined;
  const isServiceTab = filterTab !== "all" && filterTab !== "movies" && filterTab !== "shows";
  const wantMovies = filterTab === "all" || filterTab === "movies" || isServiceTab;
  const wantSeries = filterTab === "all" || filterTab === "shows" || isServiceTab;

  const servicePart = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    if (isServiceTab) {
      out.with_watch_providers = providerIdsFor(SERVICES[filterTab as StreamingService]);
      out.watch_region = settings.region || "US";
      out.with_watch_monetization_types = "flatrate|free|ads";
    }
    return out;
  }, [filterTab, isServiceTab, settings.region]);

  useEffect(() => {
    fetchRef.current?.abort();
    fetchRef.current = null;
    seenRef.current = new Set();
    setItems([]);
    setMoviePage(1);
    setTvPage(1);
    setMovieDone(false);
    setTvDone(false);
    setLoading(false);
  }, [genreBrowse, filterTab]);

  const loadMore = useCallback(async () => {
    if (!genreBrowse) return;
    if (loading) return;
    const cinemetaOnly = !settings.tmdbKey;
    const needMovies = wantMovies && !movieDone && moviePage <= MAX_PAGES && (cinemetaOnly || typeof movieId === "number");
    const needSeries = wantSeries && !tvDone && tvPage <= MAX_PAGES && (cinemetaOnly || typeof tvId === "number");
    if (!needMovies && !needSeries) return;
    setLoading(true);
    fetchRef.current?.abort();
    const ac = new AbortController();
    fetchRef.current = ac;
    const cinemetaMovieSkip = (moviePage - 1) * 100;
    const cinemetaTvSkip = (tvPage - 1) * 100;
    const [movieRes, tvRes] = await Promise.all([
      needMovies
        ? cinemetaOnly
          ? topMovies(genreBrowse, cinemetaMovieSkip).catch(() => [] as Meta[])
          : tmdbDiscover(settings.tmdbKey, "movie", {
              with_genres: String(movieId),
              sort_by: "popularity.desc",
              "vote_count.gte": "200",
              page: String(moviePage),
              ...servicePart,
            }).catch(() => [] as Meta[])
        : Promise.resolve([] as Meta[]),
      needSeries
        ? cinemetaOnly
          ? topSeries(genreBrowse, cinemetaTvSkip).catch(() => [] as Meta[])
          : tmdbDiscover(settings.tmdbKey, "tv", {
              with_genres: String(tvId),
              sort_by: "popularity.desc",
              "vote_count.gte": "100",
              page: String(tvPage),
              ...servicePart,
            }).catch(() => [] as Meta[])
        : Promise.resolve([] as Meta[]),
    ]);
    if (ac.signal.aborted) return;
    const fresh: Meta[] = [];
    const push = (m: Meta | undefined) => {
      if (!m || !m.poster) return;
      if (seenRef.current.has(m.id)) return;
      seenRef.current.add(m.id);
      fresh.push(m);
    };
    if (filterTab === "movies") {
      for (const m of movieRes) push(m);
    } else if (filterTab === "shows") {
      for (const m of tvRes) push(m);
    } else {
      const maxLen = Math.max(movieRes.length, tvRes.length);
      for (let i = 0; i < maxLen; i++) {
        push(movieRes[i]);
        push(tvRes[i]);
      }
    }
    setItems((prev) => prev.concat(fresh));
    if (needMovies) {
      setMoviePage((p) => p + 1);
      if (movieRes.length === 0) setMovieDone(true);
    }
    if (needSeries) {
      setTvPage((p) => p + 1);
      if (tvRes.length === 0) setTvDone(true);
    }
    if (moviePage >= MAX_PAGES) setMovieDone(true);
    if (tvPage >= MAX_PAGES) setTvDone(true);
    setLoading(false);
  }, [
    genreBrowse,
    settings.tmdbKey,
    loading,
    wantMovies,
    wantSeries,
    movieId,
    tvId,
    movieDone,
    tvDone,
    moviePage,
    tvPage,
    servicePart,
    filterTab,
  ]);

  useEffect(() => {
    if (!genreBrowse) return;
    if (items.length > 0) return;
    void loadMore();
  }, [genreBrowse, filterTab, items.length, loadMore]);

  useEffect(() => {
    if (!genreBrowse) return;
    const el = sentinelRef.current;
    if (!el) return;
    const exhausted = (!wantMovies || movieDone) && (!wantSeries || tvDone);
    if (exhausted) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [genreBrowse, items.length, loadMore, movieDone, tvDone, wantMovies, wantSeries]);

  const exhausted =
    items.length > 0 &&
    (!wantMovies || movieDone) &&
    (!wantSeries || tvDone);

  const visibleJumps = JUMP_TARGETS.filter((j) => !hiddenTabs[j.parentalKey]);
  const visibleGenres = Object.keys(MOVIE_GENRES).filter((name) => {
    if (hiddenTabs.anime && name === "Animation") return false;
    return true;
  });

  const onSurprise = async () => {
    if (surpriseBusy) return;
    setSurpriseBusy(true);
    try {
      const exclude: number[] = [];
      if (hiddenTabs.anime) exclude.push(MOVIE_GENRES.Animation);
      const pick = await surpriseMe(settings.tmdbKey, { excludeGenres: exclude });
      if (pick) {
        onClose();
        openMeta(pick);
      }
    } finally {
      setSurpriseBusy(false);
    }
  };

  if (genreBrowse) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setGenreBrowse(null);
              setItems([]);
              setFilterTab("all");
            }}
            className="flex h-9 items-center gap-1.5 rounded-full border border-edge-soft px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <ArrowLeft size={13} strokeWidth={2.4} className="dir-icon" />
            {t("Back")}
          </button>
          <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
            {t("Browsing")}
          </span>
          <h3 className="font-display text-[22px] font-medium tracking-tight text-ink">
            {genreBrowse}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <FilterPill active={filterTab === "all"} onClick={() => setFilterTab("all")}>
            {t("All")}
          </FilterPill>
          <FilterPill active={filterTab === "movies"} onClick={() => setFilterTab("movies")}>
            {t("Movies")}
          </FilterPill>
          <FilterPill active={filterTab === "shows"} onClick={() => setFilterTab("shows")}>
            {t("Shows")}
          </FilterPill>
          {enabledServices.length > 0 && (
            <span className="mx-1 h-5 w-px bg-edge-soft" aria-hidden />
          )}
          {enabledServices.map((s) => {
            const svc = SERVICES[s];
            return (
              <FilterPill
                key={s}
                active={filterTab === s}
                onClick={() => setFilterTab(s)}
                accent={svc.tint}
              >
                {svc.name}
              </FilterPill>
            );
          })}
        </div>

        {items.length === 0 && loading ? (
          <div className="flex items-center justify-center py-16 text-ink-subtle">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-edge px-4 py-8 text-center text-[13px] text-ink-subtle">
            {t("No titles found for {genre}", { genre: genreBrowse })}
            {isServiceTab ? ` on ${SERVICES[filterTab as StreamingService].name}` : ""}.{" "}
            {!settings.tmdbKey && isServiceTab && t("Service-specific browsing needs a TMDB key. Pick All / Movies / Shows to browse via Cinemeta.")}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
              {items.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    openMeta(m);
                  }}
                  className="block min-w-0 text-start"
                >
                  <PickCard meta={m} />
                </button>
              ))}
            </div>
            <div ref={sentinelRef} className="h-px w-full" aria-hidden />
            {loading && (
              <div className="flex items-center justify-center py-6 text-ink-subtle">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {exhausted && (
              <p className="pt-2 text-center text-[11.5px] text-ink-subtle">
                {t("You've reached the end · {count} titles", { count: items.length })}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10 pt-1">
      {recent.length > 0 && (
        <section>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
              {t("Recent searches")}
            </h3>
            <button
              type="button"
              onClick={clearRecent}
              className="text-[11.5px] font-medium uppercase tracking-[0.14em] text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Clear history")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((q) => (
              <span
                key={q}
                className="group inline-flex items-center gap-1 rounded-full border border-edge-soft bg-elevated/60 ps-3.5 pe-1.5 text-[13.5px] text-ink-muted transition-colors hover:border-edge hover:text-ink"
              >
                <button onClick={() => setQuery(q)} className="h-10 py-2 pe-1">
                  {q}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeRecent(q);
                  }}
                  aria-label={t("Remove {name}", { name: q })}
                  className="ms-0.5 flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
                >
                  <X size={12} strokeWidth={2.4} />
                </button>
              </span>
            ))}
          </div>
        </section>
      )}

      <section>
        <Title>{t("Jump to")}</Title>
        <div className="flex flex-wrap gap-2">
          {visibleJumps.map((j) => (
            <button
              key={j.view}
              onClick={() => {
                setView(j.view);
                onClose();
              }}
              className="group flex h-12 items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/50 px-5 text-[14.5px] font-semibold text-ink transition-all hover:border-edge hover:bg-elevated active:scale-[0.97]"
            >
              <span className="flex h-5 w-5 items-center justify-center text-ink-muted transition-colors group-hover:text-accent">{j.icon}</span>
              {t(j.label)}
            </button>
          ))}
          {!hiddenTabs.liveTv && (
            <button
              onClick={() => onOpenGuide()}
              className="group flex h-12 items-center gap-2.5 rounded-full border border-edge-soft bg-elevated/50 px-5 text-[14.5px] font-semibold text-ink transition-all hover:border-edge hover:bg-elevated active:scale-[0.97]"
            >
              <span className="flex h-5 w-5 items-center justify-center text-ink-muted transition-colors group-hover:text-accent">
                <NavGlyph name="guide" className="h-[22px] w-[22px]" />
              </span>
              {t("TV Guide")}
            </button>
          )}
        </div>
      </section>

      <section>
        <Title>{t("Try a genre")}</Title>
        <div className="flex flex-wrap gap-2">
          {visibleGenres.map((name) => (
            <button
              key={name}
              onClick={() => setGenreBrowse(name)}
              className="h-10 rounded-full border border-edge-soft bg-elevated/40 px-4 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
            >
              {name}
            </button>
          ))}
        </div>
      </section>

      <section className="flex justify-center pb-1 pt-2">
        <button
          type="button"
          onClick={onSurprise}
          disabled={surpriseBusy}
          className="group inline-flex h-11 items-center gap-2.5 rounded-full border border-edge-soft px-6 text-[13.5px] font-semibold text-ink-muted transition-colors hover:border-accent/50 hover:text-ink active:scale-[0.97] disabled:opacity-60"
        >
          <Shuffle
            size={14}
            strokeWidth={2}
            className={`transition-[transform,color] duration-300 group-hover:text-accent ${surpriseBusy ? "animate-spin" : "group-hover:rotate-[18deg]"}`}
          />
          {surpriseBusy ? t("Picking…") : t("Surprise me")}
        </button>
      </section>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  accent,
  children,
}: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full border px-3.5 text-[12px] font-semibold transition-all ${
        active
          ? "border-ink bg-ink text-canvas"
          : "border-edge-soft bg-elevated/40 text-ink-muted hover:border-edge hover:text-ink"
      }`}
      style={active && accent ? { background: accent, borderColor: accent, color: "white" } : undefined}
    >
      {children}
    </button>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-ink-subtle">
      {children}
    </h3>
  );
}
