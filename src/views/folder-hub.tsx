import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, LayoutGrid, List } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { layoutHasGlobalBack } from "@/lib/theme";
import type { Meta } from "@/lib/cinemeta";
import { tmdbDiscover, tmdbCollection } from "@/lib/providers/tmdb";
import { fetchTraktList } from "@/lib/trakt/lists";
import { hydrateTraktItems } from "@/lib/trakt/hydrate";
import { BackToTop } from "@/components/back-to-top";
import { PickCard } from "@/components/pick-card";
import { Row, usePosterRow, TV_CARD_MIN } from "@/components/row";
import type { SourceFolder } from "@/lib/custom-sources";
import { gatherCatalogAddons, createAddonCatalogFetcher } from "@/lib/addons";
import { useT } from "@/lib/i18n";

function FolderHubGridTab({
  fetcher,
  kids,
}: {
  fetcher: (page: number, currentOffset?: number) => Promise<Meta[]>;
  kids?: boolean;
}) {
  const { settings } = useSettings();
  const [metas, setMetas] = useState<Meta[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const t = useT();

  useEffect(() => {
    if (done) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        const next = page + 1;
        fetcher(next, metas.length)
          .then((batch) => {
            setPage(next);
            if (batch.length === 0 || next >= 40) {
              setDone(true);
              return;
            }
            setMetas((prev) => {
              const seen = new Set(prev.map((m) => m.id));
              const fresh = batch.filter((m) => !seen.has(m.id));
              return [...prev, ...fresh];
            });
          })
          .catch(() => setDone(true))
          .finally(() => {
            loadingRef.current = false;
          });
      },
      { rootMargin: "900px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [fetcher, page, done, metas]);

  return (
    <>
      <div
        className="grid gap-x-4 gap-y-8"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${
            settings.rowCardStyle === "tv" ? TV_CARD_MIN : 150
          }px, 1fr))`,
        }}
      >
        {metas.map((m, i) => (
          <PickCard key={`${m.id}-${i}`} meta={m} kids={kids} />
        ))}
      </div>
      {!done && <div ref={sentinelRef} className="h-24 w-full" />}
      {done && metas.length === 0 && (
        <p className="py-20 text-center text-[14px] text-ink-subtle">{t("Nothing here yet!")}</p>
      )}
    </>
  );
}

function FolderHubTabs({
  active,
  options,
  onChange,
}: {
  active: string;
  options: { id: string; title: string }[];
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex w-full items-center gap-6 overflow-x-auto border-b border-edge-soft pb-2 hide-scrollbar">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`shrink-0 text-[15px] font-medium transition-colors hover:text-ink ${
            active === o.id ? "text-ink" : "text-ink-subtle"
          }`}
        >
          {o.title}
          {active === o.id && (
            <div className="mt-2 h-0.5 w-full rounded-t-full bg-ink" />
          )}
        </button>
      ))}
    </div>
  );
}

function FolderHubRow({
  title,
  fetcher,
  scrollKey,
  kids,
}: {
  title: string;
  fetcher: (page: number, currentOffset?: number) => Promise<Meta[]>;
  scrollKey: string;
  kids?: boolean;
}) {
  const { openGrid } = useView();
  const sizing = usePosterRow(148, kids);
  const [items, setItems] = useState<Meta[] | null>(null);
  const [inView, setInView] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let active = true;
    fetcher(1, 0)
      .then((res) => {
        if (active) setItems(res || []);
      })
      .catch((err) => {
        console.error(`[FolderHubRow] Failed to fetch row ${title}:`, err);
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [fetcher, title, inView]);

  if (items === null) {
    return (
      <div ref={containerRef}>
        <Row {...sizing} title={title} scrollKey={scrollKey} alwaysActive>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`${
              sizing.shape === "landscape" ? "aspect-[16/9]" : "aspect-[2/3]"
            } rounded-xl bg-elevated/35 animate-pulse`}
          />
        ))}
        </Row>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-4">
      <Row
        {...sizing}
        title={title}
        scrollKey={scrollKey}
        onViewAll={() => openGrid({ title, fetcher, initial: items })}
      >
        {items.map((m) => (
          <PickCard key={m.id} meta={m} kids={kids} />
        ))}
      </Row>
    </div>
  );
}

export function FolderHubView({ active = true }: { active?: boolean }) {
  const view = useView() as unknown as ReturnType<typeof useView> & { folderHubFolder: SourceFolder | null };
  const { goBack, folderHubFolder } = view;
  const { settings, update } = useSettings();
  const { authKey } = useAuth();
  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("folder-hub", scrollRef, active);
  
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [localLayout, setLocalLayout] = useState<"CLASSIC" | "GRID">("CLASSIC");
  // Removed unused state variables missingTmdbKey and errorAddon

  useEffect(() => {
    if (folderHubFolder?.layout) {
      setLocalLayout(folderHubFolder.layout);
    }
  }, [folderHubFolder?.layout]);

  const handleToggleLayout = (l: "CLASSIC" | "GRID") => {
    setLocalLayout(l);
    
    update({
      homeRows: {
        ...settings.homeRows,
        customSources: (settings.homeRows.customSources || []).map((sr) => ({
          ...sr,
          folders: sr.folders.map((f) => {
            if (f.id !== folderHubFolder!.id) return f;
            return { ...f, layout: l };
          }),
        })),
      },
    });
  };

  const sources = useMemo(() => {
    if (!folderHubFolder) return [];
    return [
      ...(folderHubFolder.sources || []).map((s: any, idx: number) => {
        let fetcher;
        if (s.provider === "tmdb") {
          fetcher = async (page: number) => {
            if (!settings.tmdbKey) {
              
              return [];
            }
            if (s.tmdbSourceType === "DISCOVER" || s.tmdbSourceType === "COMPANY") {
              const params: Record<string, string> = {};
              if (s.sortBy) params["sort_by"] = s.sortBy;
              if (s.filters) {
                for (const [k, v] of Object.entries(s.filters)) {
                  if (k === "year") {
                    params[s.mediaType === "TV" ? "first_air_date_year" : "primary_release_year"] = String(v);
                  } else if (k === "voteCountGte") {
                    params["vote_count.gte"] = String(v);
                  } else if (k === "voteAverageGte") {
                    params["vote_average.gte"] = String(v);
                  } else {
                    const snake = k.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
                    params[snake] = String(v);
                  }
                }
              }
              if (s.tmdbSourceType === "COMPANY" && s.tmdbId) {
                params["with_companies"] = String(s.tmdbId);
              }
              return tmdbDiscover(settings.tmdbKey!, s.mediaType.toLowerCase() as "movie" | "tv", {
                ...params,
                page: String(page),
              });
            }
            if (s.tmdbSourceType === "COLLECTION" && s.tmdbId) {
              if (page > 1) return [];
              const coll = await tmdbCollection(settings.tmdbKey!, Number(s.tmdbId));
              return coll?.parts || [];
            }
            return [];
          };
        } else if (s.provider === "trakt") {
          fetcher = async (page: number) => {
            if (page > 1) return [];
            if (!settings.tmdbKey) {
              
              return [];
            }
            if (!s.traktListId) return [];
            try {
              const listItems = await fetchTraktList(String(s.traktListId));
              return await hydrateTraktItems(listItems, settings.tmdbKey);
            } catch (err) {
              console.error("[FolderHub] Error fetching trakt list", err);
              return [];
            }
          };
        }
        return {
          id: `native-${idx}`,
          title: s.title,
          fetcher,
        };
      }),
      ...(folderHubFolder.catalogSources || []).map((s: any, idx: number) => ({
        id: `catalog-${idx}`,
        title: s.catalogId, // Catalog source titles fallback
        fetcher: async (page: number, loaded?: number) => {
          const addons = await gatherCatalogAddons(authKey);
          const addon = addons.find((a: any) => a.transportUrl.includes(s.addonId));
          if (!addon) {
            console.warn(`Addon not found for ${s.addonId}`);
            return [];
          }
          const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
          const fetcherFn = createAddonCatalogFetcher({ base, type: s.type, id: s.catalogId });
          return fetcherFn(page, loaded);
        },
      })),
    ].filter((s) => s.fetcher);
  }, [folderHubFolder, settings.tmdbKey]);


  const [invalidSourceIds, setInvalidSourceIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (sources.length > 0 && !activeTab) {
      setActiveTab(sources[0].id);
    }
  }, [sources, activeTab]);

  useEffect(() => {
    if (activeTab && invalidSourceIds.has(activeTab)) {
      const nextValid = sources.find((s) => !invalidSourceIds.has(s.id));
      if (nextValid) setActiveTab(nextValid.id);
    }
  }, [invalidSourceIds, activeTab, sources]);

  useEffect(() => {
    if (localLayout !== "GRID") return;
    let active = true;
    const queue = sources.map((s) => s.id).filter((id) => !invalidSourceIds.has(id));

    const checkNext = async () => {
      if (!active || queue.length === 0) return;
      const id = queue.shift()!;
      const s = sources.find((x) => x.id === id);
      if (!s || !s.fetcher) {
        if (active) setInvalidSourceIds((prev) => new Set(prev).add(id));
        checkNext();
        return;
      }

      try {
        const res = await s.fetcher(1);
        if (active && (!res || res.length === 0)) {
          setInvalidSourceIds((prev) => new Set(prev).add(id));
        }
      } catch {
        if (active) setInvalidSourceIds((prev) => new Set(prev).add(id));
      }

      if (active) {
        setTimeout(checkNext, 200);
      }
    };

    checkNext();

    return () => {
      active = false;
    };
  }, [localLayout, sources, settings, authKey]);

  if (!folderHubFolder) return null;
  
  const validTabs = sources.filter((s) => !invalidSourceIds.has(s.id));

  return (
    <main ref={scrollRef} className="absolute inset-0 z-30 overflow-y-auto bg-canvas">
      {(folderHubFolder.focusGifUrl || folderHubFolder.coverImageUrl) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] min-h-[400px] overflow-hidden">
          <img
            src={folderHubFolder.focusGifUrl || folderHubFolder.coverImageUrl || undefined}
            className={`absolute inset-0 h-full w-full object-cover saturate-[1.5] transition-opacity ${
              folderHubFolder.focusGifUrl ? "opacity-40 blur-sm" : "opacity-25 blur-[80px]"
            }`}
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/60 to-transparent" />
        </div>
      )}

      <div className="relative z-10 flex w-full flex-col gap-10 px-10 pb-24 pt-24 md:px-12">
        <div className="flex items-center gap-4">
          {!layoutHasGlobalBack() && (
            <button
              onClick={() => goBack()}
              aria-label="Back"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-elevated text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowLeft size={18} strokeWidth={2.2} />
            </button>
          )}
          <h1 className="font-display text-[32px] font-medium leading-none tracking-tight text-ink drop-shadow-sm line-clamp-1">
            {folderHubFolder.title}
          </h1>
          <div className="flex-1" />
            <button
              onClick={() => handleToggleLayout("CLASSIC")}
              className={`rounded-md p-1.5 transition-colors ${
                localLayout === "CLASSIC" ? "bg-white/10 text-white" : "text-ink-subtle hover:text-ink"
              }`}
              aria-label="Classic layout"
            >
              <List size={18} />
            </button>
            <button
              onClick={() => handleToggleLayout("GRID")}
              className={`rounded-md p-1.5 transition-colors ${
                localLayout === "GRID" ? "bg-white/10 text-white" : "text-ink-subtle hover:text-ink"
              }`}
              aria-label="Grid layout"
            >
              <LayoutGrid size={18} />
            </button>
        </div>

        <div className="flex flex-col gap-12">
          {localLayout === "GRID" ? (
            <div className="flex flex-col gap-6">
              {validTabs.length > 1 && (
                <FolderHubTabs
                  active={activeTab!}
                  options={validTabs}
                  onChange={setActiveTab}
                />
              )}
              {validTabs.map((s) => {
                if (s.id !== activeTab || !s.fetcher) return null;
                return <FolderHubGridTab key={s.id} fetcher={s.fetcher} />;
              })}
            </div>
          ) : (
            sources.map((s) => {
              if (!s.fetcher) return null;

              return (
                <FolderHubRow
                  key={s.id}
                  title={s.title}
                  fetcher={s.fetcher}
                  scrollKey={`folder-hub:${folderHubFolder.id}:${s.id}`}
                />
              );
            })
          )}
        </div>
      
      <BackToTop scrollRef={scrollRef} />
    </div>
    </main>
  );
}
