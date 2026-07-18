import { ArrowLeft, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BackToTop } from "@/components/back-to-top";
import { CollectionCard } from "@/components/collection-card";
import { HarborLoader } from "@/components/harbor-loader";
import { COLLECTION_CATEGORIES, COLLECTIONS_CATALOG } from "@/lib/collections-catalog";
import { layoutHasGlobalBack } from "@/lib/theme";
import { tmdbSearchCollections, type CollectionHit } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { useCategoryFeed } from "./collections/use-category-feed";

const FEED_QUERY = "collection";

function stripSuffix(name: string): string {
  return name.replace(/\s*[-:]?\s*(?:the\s+)?collection$/i, "").trim() || name;
}

export function CollectionsView() {
  const t = useT();
  const { settings } = useSettings();
  const { goBack } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("collections", scrollRef);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("All");
  const [stuck, setStuck] = useState(false);
  const stickySentinelRef = useRef<HTMLDivElement>(null);
  const searchActive = query.trim().length >= 2;
  const remoteQuery = searchActive ? query.trim() : category === "All" ? FEED_QUERY : "";

  const [hits, setHits] = useState<CollectionHit[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);
  const queryEpoch = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const curated = useMemo(() => {
    if (category === "All") return COLLECTIONS_CATALOG;
    return COLLECTIONS_CATALOG.filter((c) => c.cats.includes(category));
  }, [category]);

  const curatedNames = useMemo(
    () => new Set(COLLECTIONS_CATALOG.map((c) => c.name.toLowerCase())),
    [],
  );

  const catFeed = useCategoryFeed({
    tmdbKey: settings.tmdbKey,
    category,
    active: !searchActive && category !== "All",
    excludeNames: curatedNames,
    stripSuffix,
  });

  useEffect(() => {
    queryEpoch.current += 1;
    setHits([]);
    setPage(0);
    setDone(!remoteQuery);
    setLoading(false);
    loadingRef.current = false;
  }, [remoteQuery]);

  useEffect(() => {
    const el = stickySentinelRef.current;
    const root = scrollRef.current;
    if (!el || !root) return;
    const io = new IntersectionObserver((entries) => setStuck(!entries[0]?.isIntersecting), {
      root,
      rootMargin: "-104px 0px 0px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (done || !remoteQuery) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        const next = page + 1;
        const epoch = queryEpoch.current;
        const delay = searchActive && next === 1 ? 350 : 0;
        const timer = window.setTimeout(() => {
          if (queryEpoch.current !== epoch) return;
          tmdbSearchCollections(settings.tmdbKey, remoteQuery, next)
            .then(({ hits: batch, totalPages }) => {
              if (queryEpoch.current !== epoch) return;
              setPage(next);
              if (batch.length === 0 || next >= totalPages) setDone(true);
              setHits((prev) => {
                const seen = new Set(prev.map((h) => h.id));
                const fresh = batch.filter(
                  (h) =>
                    !seen.has(h.id) &&
                    !(
                      remoteQuery === FEED_QUERY &&
                      curatedNames.has(stripSuffix(h.name).toLowerCase())
                    ),
                );
                return [...prev, ...fresh];
              });
            })
            .catch(() => {
              if (queryEpoch.current === epoch) setDone(true);
            })
            .finally(() => {
              if (queryEpoch.current !== epoch) return;
              loadingRef.current = false;
              setLoading(false);
            });
        }, delay);
        return () => window.clearTimeout(timer);
      },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [remoteQuery, page, done, searchActive, settings.tmdbKey, curatedNames]);

  return (
    <main ref={scrollRef} className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
      <div className="mx-auto flex w-full max-w-[1700px] flex-col px-12 pb-24">
        <div className="flex items-center gap-5 pt-24">
          {!layoutHasGlobalBack() && (
            <button
              onClick={goBack}
              aria-label={t("Back")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge-soft bg-elevated/60 text-ink transition-colors hover:bg-raised"
            >
              <ArrowLeft size={19} strokeWidth={2.2} className="dir-icon" />
            </button>
          )}
          <div className="flex flex-col">
            <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-tight text-ink">
              {t("Collections")}
            </h1>
            <p className="mt-1 text-[13.5px] text-ink-muted">
              {t("Every saga in one place. Search anything: if it exists, it's here.")}
            </p>
          </div>
        </div>

        <div ref={stickySentinelRef} aria-hidden className="h-px" />
        <div className="sticky top-24 z-40 mt-8">
          <div
            className={`flex flex-wrap items-center gap-3 transition-all duration-300 ${
              stuck
                ? "rounded-2xl border border-edge-soft bg-canvas/85 px-5 py-3 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl"
                : "rounded-2xl border border-transparent px-0 py-0"
            }`}
          >
            {stuck && (
              <span className="hidden shrink-0 font-display text-[19px] font-medium tracking-tight text-ink sm:inline">
                {t("Collections")}
              </span>
            )}
            <div className="relative w-full max-w-md">
              <Search
                size={16}
                strokeWidth={2}
                className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-ink-subtle"
              />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("Search every collection on TMDB...")}
                spellCheck={false}
                className="h-11 w-full rounded-full border border-edge bg-elevated/50 ps-11 pe-10 text-[14px] text-ink placeholder:text-ink-subtle transition-colors focus:border-ink-subtle focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label={t("Clear search")}
                  className="absolute end-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
                >
                  <X size={14} strokeWidth={2.2} />
                </button>
              )}
            </div>
            {!searchActive && (
              <div className="flex flex-wrap items-center gap-1.5">
                {["All", ...COLLECTION_CATEGORIES].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                      category === c
                        ? "bg-ink text-canvas"
                        : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {t(c)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-10">
          {!searchActive && (
            <section className="flex flex-col gap-5">
              <p className="text-[13px] text-ink-subtle">
                {curated.length === 1
                  ? t("{label} · {n} collection", {
                      label: category === "All" ? t("Featured") : t(category),
                      n: curated.length,
                    })
                  : t("{label} · {n} collections", {
                      label: category === "All" ? t("Featured") : t(category),
                      n: curated.length,
                    })}
              </p>
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
                {curated.map((c) => (
                  <div
                    key={`${c.id}-${c.name}`}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}
                  >
                    <CollectionCard id={c.id} name={c.name} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {!searchActive && category !== "All" && (
            <section className="flex flex-col gap-5">
              <p className="text-[13px] text-ink-subtle">
                {t("More {category}", { category: t(category) })}
              </p>
              {catFeed.hits.length > 0 && (
                <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
                  {catFeed.hits.map((h) => (
                    <div
                      key={h.id}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}
                    >
                      <CollectionCard
                        id={h.id}
                        name={h.name}
                        knownBackdrop={h.backdrop}
                        knownCount={h.count}
                      />
                    </div>
                  ))}
                </div>
              )}
              {!catFeed.done && <div ref={catFeed.sentinelRef} className="h-2" />}
              {catFeed.loading && (
                <div className="flex justify-center py-6">
                  <HarborLoader size="sm" />
                </div>
              )}
              {catFeed.done && (
                <p className="py-4 text-center text-[12.5px] text-ink-subtle">
                  {catFeed.hits.length > 0
                    ? t("That's every {category} collection we could find.", {
                        category: t(category),
                      })
                    : t("No more found for this category.")}
                </p>
              )}
            </section>
          )}

          {remoteQuery && (
            <section className="flex flex-col gap-5">
              <p className="text-[13px] text-ink-subtle">
                {searchActive
                  ? hits.length === 0 && done
                    ? t("Nothing matched. Try the franchise's first film name.")
                    : t('Results for "{query}"', { query: query.trim() })
                  : t("Every collection")}
              </p>
              <div className="grid grid-cols-2 gap-5 lg:grid-cols-3 2xl:grid-cols-4">
                {hits.map((h) => (
                  <div
                    key={h.id}
                    style={{ contentVisibility: "auto", containIntrinsicSize: "auto 220px" }}
                  >
                    <CollectionCard
                      id={h.id}
                      name={stripSuffix(h.name)}
                      knownBackdrop={h.backdrop}
                    />
                  </div>
                ))}
              </div>
              {!done && <div ref={sentinelRef} className="h-2" />}
              {loading && (
                <div className="flex justify-center py-6">
                  <HarborLoader size="sm" />
                </div>
              )}
              {done && hits.length > 0 && (
                <p className="py-4 text-center text-[12.5px] text-ink-subtle">
                  {t("That's every collection TMDB knows about.")}
                </p>
              )}
            </section>
          )}
        </div>
      </div>
      <BackToTop scrollRef={scrollRef} />
    </main>
  );
}
