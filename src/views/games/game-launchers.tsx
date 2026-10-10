import { GameAvailabilityBadge, GameAvailabilityCover } from "./game-availability";
import { observeWithin } from "@/lib/visibility";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { NavChevron } from "@/components/nav-arrow";
import { useT, useUiLanguage } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { LAUNCHER_DISCOVERY, loadLauncherDiscovery, type LauncherDiscoveryId, type LauncherDiscoveryGame } from "@/lib/games/launcher-discovery";
import { loadGameDetail } from "@/lib/games/catalog";
import { LAUNCHER_NAMES } from "@/lib/games/launchers";
import type { UnifiedSource } from "@/lib/games/unified-library";
import type { GameSummary } from "@/lib/games/types";
import { GameLauncherLogo } from "./game-launcher-logo";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import "./game-launchers.css";

type Discovery = Awaited<ReturnType<typeof loadLauncherDiscovery>>;
type Props = {
  active: boolean;
  selected: LauncherDiscoveryId;
  select: (id: LauncherDiscoveryId) => void;
  open: (game: GameSummary, origin?: HTMLElement) => void;
  installed?: Partial<Record<LauncherDiscoveryId, number>>;
  library: (source: UnifiedSource | "manual", origin: HTMLElement) => void;
};

function LauncherFeature({ game, active, single, open }: { game: LauncherDiscoveryGame; active: boolean; single: boolean; open: Props["open"] }) {
  const t = useT(), [detail, setDetail] = useState<LauncherDiscoveryGame>();
  useEffect(() => {
    if (!active || !game.steamId) return;
    let current = true;
    void loadGameDetail(game.steamId).then(value => {
      if (current) setDetail({ ...value, hero: value.libraryHero || value.hero, genreNames: value.genres });
    }).catch(() => {});
    return () => { current = false; };
  }, [active, game.steamId]);
  const presented = detail ? { ...game, ...detail } : game;
  return <article className="games-launcher-feature" aria-label={game.name}>
    <GameArt className="games-launcher-feature-art" src={game.hero ?? game.capsule} fallback={game.capsule} eager/><div className="games-launcher-feature-shade"/>
    {single && <GameAvailabilityBadge game={game}/>}
    <div className="games-launcher-feature-copy">
      <GameHeroLogo className="games-launcher-game-logo" sources={[presented.logo]} name={game.name} steamId={game.steamId} platformIds={[]} ready active={active} preferCurrentSteamLogo/>
      <h4>{game.name}</h4>
      {!!presented.genreNames?.length && <span className="games-launcher-genres">{presented.genreNames.slice(0, 3).join(" · ")}</span>}
      {presented.description && <p>{presented.description}</p>}
      <button className="games-button" data-game={game.id} onClick={event => open(presented, event.currentTarget)}>{t("games.discovery.viewGame")}</button>
    </div>
  </article>;
}

