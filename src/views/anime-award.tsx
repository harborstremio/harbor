import { BackToTop } from "@/components/back-to-top";
import { readAnimeAwardSource, type AnimeAwardCategory, type AwardSourceId } from "@/lib/anime-awards";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { ArrowUpRight, Search, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const SOURCE_TINTS: Record<AwardSourceId, string> = {
  crunchyroll: "#f47521",
  taaf: "#e91e63",
  jmaf: "#c41e3a",
  r_anime: "#ff4500",
  animation_kobe: "#8a6a3b",
};

export function AnimeAwardView({ sourceId }: { sourceId: AwardSourceId }) {
  const t = useT();
  const data = useMemo(() => readAnimeAwardSource(sourceId), [sourceId]);
  const scrollRef = useRef<HTMLElement>(null);
  const [year, setYear] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    setYear(null);
    setQuery("");
  }, [sourceId]);

  const tint = SOURCE_TINTS[sourceId] ?? "#E8AA6C";
  const totalWins = data.categories.reduce((n, c) => n + c.winners.length, 0);

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.categories
      .map((c) => ({
        ...c,
        winners: c.winners.filter((w) => {
          if (year !== null && w.year !== year) return false;
          if (q && !w.title.toLowerCase().includes(q) && !c.name.toLowerCase().includes(q)) {
            return false;
          }
          return true;
        }),
      }))
      .filter((c) => c.winners.length > 0);
  }, [data.categories, year, query]);

  const filtered = year !== null || query.trim().length > 0;
  const noResults = filtered && filteredCategories.length === 0;

  return (
    <main ref={scrollRef} className="relative h-full overflow-y-auto bg-canvas">
      <Banner data={data} tint={tint} totalWins={totalWins} />

      <div className="relative mx-auto flex max-w-[1100px] flex-col gap-10 px-12 pb-32 pt-12">
        {data.categories.length === 0 ? (
          <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-6 text-[14px] leading-relaxed text-ink-muted">
            {t("No data shipped for this award yet.")}
          </p>
        ) : (
          <>
            <FilterBar year={year} years={data.years} onYear={setYear} query={query} onQuery={setQuery} tint={tint} />

            {noResults && (
              <p className="rounded-2xl border border-edge-soft bg-elevated/30 p-5 text-[13.5px] text-ink-muted">
                {t("No winners match these filters.")}{" "}
                <button
                  type="button"
                  onClick={() => {
                    setYear(null);
                    setQuery("");
                  }}
                  className="text-ink underline-offset-4 hover:underline"
                >
                  {t("Clear filters")}
                </button>
              </p>
            )}

            <div className="flex flex-col gap-12">
              {filteredCategories.map((c) => (
                <CategoryBlock key={c.key} category={c} tint={tint} />
              ))}
            </div>
          </>
        )}
      </div>

      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}

function Banner({
  data,
  tint,
  totalWins,
}: {
  data: ReturnType<typeof readAnimeAwardSource>;
  tint: string;
  totalWins: number;
}) {
  const t = useT();
  const yearSpan =
    data.years.length === 0
      ? ""
      : data.years.length === 1
        ? String(data.years[0])
        : `${data.years[data.years.length - 1]}–${data.years[0]}`;
  return (
    <section className="harbor-bleed-stremio relative overflow-hidden border-b border-edge-soft">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 20% 0%, ${tint}22 0%, transparent 60%), radial-gradient(ellipse 70% 50% at 80% 100%, ${tint}14 0%, transparent 65%), var(--color-canvas)`,
        }}
      />
      <div className="relative mx-auto flex max-w-[1100px] flex-col gap-6 px-12 pb-12 pt-32 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-[640px] flex-col gap-3">
          <span
            className="flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-[0.22em]"
            style={{ borderColor: `${tint}55`, color: tint }}
          >
            <Trophy size={11} strokeWidth={2.6} />
            {t("Anime award")}
          </span>
          <h1
            className="font-display text-[52px] font-medium leading-[0.98] tracking-tight text-ink"
            style={{ textWrap: "balance" }}
          >
            {data.meta.name}
          </h1>
          <p className="text-[14px] font-semibold uppercase tracking-[0.18em]" style={{ color: tint }}>
            <span className="text-ink">{totalWins.toLocaleString()}</span> {t("recorded winners")} ·{" "}
            <span className="text-ink">{data.categories.length}</span>{" "}
            {data.categories.length === 1 ? t("category") : t("categories")}
            {yearSpan && (
              <>
                {" "}
                · <span className="text-ink">{yearSpan}</span>
              </>
            )}
          </p>
        </div>
        <img
          src={data.meta.icon}
          alt=""
          draggable={false}
          className="anime-award-banner-logo h-20 w-auto max-w-[280px] shrink-0 object-contain opacity-90"
        />
      </div>
    </section>
  );
}

function FilterBar({
  year,
  years,
  onYear,
  query,
  onQuery,
  tint,
}: {
  year: number | null;
  years: number[];
  onYear: (y: number | null) => void;
  query: string;
  onQuery: (s: string) => void;
  tint: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-edge-soft bg-elevated/15 p-3">
      <div className="flex flex-1 items-center gap-2 rounded-xl bg-canvas/40 px-3.5 py-2.5">
        <Search size={15} strokeWidth={2.2} className="text-ink-subtle" />
        <input
          type="text"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={t("Search winners or categories…")}
          className="min-w-0 flex-1 bg-transparent text-[13.5px] text-ink placeholder:text-ink-subtle focus:outline-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="flex h-6 w-6 items-center justify-center rounded-full text-ink-subtle hover:text-ink"
            aria-label={t("Clear search")}
          >
            <X size={13} />
          </button>
        )}
      </div>
      <div className="flex max-w-full flex-wrap gap-1.5">
        <YearChip active={year === null} onClick={() => onYear(null)} tint={tint}>
          {t("All years")}
        </YearChip>
        {years.map((y) => (
          <YearChip key={y} active={year === y} onClick={() => onYear(year === y ? null : y)} tint={tint}>
            {y}
          </YearChip>
        ))}
      </div>
    </div>
  );
}

function YearChip({
  active,
  onClick,
  tint,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 items-center rounded-full px-3 text-[12px] font-semibold transition-colors ${
        active ? "text-canvas" : "text-ink-muted hover:text-ink"
      }`}
      style={{
        background: active ? tint : "transparent",
        border: active ? `1px solid ${tint}` : "1px solid var(--color-edge-soft)",
      }}
    >
      {children}
    </button>
  );
}

