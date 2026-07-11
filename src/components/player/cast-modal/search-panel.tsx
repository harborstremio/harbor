import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { tmdbTrending } from "@/lib/providers/tmdb/tmdb-catalogs";
import { searchAll, type AnimeHit, type SearchResults } from "@/lib/search";
import { Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PeopleRail, PosterRail, RailSection, RailSkeleton, type Person } from "./rails";

function animeToMeta(a: AnimeHit): Meta {
  return {
    id: a.kitsuId ? `kitsu:${a.kitsuId}` : `mal:${a.malId}`,
    type: "series",
    name: a.name,
    poster: a.poster ?? undefined,
    background: a.background ?? undefined,
    releaseInfo: a.year ?? undefined,
    imdbRating: a.score > 0 ? a.score.toFixed(1) : undefined,
  };
}

export function SearchPanel({
  tmdbKey,
  onOpenTitle,
  onOpenPerson,
}: {
  tmdbKey: string | null;
  onOpenTitle: (m: Meta) => void;
  onOpenPerson: (id: number, name: string) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState<{ movies: Meta[]; series: Meta[] } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!tmdbKey) return;
    let cancelled = false;
    Promise.all([tmdbTrending(tmdbKey, "movie", "week"), tmdbTrending(tmdbKey, "tv", "week")])
      .then(([m, s]) => {
        if (!cancelled) setTrending({ movies: m.slice(0, 10), series: s.slice(0, 10) });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tmdbKey]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchAll(tmdbKey ?? "", q)
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, tmdbKey]);

  const movies = results?.movies ?? [];
  const series = results?.series ?? [];
  const animeMetas = (results?.anime ?? []).map(animeToMeta);
  const people: Person[] = (results?.people ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    role: p.knownFor,
    profilePath: p.profile,
  }));
  const hasResults = movies.length + series.length + animeMetas.length + people.length > 0;

  return (
    <div className="flex flex-col gap-6 px-6 pb-8 pt-1 sm:px-8">
      <div className="relative">
        <SearchIcon
          size={18}
          strokeWidth={2.2}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Search movies, shows, people...")}
          className="w-full rounded-full bg-white/[0.07] py-3.5 pl-11 pr-11 text-[15px] text-white outline-none ring-1 ring-white/12 transition-shadow placeholder:text-white/40 focus:ring-2 focus:ring-white/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={t("Clear")}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} strokeWidth={2.3} />
          </button>
        )}
      </div>

      {!query.trim() ? (
        trending && (trending.movies.length > 0 || trending.series.length > 0) ? (
          <>
            {trending.movies.length > 0 && (
              <RailSection label={t("Trending movies")}>
                <PosterRail items={trending.movies} onOpen={onOpenTitle} />
              </RailSection>
            )}
            {trending.series.length > 0 && (
              <RailSection label={t("Trending shows")}>
                <PosterRail items={trending.series} onOpen={onOpenTitle} />
              </RailSection>
            )}
          </>
        ) : (
          <p className="px-1 text-[13.5px] leading-relaxed text-white/50">
            {t("Find a movie, show, or person and jump straight to it without leaving the player.")}
          </p>
        )
      ) : loading && !hasResults ? (
        <RailSection label={t("Searching")}>
          <RailSkeleton />
        </RailSection>
      ) : !hasResults ? (
        <p className="px-1 text-[13.5px] text-white/50">{t("No results found.")}</p>
      ) : (
        <>
          {movies.length > 0 && (
            <RailSection label={t("Movies")}>
              <PosterRail items={movies} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {series.length > 0 && (
            <RailSection label={t("Shows")}>
              <PosterRail items={series} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {animeMetas.length > 0 && (
            <RailSection label={t("Anime")}>
              <PosterRail items={animeMetas} onOpen={onOpenTitle} />
            </RailSection>
          )}
          {people.length > 0 && (
            <RailSection label={t("People")}>
              <PeopleRail people={people} onOpen={(p) => onOpenPerson(p.id, p.name)} />
            </RailSection>
          )}
        </>
      )}
    </div>
  );
}