export function GameLaunchers({ active, selected, select, open, installed, library }: Props) {
  const t = useT(), language = useUiLanguage(), root = useRef<HTMLElement>(null), rail = useRef<HTMLDivElement>(null);
  const [gamePage, setGamePage] = useState(0);
  const [near, setNear] = useState(false), [slots, setSlots] = useState(6), [page, setPage] = useState(0);
  const [records, setRecords] = useState<Partial<Record<LauncherDiscoveryId, Discovery>>>({});
  const [failed, setFailed] = useState<LauncherDiscoveryId | null>(null), [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState<LauncherDiscoveryId | null>(null), [featured, setFeatured] = useState<string | null>(null);
  const selectedRef = useRef(selected); selectedRef.current = selected;
  useEffect(() => {
    const node = root.current; if (!node) return;
    return observeWithin(node, "850px", entry => { if (entry.isIntersecting) setNear(true); });
  }, []);
  useLayoutEffect(() => {
    const node = rail.current; if (!node) return;
    const measure = () => {
      if (!node.clientWidth) return;
      const count = Math.max(2, Math.min(6, Math.floor(node.clientWidth / 150)));
      setSlots(count);
      setPage(Math.floor(Math.max(0, LAUNCHER_DISCOVERY.findIndex(item => item.id === selectedRef.current)) / count));
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!active || !near || (records[selected] && !attempt)) return;
    const controller = new AbortController(); setFailed(null); setLoading(selected);
    void loadLauncherDiscovery(selected, controller.signal).then(value => {
      if (!controller.signal.aborted) setRecords(previous => ({ ...previous, [selected]: value }));
    }, () => { if (!controller.signal.aborted) setFailed(selected); }).finally(() => { if (!controller.signal.aborted) setLoading(null); });
    return () => controller.abort();
  }, [active, near, selected, attempt]);
  const definition = LAUNCHER_DISCOVERY.find(item => item.id === selected) ?? LAUNCHER_DISCOVERY[0];
  const record = records[definition.id] ?? (definition.id === "steam" ? { ...definition, games: [] } : definition);
  const game = record.games.find(item => item.id === featured) ?? record.games[0];
  const pages = Math.ceil(LAUNCHER_DISCOVERY.length / slots), visiblePage = Math.min(page, pages - 1);
  const visible = LAUNCHER_DISCOVERY.slice(visiblePage * slots, (visiblePage + 1) * slots);
  const choose = (id: LauncherDiscoveryId) => { select(id); setFeatured(null); setGamePage(0); };
  const changePage = (next: number) => { setPage(next); choose(LAUNCHER_DISCOVERY[next * slots].id); };
  const supported = definition.id === "steam" || Object.hasOwn(LAUNCHER_NAMES, definition.id);
  const count = installed?.[definition.id];
  const gamePages = Math.max(1, Math.ceil(record.games.length / 4)), currentGamePage = Math.min(gamePage, gamePages - 1);
  const picks = record.games.slice(currentGamePage * 4, currentGamePage * 4 + 4);
  const pageGames = (next: number) => { setGamePage(next); setFeatured(record.games[next * 4]?.id ?? null); };
  const pending = selected === "steam" && !records.steam && failed !== selected;
  return <section className="games-section games-inset games-launchers" ref={root} aria-labelledby="games-launchers-title">
    <div className="games-section-heading"><div><h2 id="games-launchers-title">{t("games.launchers.explore")}</h2><p>{t("games.launchers.note")}</p></div>
      <div className="games-page-controls"><span dir="ltr">{visiblePage + 1} / {pages}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!visiblePage} onClick={() => changePage(visiblePage - 1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={visiblePage >= pages - 1} onClick={() => changePage(visiblePage + 1)}><NavChevron dir="right" size={18}/></button></div>
    </div>
    <div className="games-launcher-rail" ref={rail} aria-label={t("games.launchers.choose")} style={{ gridTemplateColumns: `repeat(${slots}, minmax(0, 1fr))` }}>
      {visible.map(brand => <button key={brand.id} aria-pressed={definition.id === brand.id} onClick={() => choose(brand.id)}><GameLauncherLogo launcher={brand.id} size={40}/><span>{brand.name}</span></button>)}
    </div>
    <div className="games-launcher-heading"><div><h3>{definition.name}</h3>{count !== undefined && <span>{t("games.launchers.installed", { count })}</span>}</div><div>
      <button className="games-text-action" onClick={event => library(supported ? definition.id as UnifiedSource : "manual", event.currentTarget)}>{t(supported ? "games.launchers.library" : "games.custom.add", { name: definition.name })}</button>
      <button className="games-button games-launcher-official" onClick={() => void openUrl(definition.catalogUrl ?? definition.website)}><GameLauncherLogo launcher={definition.id} size={16}/>{t("games.launchers.visit", { name: definition.name })}</button>
    </div></div>
    <div className="games-launcher-stage" data-single={!pending && record.games.length < 2 || undefined} aria-busy={pending}>
      {game ? <LauncherFeature key={game.id} game={game} active={active} single={record.games.length < 2} open={open}/> : <div className={`games-launcher-feature games-launcher-placeholder${pending ? " is-loading" : ""}`}><GameLauncherLogo launcher={definition.id} size={72}/><span role="status">{t(pending || loading === selected ? "common.loading" : failed === selected ? "games.launchers.unavailable" : "games.noResults")}</span></div>}
      {(record.games.length > 1 || pending) && <div className="games-launcher-picks" data-count={record.games.length}>
        <header><span>{t(selected === "steam" ? "games.launchers.topGames" : "games.launchers.picks")}</span>{gamePages > 1 && <div className="games-page-controls"><span dir="ltr">{currentGamePage + 1} / {gamePages}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!currentGamePage} onClick={() => pageGames(currentGamePage - 1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={currentGamePage >= gamePages - 1} onClick={() => pageGames(currentGamePage + 1)}><NavChevron dir="right" size={18}/></button></div>}</header>
        <div className="games-launcher-pick-list" key={`${selected}:${currentGamePage}`}>{pending ? [0,1,2,3].map(index => <div className="games-launcher-pick-skeleton" key={index} aria-hidden="true"><i/><span/></div>) : picks.map(item => <button key={item.id} aria-pressed={game?.id === item.id} onClick={() => setFeatured(item.id)}><GameAvailabilityCover game={item} src={record.games.length === 2 ? item.portrait ?? item.capsule : item.capsule} fallback={item.capsule}/><span><strong>{item.name}</strong><small>{item.chartRank ? <>{t("games.launchers.chartRank", { rank: item.chartRank.toLocaleString(language) })}</> : item.genreNames?.slice(0, 2).join(" · ") || item.platforms.join(" · ")}</small></span></button>)}</div>
      </div>}
    </div>
    {failed === selected && <div className="games-inline-status" role="alert"><span>{t("games.launchers.unavailable")}</span><button className="games-text-action" onClick={() => setAttempt(value => value + 1)}>{t("common.retry")}</button></div>}
    <p className="games-launcher-source">{t(selected === "steam" ? "games.launchers.steamSource" : "games.launchers.source")}</p>
  </section>;
}
