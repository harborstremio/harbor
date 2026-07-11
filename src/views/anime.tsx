import { AnimeGenrePicker } from "@/components/anime-genre-picker";
import { AnimeHero } from "@/components/anime-hero";
import { BackToTop } from "@/components/back-to-top";
import { ContinueCard } from "@/components/continue-card";
import { PickCard } from "@/components/pick-card";
import { Row, ScrollRootContext } from "@/components/row";
import { AnimeRankCard } from "@/components/top-rank-card";
import { createAddonCatalogFetcher, loadAddonRows, normalizeName, type AddonRow } from "@/lib/addons";
import { isAdultAnime } from "@/lib/addons-store/adult-filter";
import { loadAnilistWatchedMap } from "@/lib/anilist/watched-map";
import { findTopAward, parseAwardYear, uniqueWinnerFranchisesAcrossSources } from "@/lib/anime-awards";
import { detectAnimeForCw, useDetectedAnimeVersion } from "@/lib/anime-detect";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { dismissCw, isCwDismissed, useCwDismissVersion } from "@/lib/cw-dismiss";
import { publishResumeStates } from "@/lib/hover-preview/store";
import { useT } from "@/lib/i18n";
import { clearLocalCw } from "@/lib/local-cw";
import {
  dismissManualWatched,
  manualWatchedLibraryItems,
  manualWatchedVersion,
  subscribeManualWatched,
} from "@/lib/manual-watched";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";
import { useSettings } from "@/lib/settings";
import { loadSimklWatchedMap, loadSimklStatusMap, type WatchlistStatus } from "@/lib/simkl/list-status";
import { fetchSimklPlaybackItems } from "@/lib/simkl/playback";
import { useSimkl } from "@/lib/simkl/provider";
import { isAnimeCwItem, isCwMember, library, type LibraryItem } from "@/lib/stremio";
import { useAnimeTopPicks } from "@/lib/use-anime-top-picks";
import { useCrunchyrollAwardMetas } from "@/lib/use-crunchyroll-award-metas";
import { useWatchHistoryRecommendations } from "@/lib/use-watch-history-recs";
import { useScrollMemory, useView } from "@/lib/view";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { AnilistRowControls } from "./anime/anilist-row-controls";
import { AnilistRows } from "./anime/anilist-rows";
import { AnilistTopRow, AnilistTrendingRow } from "./anime/anilist-top-row";
import {
  EMPTY_ROW,
  HERO_KEYS,
  ROW_MAX_PAGES,
  ROW_MIN_VISIBLE,
  RowSkeleton,
  SPECS,
  TOP_PICKS_KEY,
  isAnimeRow,
  type RowPool,
  type RowState,
} from "./anime/anime-rows";
import { MalRowControls } from "./anime/mal-row-controls";
import { MalRows } from "./anime/mal-rows";
import { useCwAdvance } from "./home/hooks/use-cw-advance";

export { isAnimeRow } from "./anime/anime-rows";

function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

