import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { isRtl, useT, useUiLanguage } from "@/lib/i18n";
import { NavChevron } from "@/components/nav-arrow";
import { loadGameCatalog } from "@/lib/games/catalog";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "@/lib/games/catalog-filters";
import { loadStudioRowPage, mergeStudioGames } from "@/lib/games/studio-row";
import { type AtlasRoute, type GameConnection } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameCard } from "./game-ui";

type StudioCatalog = { games: GameSummary[]; nextOffset: number | null; source: "company" | "steam" };

export function GameDetailStudio({ game, developer, company, active, open, browse, atlas }: {
  game: GameSummary; developer?: string; company?: GameConnection; active: boolean;
  open: (game: GameSummary) => void; browse: (filters: Partial<CatalogFilters>) => void; atlas: (route: AtlasRoute) => void;
}) {
  const t = useT(), id = useId(), root = useRef<HTMLElement>(null), [near, setNear] = useState(false);
  const [catalog, setCatalog] = useState<StudioCatalog | null>(null), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0), [pending, setPending] = useState(false);
  const held = useRef(catalog); held.current = catalog;
  const request = useRef<AbortController | null>(null), busy = useRef(false), identity = useRef("");
  const nextButton = useRef<HTMLButtonElement>(null);
  const [slots, setSlots] = useState(3), [page, setPage] = useState(0);
  const rtl = isRtl(useUiLanguage());
  const currentGame = useRef(game); currentGame.current = game;
  const studioCompany = company;
  const name = developer || studioCompany?.name;
  const games = catalog?.games;
  const visible = !!name && !(games?.length === 0 && catalog?.nextOffset === null);
  useLayoutEffect(() => {
    const node = root.current; if (!node) return;
    const measure = () => setSlots(Math.max(1, Math.min(6, Math.floor((node.clientWidth + 18) / 218))));
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);
  useEffect(() => {
    if (!active || near || !root.current) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { rootMargin: "300px" });
    observer.observe(root.current); return () => observer.disconnect();
  }, [active, near, name]);
  useEffect(() => {
    if (!active || !near || !name) return;
    const controller = new AbortController(); request.current = controller;
    const key = `${game.id}:${studioCompany?.id ?? "steam"}:${name}`;
    if (identity.current !== key) { identity.current = key; held.current = null; setCatalog(null); setPage(0); }
    // Keep the loaded catalog and row position when returning from another detail.
    if (held.current) { busy.current = false; setPending(false); return () => controller.abort(); }
    setFailed(false); busy.current = true; setPending(true);
    const storeGames = (): Promise<StudioCatalog> => loadGameCatalog("", { ...DEFAULT_CATALOG_FILTERS, developer: name, sort: "Reviews_DESC" }, 0, controller.signal).then(value => ({ ...value, source: "steam" }));
    const result = studioCompany ? loadStudioRowPage(studioCompany.id, 0, controller.signal).then<StudioCatalog>(items => items.games.length || items.nextOffset !== null || !developer ? { ...items, source: "company" } : storeGames()).catch(error => { controller.signal.throwIfAborted(); if (developer) return storeGames(); throw error; }) : storeGames();
    void result.then(value => {
      if (!controller.signal.aborted) {
        held.current = { ...value, games: mergeStudioGames(currentGame.current, value.games) };
        setCatalog(held.current);
      }
    }, () => { if (!controller.signal.aborted) setFailed(true); }).finally(() => { if (!controller.signal.aborted) { busy.current = false; setPending(false); } });
    return () => controller.abort();
  }, [active, near, game.id, studioCompany?.id, name, attempt]);
  const pages = Math.ceil((games?.length ?? 0) / slots), currentPage = Math.min(page, Math.max(0, pages - 1));
  const hasMore = catalog?.nextOffset !== null && catalog?.nextOffset !== undefined;
  const loadMore = async (advance = false) => {
    const previous = held.current, controller = request.current;
    if (!active || busy.current || !previous || previous.nextOffset === null || !controller || controller.signal.aborted || !name) return;
    busy.current = true; setPending(true); setFailed(false);
    try {
      const next = previous.source === "company" && studioCompany
        ? await loadStudioRowPage(studioCompany.id, previous.nextOffset, controller.signal)
        : await loadGameCatalog("", { ...DEFAULT_CATALOG_FILTERS, developer: name, sort: "Reviews_DESC" }, previous.nextOffset, controller.signal);
      if (controller.signal.aborted) return;
      const combined = mergeStudioGames(currentGame.current, previous.games, next.games);
      held.current = { ...previous, ...next, games: combined };
      setCatalog(held.current);
      if (advance && combined.length > (currentPage + 1) * slots) setPage(currentPage + 1);
    } catch { if (!controller.signal.aborted) setFailed(true); }
    finally { if (!controller.signal.aborted) { busy.current = false; setPending(false); } }
  };
  useEffect(() => {
    // Fetch the next API page near the loaded edge; keep current cards and focus in place.
    if (active && hasMore && !pending && !failed && (currentPage + 2) * slots >= (games?.length ?? 0)) void loadMore();
  }, [active, currentPage, slots, catalog?.nextOffset, games?.length, pending, failed]);
  if (!visible) return null;
  const viewAll = () => studioCompany ? atlas({ kind: "company", ...studioCompany, includeSubsidiaries: true }) : browse({ developer: name });
  const nextPage = () => { if (currentPage < pages - 1) setPage(currentPage + 1); else void loadMore(true); };
  return <section ref={root} className="games-detail-studio" aria-labelledby={id}>
    <div className="games-section-heading"><h2 id={id}>{t("games.details.moreFrom", { name })}</h2><div className="games-detail-studio-actions"><button className="games-detail-text-button" onClick={viewAll}>{t("games.roms.seeAll")}<ArrowUpRight size={15} /></button>{(pages > 1 || hasMore) && <div className="games-page-controls"><button className="games-icon-button" aria-label={t("common.previous")} aria-controls={`${id}-games`} disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><NavChevron dir={rtl ? "right" : "left"} size={18} /></button><button ref={nextButton} className="games-icon-button" aria-label={t("common.next")} aria-controls={`${id}-games`} aria-busy={pending} disabled={currentPage >= pages - 1 && (!hasMore || pending || failed)} onClick={nextPage}><NavChevron dir={rtl ? "left" : "right"} size={18} /></button></div>}</div></div>
    {(!failed || games) && <div id={`${id}-games`} className="games-detail-studio-grid" aria-busy={pending} style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>{games ? games.slice(currentPage * slots, (currentPage + 1) * slots).map(item => <GameCard key={item.id} game={item} open={open} />) : Array.from({ length: slots }, (_, item) => <div className="games-detail-studio-placeholder" aria-hidden="true" key={item} />)}</div>}
    {failed && <div className="games-detail-studio-error" role="status"><p>{t("games.details.studioUnavailable")}</p><button className="games-button" onClick={event => { if (!catalog) { setAttempt(value => value + 1); return; } const retry = event.currentTarget; void loadMore().then(() => { if (!retry.isConnected && document.activeElement === document.body) nextButton.current?.focus({ preventScroll: true }); }); }}>{t("common.retry")}</button></div>}
  </section>;
}
