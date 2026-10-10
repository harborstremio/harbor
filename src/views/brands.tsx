import { useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { BrandTile, useBrandRanking } from "@/components/brand-tiles";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { useT, useUiLanguage } from "@/lib/i18n";
import type { BrandKind, BrandSummary } from "@/lib/providers/tmdb/tmdb-brands";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";

type Sort = "popular" | "titles" | "rated" | "alpha";

const PAGE = 30;

const SORTS: Array<{ id: Sort; label: string }> = [
  { id: "popular", label: "Most popular" },
  { id: "titles", label: "Most titles" },
  { id: "rated", label: "Highest rated" },
  { id: "alpha", label: "A to Z" },
];

function regionNames(uiLang: string): (code: string) => string {
  try {
    const names = new Intl.DisplayNames([uiLang], { type: "region" });
    return (code) => {
      try {
        return names.of(code) ?? code;
      } catch {
        return code;
      }
    };
  } catch {
    return (code) => code;
  }
}

function genreNames(kind: BrandKind): Map<number, string> {
  const table = kind === "network" ? TV_GENRES : MOVIE_GENRES;
  return new Map(Object.entries(table).map(([name, id]) => [id, name]));
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`brand-chip ${on ? "is-on" : ""}`}>
      {children}
    </button>
  );
}

export function BrandsView({ brand }: { brand: BrandKind }) {
  const t = useT();
  const uiLang = useUiLanguage();
  const { settings } = useSettings();
  const { openBrands, openFilter } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useScrollMemory(`brands:${brand}`, scrollRef);
  const { brands, loading } = useBrandRanking(brand, "all");
  const [sort, setSort] = useState<Sort>("popular");
  const [country, setCountry] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const region = useMemo(() => regionNames(uiLang), [uiLang]);
  const genres = useMemo(() => genreNames(brand), [brand]);

  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of brands) if (b.country) counts.set(b.country, (counts.get(b.country) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c);
  }, [brands]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = brands.filter((b) => (!country || b.country === country) && (!q || b.name.toLowerCase().includes(q)));
    if (sort === "titles") list.sort((a, b) => b.count - a.count);
    else if (sort === "rated") list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || b.score - a.score);
    else if (sort === "alpha") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [brands, country, query, sort]);

  useEffect(() => {
    setLimit(PAGE);
  }, [brand, sort, country, query]);

  const hasMore = limit < shown.length;
  useEffect(() => {
    const el = sentinelRef.current;
    const root = scrollRef.current;
    if (!hasMore || !el || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + PAGE);
      },
      { root, rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, limit]);

  const title = brand === "studio" ? t("All studios") : t("All networks");
  const openBrand = (b: BrandSummary) => openFilter({ kind: b.kind, mediaType: b.media, name: b.name, id: b.id });

  return (
    <main ref={scrollRef} className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
      <div className="relative px-12 pb-6 pt-28">
        <span className="text-[12.5px] font-medium uppercase tracking-[0.22em] text-ink-subtle">{t("Discover")}</span>
        <h1 className="mt-3 font-display text-[64px] font-medium leading-[0.95] tracking-tight text-ink">{title}</h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
          {t("The studios and networks behind what you watch, ranked by what people are watching now.")}
        </p>
        <div className="mt-5 inline-flex gap-1 rounded-full bg-elevated/50 p-1 ring-1 ring-edge-soft/60">
          {(["studio", "network"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => k !== brand && openBrands(k)}
              className={`rounded-full px-5 py-1.5 text-[13px] font-semibold transition-colors ${
                brand === k ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
              }`}
            >
              {k === "studio" ? t("Studios") : t("Networks")}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-8 px-12 pb-24">
        <div className="brand-toolbar">
          <div className="brand-toolbar-line">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={brand === "studio" ? t("Search studios") : t("Search networks")}
              className="brand-search"
            />
          </div>
          <div className="brand-toolbar-line">
            {SORTS.map((s) => (
              <Chip key={s.id} on={sort === s.id} onClick={() => setSort(s.id)}>
                {t(s.label)}
              </Chip>
            ))}
            {countries.length > 1 && (
              <>
                <span className="brand-divider" />
                <Chip on={country === null} onClick={() => setCountry(null)}>
                  {t("Any country")}
                </Chip>
                {countries.map((c) => (
                  <Chip key={c} on={country === c} onClick={() => setCountry(country === c ? null : c)}>
                    {region(c)}
                  </Chip>
                ))}
              </>
            )}
          </div>
        </div>

        {!settings.tmdbKey && (
          <p className="text-[15px] text-ink-muted">{t("Add a TMDB key to browse by this filter.")}</p>
        )}
        {settings.tmdbKey && !loading && shown.length === 0 && (
          <p className="text-[15px] text-ink-muted">{t("Nothing matches those filters yet.")}</p>
        )}

        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-x-4 gap-y-7">
          {shown.slice(0, limit).map((b) => (
            <div key={b.id} className="flex flex-col gap-2.5">
              <BrandTile brand={b} facts={[b.country ? region(b.country) : "", b.span].filter(Boolean).join(" · ")} />
              <button type="button" onClick={() => openBrand(b)} className="flex flex-col gap-1 text-start">
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-[15px] font-semibold text-ink">{b.name}</span>
                  {b.rating !== null && (
                    <span className="shrink-0 text-[12.5px] tabular-nums text-ink-subtle">★ {b.rating.toFixed(1)}</span>
                  )}
                </span>
                <span className="text-[12.5px] text-ink-subtle">
                  {[
                    b.count > 0 ? t("{n} titles", { n: b.count.toLocaleString() }) : "",
                    b.genres
                      .map((g) => genres.get(g))
                      .filter((g): g is string => !!g)
                      .map((g) => t(g))
                      .join(" · "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            </div>
          ))}
          {loading &&
            Array.from({ length: 12 }).map((_, i) => (
              <div key={`s-${i}`} className="aspect-[5/4] animate-pulse rounded-2xl bg-elevated/40" />
            ))}
        </div>
        {hasMore && <div ref={sentinelRef} className="h-px" />}
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
