import { useEffect, useState, type MouseEvent } from "react";
import { ArrowDown, ArrowUpRight } from "lucide-react";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import type { GameSummary } from "@/lib/games/types";
import { loadWarhammerConnections, readWarhammerConnections } from "@/lib/games/warhammer";
import { WARHAMMER_ARMIES, WARHAMMER_SETTING, WARHAMMER_FACTIONS, warhammerFactionGames, type WarhammerConnections, type WarhammerFaction, type WarhammerRole } from "@/lib/games/warhammer-data";
import { WARHAMMER_FACTION_ART, WARHAMMER_LOGO, WARHAMMER_WORLD_ART } from "@/lib/games/warhammer-art";
import { GameArt } from "./game-art";
import { GameCard } from "./game-ui";
import { GameDataStatus } from "./game-data-status";
import { useLiveRefresh } from "./use-live-refresh";
import type { GameMediaTarget } from "@/lib/games/cross-media";
import { WarhammerStory, WarhammerScreenLibrary, WarhammerLoreLibrary, WarhammerCreatorVideos } from "./game-warhammer-universe";
import "./game-warhammer-world.css";

export function GameWarhammerWorld({ active, open, openMedia }: { active: boolean; image?: string; open: (game: GameSummary) => void; openMedia?: (target: GameMediaTarget) => void }) {
  const t = useT(), label = (key: string) => t(`games.warhammer.${key}`);
  const [data, setData] = useState<WarhammerConnections | null>(null), [failed, setFailed] = useState(false), [busy, setBusy] = useState(false), [attempt, setAttempt] = useState(0);
  const [faction, setFaction] = useState<WarhammerFaction>("marines"), [role, setRole] = useState<"all" | WarhammerRole>("all");
  const revision = useLiveRefresh(active, 31 * 60_000);
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); let received = false; setBusy(true); setFailed(false);
    void readWarhammerConnections().then(snapshot => { if (snapshot && !received && !request.signal.aborted) setData(snapshot); });
    void loadWarhammerConnections(request.signal).then(value => { received = true; if (!request.signal.aborted) { setData(value); setBusy(false); } }, () => { if (!request.signal.aborted) { setFailed(true); setBusy(false); } });
    return () => request.abort();
  }, [active, attempt, revision]);
  const games = data ? warhammerFactionGames(data, faction, role) : [];
  const external = (url: string) => (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); openUrl(url); };
  const showCatalog = () => {
    const heading = document.getElementById("games-warhammer-catalog");
    heading?.focus({ preventScroll: true });
    heading?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };
  const jump = (id: string) => {
    const section = document.getElementById(id), title = section?.querySelector<HTMLElement>("h2");
    title?.focus({ preventScroll: true }); section?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  };
  return <section className="games-warhammer-world" aria-labelledby="games-warhammer-title">
    <header className="games-warhammer-hero"><GameArt src={WARHAMMER_WORLD_ART} className="games-warhammer-hero-art" eager/><div className="games-warhammer-hero-copy"><GameArt src={WARHAMMER_LOGO} alt="Warhammer 40,000" className="games-warhammer-logo" eager/><h1 id="games-warhammer-title" tabIndex={-1}>{t("games.warhammerUniverse.title")}</h1><p>{t("games.warhammerUniverse.intro")}</p><div><button className="wh-action is-primary" onClick={() => jump("wh-story")}>{t("games.warhammerUniverse.start")}<ArrowDown size={20}/></button><a className="wh-action is-secondary" href={WARHAMMER_SETTING} target="_blank" rel="noreferrer" onClick={external(WARHAMMER_SETTING)}>{label("setting")}<ArrowUpRight size={20}/></a></div></div></header>
    <nav className="wh-section-nav" aria-label={t("games.warhammerUniverse.sections")}>{[["wh-story", "start"], ["wh-screen", "screen"], ["wh-lore", "lore"], ["wh-videos", "videos"]].map(([id, key]) => <button key={id} onClick={() => jump(id!)}>{t(`games.warhammerUniverse.${key}`)}</button>)}<button onClick={showCatalog}>{label("catalog")}</button></nav>
    <WarhammerStory active={active} game={data?.games.find(entry => entry.game.steamId === 2183900)?.game} open={open} openMedia={openMedia}/>
    <WarhammerScreenLibrary active={active} openMedia={openMedia}/>
    <WarhammerLoreLibrary active={active}/>
    <WarhammerCreatorVideos active={active}/>
    <h2 className="wh-faction-heading">{label("choose")}</h2>
    <div className="games-warhammer-faction-picker" aria-label={label("choose")}>{WARHAMMER_FACTIONS.map(value => <button key={value} aria-pressed={faction === value} onClick={() => { setFaction(value); setRole("all"); }}><span><GameArt src={WARHAMMER_FACTION_ART[value]}/></span>{label(`faction.${value}`)}</button>)}</div>
    <div className="games-warhammer-faction-copy"><div><h2>{label(`faction.${faction}`)}</h2><p>{label(`lore.${faction}`)}</p></div><a href={WARHAMMER_ARMIES} target="_blank" rel="noreferrer" onClick={external(WARHAMMER_ARMIES)}>{label("lore")}<ArrowUpRight size={15}/></a></div>
    <div className="games-warhammer-connections-heading"><p>{label("selected")}</p><div aria-label={label("role")}>{(["all", "play", "face"] as const).map(value => <button key={value} aria-pressed={role === value} onClick={() => setRole(value)}>{label(value)}</button>)}</div></div>
    {failed && <div className="games-warhammer-status" role="alert"><span>{label("unavailable")}</span><button className="games-button" onClick={() => setAttempt(value => value + 1)} disabled={busy}>{t("common.retry")}</button></div>}
    {data?.partial && <p className="games-warhammer-status" role="status">{label("partial")}</p>}
    {!data && busy ? <div className="games-warhammer-connections" aria-busy="true" aria-label={t("common.loading")}>{[0,1,2].map(index => <div className="games-warhammer-placeholder" key={index}><i className="games-detail-skeleton"/><b className="games-detail-skeleton"/><span className="games-detail-skeleton"/></div>)}</div> : <div className="games-warhammer-connections">{games.map(entry => <article key={entry.game.id}><GameCard game={entry.game} open={open}/><div className="games-warhammer-connection-role"><span>{label(entry.factions[faction]!)}</span><a href={entry.source} target="_blank" rel="noreferrer" aria-label={t("games.warhammer.evidence", { name: entry.game.name })} onClick={external(entry.source)}><ArrowUpRight size={14}/></a></div></article>)}</div>}
    {data && !games.length && <p className="games-warhammer-status" role="status">{label("empty")}</p>}
    <footer><span>{label("scope")}</span><GameDataStatus at={data?.cachedAt} refresh={() => setAttempt(value => value + 1)} busy={busy}/></footer>
    <h2 id="games-warhammer-catalog" className="games-warhammer-catalog-title" tabIndex={-1}>{label("catalog")}</h2>
  </section>;
}
