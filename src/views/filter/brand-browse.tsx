import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PickCard } from "@/components/pick-card";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import type { Meta } from "@/lib/cinemeta";
import { tmdbDiscover } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { type MetaFilter } from "@/lib/view";

type Sort = "popular" | "rated" | "newest" | "oldest";

const SORTS: Array<{ id: Sort; label: string; by: string; floor: string }> = [
  { id: "popular", label: "Popular", by: "popularity.desc", floor: "20" },
  { id: "rated", label: "Top rated", by: "vote_average.desc", floor: "200" },
  { id: "newest", label: "Newest", by: "primary_release_date.desc", floor: "5" },
  { id: "oldest", label: "Oldest", by: "primary_release_date.asc", floor: "5" },
];

const DECADES = [2020, 2010, 2000, 1990, 1980, 1970];

function dateKeys(mediaType: "movie" | "tv"): { gte: string; lte: string; sortDate: string } {
  return mediaType === "movie"
    ? { gte: "primary_release_date.gte", lte: "primary_release_date.lte", sortDate: "primary_release_date" }
    : { gte: "first_air_date.gte", lte: "first_air_date.lte", sortDate: "first_air_date" };
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} className={`brand-chip ${on ? "is-on" : ""}`}>
      {children}
    </button>
  );
}

export function BrandBrowse({ filter }: { filter: MetaFilter & { id: number; name: string } }) {
  const t = useT();
  const { settings } = useSettings();
  const mediaType = filter.mediaType;
  const [sort, setSort] = useState<Sort>("popular");
  const [genre, setGenre] = useState<number | null>(null);
  const [decade, setDecade] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<Meta[] | null>(null);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(false);
  const busy = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const key = filter.kind === "network" ? "with_networks" : "with_companies";
  const params = useMemo(() => {
    const spec = SORTS.find((s) => s.id === sort) ?? SORTS[0];
    const d = dateKeys(mediaType);
    const by = sort === "newest" || sort === "oldest" ? `${d.sortDate}.${sort === "newest" ? "desc" : "asc"}` : spec.by;
    const p: Record<string, string> = {
      [key]: String(filter.id),
      sort_by: by,
      "vote_count.gte": spec.floor,
    };
    if (genre !== null) p.with_genres = String(genre);
    if (decade !== null) {
      p[d.gte] = `${decade}-01-01`;
      p[d.lte] = `${decade + 9}-12-31`;
    }
    return p;
  }, [key, filter.id, sort, genre, decade, mediaType]);

  useEffect(() => {
    setItems(null);
    setPage(1);
    setDone(false);
  }, [params, mediaType]);

  const load = useCallback(
    (next: number) => {
      if (!settings.tmdbKey || busy.current || done) return;
      busy.current = true;
      void tmdbDiscover(settings.tmdbKey, mediaType, { ...params, page: String(next) })
        .then((res) => {
          setItems((prev) => {
            const seen = new Set((prev ?? []).map((m) => m.id));
            return [...(prev ?? []), ...res.filter((m) => !seen.has(m.id))];
          });
          setPage(next);
          if (res.length < 20) setDone(true);
        })
        .catch(() => setDone(true))
        .finally(() => {
          busy.current = false;
        });
    },
    [settings.tmdbKey, mediaType, params, done],
  );

  useEffect(() => {
    if (items === null) load(1);
  }, [items, load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) load(page + 1);
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [load, page]);

  const genres = mediaType === "movie" ? MOVIE_GENRES : TV_GENRES;
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !items) return items;
    return items.filter((m) => (m.name ?? "").toLowerCase().includes(q));
  }, [items, query]);

  return (
    <section className="flex flex-col gap-6">
      <span className="flex flex-col">
        <span className="text-[20px] font-medium tracking-tight text-ink">
          {t("Everything from {name}", { name: filter.name })}
        </span>
        <span className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-subtle">
          {t("Filter, sort and search the full catalogue")}
        </span>
      </span>
      <div className="brand-toolbar">
        <div className="brand-toolbar-line">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search {name}", { name: filter.name })}
            className="brand-search"
          />
        </div>
        <div className="brand-toolbar-line">
          {SORTS.map((s) => (
            <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
              {t(s.label)}
            </Chip>
          ))}
          <span className="brand-divider" />
          {DECADES.map((d) => (
            <Chip key={d} on={decade === d} onClick={() => setDecade(decade === d ? null : d)}>
              {`${d}s`}
            </Chip>
          ))}
        </div>
        <div className="brand-toolbar-line">
          {Object.entries(genres)
            .slice(0, 12)
            .map(([name, id]) => (
              <Chip key={name} on={genre === id} onClick={() => setGenre(genre === id ? null : id)}>
                {t(name)}
              </Chip>
            ))}
        </div>
      </div>

      {shown && shown.length === 0 && (
        <p className="text-[15px] text-ink-muted">{t("Nothing matches those filters yet.")}</p>
      )}

      <div className="brand-grid">
        {(shown ?? Array.from({ length: 18 }).map(() => null)).map((m, i) =>
          m ? (
            <PickCard key={m.id} meta={m} />
          ) : (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-xl bg-elevated/40" />
          ),
        )}
      </div>
      <div ref={sentinel} className="h-px w-full" />
    </section>
  );
}