function CategoryBlock({ category, tint }: { category: AnimeAwardCategory; tint: string }) {
  const t = useT();
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b border-edge-soft pb-2">
        <h2 className="font-display text-[24px] font-medium tracking-tight text-ink">
          {category.isAOTY && (
            <span
              className="me-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.18em]"
              style={{ background: `${tint}22`, color: tint }}
            >
              {t("Grand")}
            </span>
          )}
          {category.name}
        </h2>
        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {category.winners.length === 1
            ? t("{n} winner", { n: category.winners.length })
            : t("{n} winners", { n: category.winners.length })}
        </span>
      </div>
      <ul className="grid grid-cols-1 gap-x-10 gap-y-0.5 md:grid-cols-2">
        {category.winners.map((w, i) => (
          <WinnerRow key={`${w.year}-${w.title}-${i}`} year={w.year} title={w.title} tint={tint} />
        ))}
      </ul>
    </section>
  );
}

function WinnerRow({ year, title, tint }: { year: number; title: string; tint: string }) {
  const { settings } = useSettings();
  const { openMeta } = useView();
  const [resolving, setResolving] = useState(false);
  const clickable = !!settings.tmdbKey;

  const onClick = async () => {
    if (!clickable || resolving) return;
    setResolving(true);
    try {
      const tv = await searchTmdb(settings.tmdbKey, title, year, "tv");
      if (tv) {
        openMeta({ id: `tmdb:tv:${tv.id}`, type: "series", name: title });
        return;
      }
      const movie = await searchTmdb(settings.tmdbKey, title, year, "movie");
      if (movie) {
        openMeta({ id: `tmdb:movie:${movie.id}`, type: "movie", name: title });
      }
    } finally {
      setResolving(false);
    }
  };

  return (
    <li className="flex items-baseline gap-4 border-b border-edge-soft/40 py-2.5 text-[14px]">
      <span className="w-14 shrink-0 font-semibold tabular-nums" style={{ color: tint }}>
        {year}
      </span>
      {clickable ? (
        <button
          type="button"
          onClick={onClick}
          disabled={resolving}
          className="group flex flex-1 items-center gap-1.5 text-start text-ink transition-colors hover:text-accent disabled:cursor-default disabled:opacity-60"
        >
          <span className="flex-1">{title}</span>
          <ArrowUpRight
            size={13}
            className="dir-icon shrink-0 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100"
            strokeWidth={2.2}
          />
        </button>
      ) : (
        <span className="flex-1 text-ink">{title}</span>
      )}
    </li>
  );
}

async function searchTmdb(
  key: string,
  title: string,
  year: number,
  type: "movie" | "tv",
): Promise<{ id: number } | null> {
  const params = new URLSearchParams({
    api_key: key,
    query: title,
    include_adult: "false",
  });
  if (type === "movie") params.set("year", String(year));
  else params.set("first_air_date_year", String(year));
  try {
    const res = await fetch(`https://api.themoviedb.org/3/search/${type}?${params}`);
    if (!res.ok) return null;
    const data: any = await res.json();
    const hit = data?.results?.[0];
    return hit?.id ? { id: hit.id } : null;
  } catch {
    return null;
  }
}