export function AnimeView({ active = true }: { active?: boolean }) {
  const t = useT();
  const [rowsByKey, setRowsByKey] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const s of SPECS) init[s.key] = EMPTY_ROW;
    return init;
  });
  const rowsRef = useRef(rowsByKey);
  const loadingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rowsByKey;
  }, [rowsByKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const BATCH = 6;
      const GAP_MS = 350;
      for (let i = 0; i < SPECS.length; i += BATCH) {
        if (cancelled) return;
        const batch = SPECS.slice(i, i + BATCH);
        await Promise.all(
          batch.map(async (s) => {
            try {
              const metas = await s.fetcher(1);
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas, page: 1, hasMore: metas.length >= ROW_MIN_VISIBLE, ready: true },
              }));
            } catch {
              if (cancelled) return;
              setRowsByKey((prev) => ({
                ...prev,
                [s.key]: { metas: [], page: 1, hasMore: false, ready: true },
              }));
            }
          }),
        );
        if (i + BATCH < SPECS.length) {
          await new Promise((r) => setTimeout(r, GAP_MS));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback((key: string) => {
    if (loadingRef.current.has(key)) return;
    const spec = SPECS.find((s) => s.key === key);
    const row = rowsRef.current[key];
    if (!spec || !row || !row.hasMore || row.metas.length >= 80) return;
    loadingRef.current.add(key);
    const next = row.page + 1;
    spec
      .fetcher(next)
      .then((more) => {
        setRowsByKey((prev) => {
          const cur = prev[key];
          if (!cur) return prev;
          const ids = new Set(cur.metas.map((m) => m.id));
          const fresh = more.filter((m) => !ids.has(m.id));
          return {
            ...prev,
            [key]: {
              ...cur,
              metas: [...cur.metas, ...fresh],
              page: next,
              hasMore: more.length >= ROW_MIN_VISIBLE && cur.metas.length + fresh.length < 80,
            },
          };
        });
      })
      .catch(() => {})
      .finally(() => {
        loadingRef.current.delete(key);
      });
  }, []);

  const heroMetas = useMemo<Meta[]>(() => {
    const allWithBg = new Map<string, Meta>();
    for (const spec of SPECS) {
      const r = rowsByKey[spec.key];
      if (!r || !r.ready) continue;
      for (const m of r.metas) {
        if (m.background && !allWithBg.has(m.id)) allWithBg.set(m.id, m);
      }
    }
    const winners: { meta: Meta; year: number }[] = [];
    for (const m of allWithBg.values()) {
      const win = findTopAward(m.name, parseAwardYear(m.releaseInfo));
      if (win) winners.push({ meta: m, year: win.year });
    }
    winners.sort((a, b) => b.year - a.year);

    const seen = new Set<string>();
    const out: Meta[] = [];
    for (const w of winners) {
      if (out.length >= 3) break;
      if (seen.has(w.meta.id)) continue;
      seen.add(w.meta.id);
      out.push(cleanMeta(w.meta));
    }
    for (const spec of SPECS) {
      if (out.length >= 4) break;
      if (!HERO_KEYS.has(spec.key)) continue;
      const r = rowsByKey[spec.key];
      if (!r || !r.ready) continue;
      const pick = r.metas.find((m) => m.background && !seen.has(m.id));
      if (!pick) continue;
      seen.add(pick.id);
      out.push(cleanMeta(pick));
    }
    return out;
  }, [rowsByKey]);

  const { settings, update } = useSettings();
  const { openGrid } = useView();
  const favoriteGenres = settings.animeFavoriteGenres;
  const anilistHidden = settings.animeAnilistRowsHidden;
  const malRowsHidden = settings.animeMalRowsHidden;
  const [showPicker, setShowPicker] = useState(false);

  const { authKey } = useAuth();
  const cwVersion = useCwDismissVersion();
  const { isConnected: simklConnected } = useSimkl();
  const [libItems, setLibItems] = useState<LibraryItem[]>([]);
  const [simklCw, setSimklCw] = useState<LibraryItem[]>([]);
  const [simklWatchedMap, setSimklWatchedMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [simklStatusMap, setSimklStatusMap] = useState<Map<string, WatchlistStatus>>(() => new Map());
  const [anilistWatchedMap, setAnilistWatchedMap] = useState<Map<string, Set<string>>>(() => new Map());
  const [addonRows, setAddonRows] = useState<AddonRow[]>([]);
  useEffect(() => {
    if (!authKey) {
      setLibItems([]);
      setAddonRows([]);
      return;
    }
    const load = () => {
      library(authKey)
        .then(setLibItems)
        .catch(() => setLibItems([]));
    };
    load();
    loadAddonRows(authKey)
      .then((rows) => setAddonRows(rows.filter(isAnimeRow)))
      .catch(() => setAddonRows([]));
    const refresh = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [authKey]);

  useEffect(() => {
    if (!simklConnected) {
      setSimklCw([]);
      return;
    }
    let cancelled = false;
    fetchSimklPlaybackItems()
      .then((cw) => {
        if (!cancelled) setSimklCw(cw.filter(isAnimeCwItem));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);

  const animeDetectVer = useDetectedAnimeVersion();
  const continueWatching = useMemo(() => {
    const seen = new Set<string>();
    return [...libItems, ...simklCw]
      .filter((i) => {
        if (!isCwMember(i)) return false;
        if (!isAnimeCwItem(i)) return false;
        if (isCwDismissed(i)) return false;
        if (seen.has(i._id)) return false;
        seen.add(i._id);
        return true;
      })
      .sort((a, b) => Date.parse(b.state?.lastWatched ?? b._mtime) - Date.parse(a.state?.lastWatched ?? a._mtime))
      .slice(0, 20);
  }, [libItems, simklCw, cwVersion, animeDetectVer]);

  useEffect(() => {
    publishResumeStates(continueWatching);
  }, [continueWatching]);

  const manualWatchedVer = useSyncExternalStore(subscribeManualWatched, manualWatchedVersion);
  const resurfaceLibrary = useMemo(() => {
    const manual = manualWatchedLibraryItems().filter(isAnimeCwItem);
    if (manual.length === 0) return libItems;
    const cwMemberIds = new Set(libItems.filter(isCwMember).map((i) => i._id));
    const usable = manual.filter((i) => !cwMemberIds.has(i._id));
    if (usable.length === 0) return libItems;
    const overrideIds = new Set(usable.map((i) => i._id));
    return [...libItems.filter((i) => !overrideIds.has(i._id)), ...usable];
  }, [libItems, manualWatchedVer]);
  useEffect(() => {
    if (!simklConnected) {
      setSimklWatchedMap(new Map());
      setSimklStatusMap(new Map());
      return;
    }
    let cancelled = false;
    loadSimklWatchedMap()
      .then((m) => {
        if (!cancelled) setSimklWatchedMap(m);
      })
      .catch(() => {});
    loadSimklStatusMap()
      .then((m) => {
        if (!cancelled) setSimklStatusMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [simklConnected]);
  useEffect(() => {
    let cancelled = false;
    const ids = continueWatching.filter((i) => /^(kitsu|mal|anilist):/.test(i._id)).map((i) => i._id);
    loadAnilistWatchedMap(ids)
      .then((m) => {
        if (!cancelled) setAnilistWatchedMap(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [continueWatching]);
  const emptyTrakt = useMemo(() => new Set<string>(), []);
  const cwItems = useCwAdvance(
    continueWatching,
    settings.tmdbKey,
    settings.cwAdvanceNext,
    resurfaceLibrary,
    "only",
    manualWatchedVer,
    emptyTrakt,
    simklWatchedMap,
    anilistWatchedMap,
    simklStatusMap,
    animeDetectVer,
  );

  useEffect(() => {
    void detectAnimeForCw(libItems);
  }, [libItems]);

  const watchHistoryRecs = useWatchHistoryRecommendations(continueWatching);

  const topPicks = useAnimeTopPicks({
    libItems,
    continueWatching,
    heroMetas,
    watchHistoryRecs,
    favoriteGenres,
  });

  const awardWinnerEntries = useCrunchyrollAwardMetas();
  const awardWinnersRaw = useMemo(() => {
    const winByKey = uniqueWinnerFranchisesAcrossSources();
    const seen = new Set<string>();
    const out: Array<{ meta: Meta; year: number; lookupName: string }> = [];

    for (const spec of SPECS) {
      const r = rowsByKey[spec.key];
      if (!r?.ready) continue;
      for (const m of r.metas) {
        const fk = animeFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        const win = winByKey.get(fk);
        if (!win) continue;
        seen.add(fk);
        out.push({ meta: cleanMeta(m), year: win.year, lookupName: win.title });
      }
    }

    for (const e of awardWinnerEntries) {
      const fk = animeFranchiseKey(e.meta.name);
      if (seen.has(fk)) continue;
      seen.add(fk);
      out.push({ meta: cleanMeta(e.meta), year: e.win.year, lookupName: e.win.title });
    }

    out.sort((a, b) => b.year - a.year);
    return out;
  }, [rowsByKey, awardWinnerEntries]);
  const awardWinnerMetas = useMemo<Meta[]>(() => awardWinnersRaw.map((x) => x.meta), [awardWinnersRaw]);
  const awardLookupByMetaId = useMemo(() => {
    const out: Record<string, string> = {};
    for (const x of awardWinnersRaw) out[x.meta.id] = x.lookupName;
    return out;
  }, [awardWinnersRaw]);

  const filteredRowsByKey = useMemo<Record<string, RowState>>(() => {
    const heroSeen = new Set<string>();
    for (const m of heroMetas) heroSeen.add(animeFranchiseKey(m.name));
    for (const m of topPicks) heroSeen.add(animeFranchiseKey(m.name));
    const pools: Record<RowPool, Set<string>> = {
      general: new Set(heroSeen),
      era: new Set(heroSeen),
      genre: new Set(heroSeen),
    };
    const out: Record<string, RowState> = {};
    for (const spec of SPECS) {
      const row = rowsByKey[spec.key];
      if (!row) {
        out[spec.key] = EMPTY_ROW;
        continue;
      }
      if (spec.key === "upcoming" || !row.ready) {
        out[spec.key] = row;
        continue;
      }
      const seen = pools[spec.pool ?? "general"];
      const filtered: Meta[] = [];
      for (const m of row.metas) {
        const fk = animeFranchiseKey(m.name);
        if (seen.has(fk)) continue;
        seen.add(fk);
        filtered.push(cleanMeta(m));
      }
      out[spec.key] = { ...row, metas: filtered };
    }
    return out;
  }, [rowsByKey, heroMetas, topPicks]);

  useEffect(() => {
    for (const spec of SPECS) {
      const raw = rowsByKey[spec.key];
      if (!raw?.ready || !raw.hasMore || raw.page >= ROW_MAX_PAGES) continue;
      const shown = filteredRowsByKey[spec.key];
      if (!shown || shown.metas.length >= ROW_MIN_VISIBLE) continue;
      loadMore(spec.key);
    }
  }, [rowsByKey, filteredRowsByKey, loadMore]);

  const dedupedAddonRows = useMemo(() => {
    const seen = new Set<string>();
    for (const s of SPECS) seen.add(normalizeName(s.title, "anime"));
    const out: AddonRow[] = [];
    for (const r of addonRows) {
      const key = normalizeName(r.name, "anime");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(settings.hideContent.adult ? { ...r, metas: r.metas.filter((m) => !isAdultAnime(m)) } : r);
    }
    return out;
  }, [addonRows, settings.hideContent.adult]);

  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("anime", scrollRef, active);

  const prevActiveRef = useRef(active);
  useEffect(() => {
    if (active && !prevActiveRef.current) {
      const fire = () =>
        window.dispatchEvent(new CustomEvent("harbor:reset-row-scrolls", { detail: { prefix: "anime:" } }));
      fire();
      const r1 = requestAnimationFrame(fire);
      const r2 = window.setTimeout(fire, 80);
      prevActiveRef.current = active;
      return () => {
        cancelAnimationFrame(r1);
        window.clearTimeout(r2);
      };
    }
    prevActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ anchor: string }>).detail;
      const anchor = detail?.anchor;
      if (!anchor) return;
      const root = scrollRef.current;
      if (!root) return;
      const tryScroll = () => {
        const el = root.querySelector<HTMLElement>(`[data-scroll-anchor="${anchor}"]`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          return true;
        }
        return false;
      };
      if (tryScroll()) return;
      let attempts = 0;
      const id = window.setInterval(() => {
        attempts += 1;
        if (tryScroll() || attempts > 20) window.clearInterval(id);
      }, 150);
    };
    window.addEventListener("harbor:anime-focus-row", handler as EventListener);
    return () => window.removeEventListener("harbor:anime-focus-row", handler as EventListener);
  }, []);

  return (
    <main ref={scrollCb} className="flex-1 overflow-y-auto px-12 pt-28 pb-14">
      <ScrollRootContext.Provider value={scrollEl}>
        <div data-tauri-drag-region className="flex flex-col gap-12">
          {heroMetas.length > 0 && (
            <div data-scroll-anchor="hero" className="relative harbor-anime-hero">
              <AnimeHero slides={heroMetas} topPicks={topPicks} />
              <button
                type="button"
                onClick={() => setShowPicker(true)}
                title={t("Tune your Top Picks")}
                className="absolute end-4 top-4 z-10 flex h-9 items-center gap-1.5 rounded-full border border-edge-soft/60 bg-canvas/80 px-3 text-[12px] font-semibold text-ink-muted shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-colors hover:border-accent/50 hover:text-accent"
              >
                <Sparkles size={13} strokeWidth={2.1} />
                {t("Tune picks")}
                {favoriteGenres.length > 0 && (
                  <span className="rounded-full bg-accent/15 px-1.5 text-[10px] font-bold text-accent">
                    {favoriteGenres.length}
                  </span>
                )}
              </button>
            </div>
          )}
          {cwItems.length > 0 && (
            <Row title={t("Continue Watching")} min={260} shape="landscape" scrollKey="anime:cw">
              {cwItems.map((item) => (
                <ContinueCard
                  key={item._id}
                  item={item}
                  onDismiss={(it) =>
                    it.manualWatched
                      ? dismissManualWatched(it._id)
                      : it.local
                        ? clearLocalCw(it._id)
                        : dismissCw(it, authKey)
                  }
                />
              ))}
            </Row>
          )}
          {!malRowsHidden.includes("yourMalLists") && <MalRows />}
          {!anilistHidden.includes("yourLists") && <AnilistRows />}
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2.5">
            <AnilistRowControls />
            <MalRowControls />
          </div>
          {!anilistHidden.includes("trending") && <AnilistTrendingRow />}
          {!anilistHidden.includes("top100") && <AnilistTopRow />}
          {awardWinnerMetas.length > 0 && (
            <div data-scroll-anchor="row:anime-awards">
              <Row title={t("Award Winning Anime")} scrollKey="anime:awards">
                {awardWinnerMetas.map((m) => (
                  <PickCard key={m.id} meta={m} awardLookupName={awardLookupByMetaId[m.id]} />
                ))}
              </Row>
            </div>
          )}
          {SPECS.map((spec) => {
            if (spec.key === TOP_PICKS_KEY) return null;
            const r = filteredRowsByKey[spec.key] ?? EMPTY_ROW;
            if (r.ready && r.metas.length === 0) return null;
            const viewAll = () =>
              openGrid({
                title: t(spec.title),
                fetcher: (p) => spec.fetcher(p).then((ms) => ms.map(cleanMeta)),
                initial: r.metas,
              });
            return (
              <div key={spec.key} data-scroll-anchor={`row:${spec.key}`}>
                {!r.ready ? (
                  <RowSkeleton
                    title={
                      spec.rank ? t("Top 10 {name}", { name: t(spec.title).replace(/^Top\s*/i, "") }) : t(spec.title)
                    }
                  />
                ) : spec.rank && r.metas.length >= 10 ? (
                  <Row
                    title={t("Top 10 {name}", { name: t(spec.title).replace(/^Top\s*/i, "") })}
                    min={180}
                    shape="rank"
                    scrollKey={`anime:${spec.key}`}
                    onViewAll={viewAll}
                  >
                    {r.metas.slice(0, 10).map((m, i) => (
                      <AnimeRankCard key={m.id} meta={m} rank={i + 1} />
                    ))}
                  </Row>
                ) : (
                  <Row
                    title={t(spec.title)}
                    scrollKey={`anime:${spec.key}`}
                    onEndReached={r.hasMore ? () => loadMore(spec.key) : undefined}
                    onViewAll={viewAll}
                  >
                    {r.metas.map((m, i) => (
                      <PickCard key={`${m.id}-${i}`} meta={m} />
                    ))}
                  </Row>
                )}
              </div>
            );
          })}
          {dedupedAddonRows.map((row) => (
            <div key={row.key} data-scroll-anchor={`row:${row.key}`}>
              <Row
                title={row.name}
                scrollKey={`anime:addon:${row.key}`}
                onViewAll={
                  row.more && row.metas.length > 0
                    ? () =>
                        openGrid({
                          title: row.name,
                          fetcher: createAddonCatalogFetcher(row.more!, {
                            initialPageSize: row.metas.length,
                            mapMeta: cleanMeta,
                          }),
                          initial: row.metas.map(cleanMeta),
                        })
                    : undefined
                }
              >
                {row.metas.map((m, i) => (
                  <PickCard key={`${m.id}-${i}`} meta={cleanMeta(m)} />
                ))}
              </Row>
            </div>
          ))}
        </div>
      </ScrollRootContext.Provider>
      <BackToTop scrollRef={scrollRef} />
      {showPicker && (
        <AnimeGenrePicker
          initial={favoriteGenres}
          onSave={(g) => update({ animeFavoriteGenres: g, animePicksDismissedAt: Date.now() })}
          onClose={() => {
            setShowPicker(false);
            update({ animePicksDismissedAt: Date.now() });
          }}
        />
      )}
    </main>
  );
}
