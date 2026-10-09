import { GamePageRows, GamePageRow } from "./game-page-rows";
import type { ReactNode } from "react";
import { useHeroShuffle } from "./use-hero-shuffle";
import { useHeroMotion } from "./use-hero-motion";
import { NavArrow } from "@/components/nav-arrow";
import { UiIcon } from "@/components/ui-icon";
import { GameHackVideoRow } from "./game-hack-video-row";
import { Row } from "@/components/row";
import { isRomHack, hackRelease } from "@/lib/games/hack-catalog";
import { Play } from "@/components/icons/play-filled";
import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, Bookmark, Check, Library } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { openUrl } from "@/lib/window";
import { loadAtlasPage } from "@/lib/games/atlas";
import { loadHackSpotlights } from "@/lib/games/hack-discovery";
import { HACK_COMMUNITIES, hackVideos, hackGameplaySearch } from "@/lib/games/hack-editorial";
import { DEFAULT_ATLAS_FILTERS, ROM_HACK_PLATFORMS, type AtlasGame, type AtlasRoute } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GamePatchLauncher } from "./game-patch";
import { useOptionalGameAccess } from "./game-access";
import { GameDataStatus } from "./game-data-status";
import { useHackVideo } from "./game-hack-video";
import "./game-hack-hub.css";

export function hackRoute(game: GameSummary, retro = true): AtlasRoute {
  return { kind: retro ? "romhacks" : "hacks", name: game.name, baseGame: game, image: game.portrait };
}

export function GameHackHeading({ route, games, browse, open, emulate, active, children, onVisibilityChange }: { onVisibilityChange?: (hidden: string[]) => void; children?: ReactNode; route: AtlasRoute; games: AtlasGame[]; browse: (route: AtlasRoute) => void; open: (game: GameSummary) => void; emulate: (system: number) => void; active: boolean }) {
  const t = useT(), watch = useHackVideo();
  const [spotlights, setSpotlights] = useState<AtlasGame[]>([]), [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(false), [selection,setSelection] = useState(0), [hovered,setHovered] = useState(false), [focused,setFocused] = useState(false);
  const baseId = route.baseGame?.igdbId;
  useEffect(() => {
    if (!active) return;
    const request = new AbortController(); setFailed(false);
    void loadHackSpotlights(request.signal, baseId).then(rows => { if (!request.signal.aborted) { setSpotlights(rows); setReady(true); } }, () => { if (!request.signal.aborted) { setFailed(true); setReady(true); } });
    return () => request.abort();
  }, [active, attempt, baseId]);
  const scoped = spotlights.filter(game => isRomHack(game) && (!baseId || game.parent?.igdbId === baseId));
  const choices = useHeroShuffle(scoped, active).slice(0, 4);
  const featured = choices[selection % Math.max(1, choices.length)];
  const {root,playing} = useHeroMotion(active, !!featured, true);
  const choiceIds = choices.map(game => game.id).join(',');
  useEffect(() => {setSelection(0);}, [baseId, active]);
  useEffect(() => {
    if (!playing || hovered || focused || choices.length < 2) return;
    const timer = setTimeout(() => {
      if (root.current?.querySelector('button:hover,a:hover') || root.current?.querySelector(':focus-visible')) return;
      setSelection(value => (value + 1) % choices.length);
    }, 8500);
    return () => clearTimeout(timer);
  }, [playing, hovered, focused, selection, choiceIds]);
  const parents = [...new Map([...spotlights, ...games].filter(isRomHack).flatMap(game => game.parent ? [[game.parent.id, game.parent] as const] : [])).values()];
  const featuredProject = featured ? hackRelease(featured)?.page ?? featured.projectUrl : undefined;
  const featuredClip = featured ? hackVideos(featured)[0] : undefined;
  const librarySystem = featured?.platformLinks.find(platform => (ROM_HACK_PLATFORMS as readonly number[]).includes(platform.id))?.id ?? 24;
  return <>
    <section ref={root} className="games-hack-lead games-cycle-hero" onPointerOver={event => setHovered(!!(event.target as Element).closest("button,a"))} onPointerLeave={() => setHovered(false)} onFocusCapture={event => setFocused(event.target.matches(':focus-visible'))} onBlurCapture={event => {if(!event.currentTarget.contains(event.relatedTarget))setFocused(false);}} data-state={featured ? "ready" : !ready ? "loading" : "empty"}>
    {featured && <div className="games-hack-scene" key={featured.id}><GameArt src={featured.hero} fallback={featured.portrait} eager/></div>}
    <div className="games-hack-shade"/>
    <header className="games-hack-heading">
      <div className="games-hack-heading-label"><h1 tabIndex={-1}>{route.baseGame ? t("games.hub.hacksFor", { name: route.baseGame.name }) : t(route.kind === "hacks" ? "games.atlas.hacks" : "games.hub.title")}</h1></div>
      <div className="games-hack-tools"><HoverTooltip label={t("games.emulation.openLibrary")} align="end"><button className="games-icon-button" onClick={() => emulate(librarySystem)} aria-label={t("games.emulation.openLibrary")}><Library size={21}/></button></HoverTooltip></div>
    </header>
    {featured ? <section className="games-hack-feature" aria-label={t("games.hub.spotlight")}>
      <div className="games-hack-feature-copy"><span className="games-section-kicker">IGDB · {t("games.roms.sort.discussed")}<span> / </span>{featured.platforms.join(" · ")}</span>
        <div className="games-hack-feature-title"><GameArt src={featured.portrait ?? featured.capsule} eager/><h2>{featured.name}</h2></div>
        <p>{featured.description.split("\n")[0]}</p>
        {featured.parent && <button className="games-hack-lineage" onClick={() => open(featured.parent!)}><GameArt src={featured.parent.portrait ?? featured.parent.capsule}/><span>{t("games.atlas.basedOn")}<strong>{featured.parent.name}</strong></span><ArrowUpRight className="games-hack-hover-arrow" size={15}/></button>}
        <div className="games-actions"><button className="games-hack-primary" onClick={() => open(featured)}><Play size={21}/>{t("games.discovery.viewGame")}</button>{featuredClip && <HoverTooltip label={t("games.hub.watch")} side="top" align="center"><button className="games-hack-watch-button" aria-label={t("games.hub.watch")} onClick={() => watch(featuredClip)}><UiIcon name="trailer" className="games-hack-trailer-icon"/></button></HoverTooltip>}{featuredProject && <HoverTooltip label={t("games.hub.project")}><a className="games-icon-button games-hack-project-action" href={featuredProject} aria-label={t("games.hub.project")} onClick={e => { e.preventDefault(); void openUrl(featuredProject!); }}><ArrowUpRight size={20}/></a></HoverTooltip>}</div>
      </div>
    </section> : !ready ? <div className="games-hack-feature games-hack-feature-loading" aria-busy="true" aria-label={t("common.loading")}><div className="games-skeleton"/><div className="games-skeleton"/><div className="games-skeleton"/></div> : failed || !baseId ? <div className="games-inline-status"><span>{t("games.hub.featuredUnavailable")}</span><button className="games-text-action" onClick={() => { setReady(false); setAttempt(n => n + 1); }}>{t("common.retry")}</button></div> : null}
    {choices.length > 1 && <><NavArrow dir="left" size={32} label={t("Previous")} className="games-cycle-arrow is-previous" onClick={() => setSelection(value => (value - 1 + choices.length) % choices.length)}/><NavArrow dir="right" size={32} label={t("Next")} className="games-cycle-arrow is-next" onClick={() => setSelection(value => (value + 1) % choices.length)}/></>}
    {choices.length > 1 && <div className="games-hero-dots" aria-label={t("games.hub.spotlight")}>{choices.map((item,i) => <button key={item.id} aria-label={item.name} aria-current={item.id === featured?.id ? "true" : undefined} onClick={() => setSelection(i)}/>)}</div>}
    {featured?.cachedAt !== undefined && <GameDataStatus at={featured.cachedAt} refresh={() => setAttempt(n => n + 1)}/>}
    </section>
    {route.baseGame && <div className="games-hack-route-actions"><button className="games-text-action" onClick={() => browse({ kind: route.kind, name: t("games.hub.title") })}>{t("games.hub.allHacks")}<ArrowRight size={15}/></button><button className="games-text-action" onClick={() => open(route.baseGame!)}>{t("games.hub.viewOriginal")}<ArrowUpRight size={15}/></button></div>}
    <GamePageRows page="games-rom-hacks" active={active} onVisibilityChange={onVisibilityChange}>
      <GamePageRow id="originals" title={t("games.hub.byOriginal")}>{!route.baseGame && parents.length > 0 && <section className="games-hack-parents"><div className="games-section-heading"><h2>{t("games.hub.byOriginal")}</h2><span>{t("games.hub.originalNote")}</span></div><Row className="games-hack-originals" min={130} shape="portrait" scrollKey="hack-originals" arrowsAlways>{parents.map(parent => <article key={parent.id}><button className="games-hack-original" onClick={() => browse(hackRoute(parent, route.kind === "romhacks"))}><GameArt src={parent.portrait ?? parent.capsule}/><strong>{parent.name}</strong><span>{parent.platforms.join(" · ")}</span></button><HoverTooltip label={t("games.hub.viewOriginal")}><button className="games-hack-original-info" onClick={() => open(parent)} aria-label={`${t("games.hub.viewOriginal")}: ${parent.name}`}><ArrowUpRight size={16}/></button></HoverTooltip></article>)}</Row></section>}</GamePageRow>
      <GamePageRow id="videos" title={t("games.hub.watchTitle")}><GameHackVideoRow baseId={baseId} active={active}/></GamePageRow>
      <GamePageRow id="guide" title={t("games.hub.how")}><details className="games-hack-guide"><summary><img className="games-hack-guide-art" src="/games/rom-hack-workshop.svg" alt=""/><span><strong>{t("games.hub.how")}</strong><small>{t("games.hub.toolkitNote")}</small></span><span className="games-hack-guide-formats">BPS · IPS · UPS</span></summary><ol><li><span>01</span><div><h3>{t("games.hub.project")}</h3><p>{t("games.hub.stepFind")}</p><p>{t("games.hub.baseVersion")}</p></div></li><li><span>02</span><div><h3>{t("games.patch.open")}</h3><p>{t("games.hub.stepPatch")}</p><GamePatchLauncher/></div></li><li><span>03</span><div><h3>{t("games.emulation.openLibrary")}</h3><p>{t("games.hub.stepPlay")}</p><button className="games-text-action" onClick={() => emulate(24)}>{t("games.emulation.openLibrary")}<ArrowRight size={15}/></button></div></li></ol></details></GamePageRow>
      <GamePageRow id="catalog" title={t("games.hub.allHacks")}>
    <div className="games-hack-catalog-heading"><h2>{t("games.hub.allHacks")}</h2><p>{t("games.hub.catalogNote")}</p></div>
        {children}
      </GamePageRow>
      <GamePageRow id="resources" title={t("games.hub.resources")}><GameHackResources/></GamePageRow>
    </GamePageRows>
  </>;
}

export function GameHackCard({ game, open, browse }: { game: AtlasGame; open: (game: GameSummary) => void; browse: (route: AtlasRoute) => void }) {
  const t = useT(), access = useOptionalGameAccess(), watch = useHackVideo();
  const projectUrl = hackRelease(game)?.page ?? game.projectUrl;
  const saved = !!access?.saved.some(value => value.id === game.id), clip = hackVideos(game)[0];
  return <article className="games-hack-card">
    <button className="games-hack-card-main" data-game={game.id} onClick={() => open(game)}><span className="games-hack-card-art"><GameArt src={game.screenshots[0] ?? game.hero} fallback={game.portrait}/><GameArt className="games-hack-card-cover" src={game.portrait ?? game.capsule}/></span><span className="games-hack-card-copy"><small>{game.platforms.join(" · ")}</small><h3>{game.name}</h3><p>{game.description}</p></span></button>
    <footer>{game.parent ? <button className="games-hack-base" onClick={() => browse(hackRoute(game.parent!, game.platformLinks.some(p => (ROM_HACK_PLATFORMS as readonly number[]).includes(p.id))))}><GameArt src={game.parent.portrait ?? game.parent.capsule}/><span><small>{t("games.atlas.basedOn")}</small><strong>{game.parent.name}</strong></span></button> : <span className="games-hack-base"><small>{t("games.hub.baseUnlisted")}</small></span>}{access && <HoverTooltip label={t(saved ? "games.saved" : "games.save")} align="end"><button className="games-icon-button" aria-pressed={saved} aria-label={t(saved ? "games.saved" : "games.save") + ": " + game.name} onClick={() => access.save(game)}>{saved ? <Check size={18}/> : <Bookmark size={18}/>}</button></HoverTooltip>}</footer>
    <div className="games-hack-card-links"><div className="games-hack-card-secondary">{clip ? <button onClick={() => watch(clip)}><UiIcon name="trailer" className="games-hack-trailer-icon"/>{t("games.hub.watch")}</button> : <a href={hackGameplaySearch(game.name)} onClick={e => { e.preventDefault(); void openUrl(e.currentTarget.href); }}><UiIcon name="trailer" className="games-hack-trailer-icon"/>{t("games.hub.findVideos")}</a>}{projectUrl && <a href={projectUrl} onClick={e => { e.preventDefault(); void openUrl(projectUrl!); }}>{t("games.hub.project")}<ArrowUpRight className="games-hack-hover-arrow" size={13}/></a>}</div><GamePatchLauncher game={game} className="games-hack-get-files"/></div>
  </article>;
}

export function GameHackResources() {
  const t = useT();
  return <section className="games-hack-resources"><h2>{t("games.hub.resources")}</h2><div>{HACK_COMMUNITIES.map(site => <a key={site.name} href={site.url} onClick={e => { e.preventDefault(); void openUrl(site.url); }}><img className="games-hack-community-logo" src={`https://www.google.com/s2/favicons?domain=${new URL(site.url).hostname}&sz=64`} alt="" loading="lazy"/><span><strong>{site.name}</strong><small>{site.system}</small></span><ArrowUpRight size={17}/></a>)}</div></section>;
}

/** Only a provider relationship exposes a game's related hacks; titles are never fuzzy-matched. */
export function GameHackRelations({ game, active, browse, open }: { game: AtlasGame; active: boolean; browse: (route: AtlasRoute) => void; open: (game: GameSummary) => void }) {
  const t=useT(), projectUrl=hackRelease(game)?.page ?? game.projectUrl;
  const [result,setResult]=useState<{id:string;games:AtlasGame[];cachedAt?:number}>();
  const [failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    if(!active||game.gameType===5)return;
    const request=new AbortController();setFailed(false);
    void loadAtlasPage(hackRoute(game,false),DEFAULT_ATLAS_FILTERS,0,request.signal).then(page=>{if(!request.signal.aborted)setResult({id:game.id,...page});},()=>{if(!request.signal.aborted)setFailed(true);});
    return()=>request.abort();
  },[active,game.id,game.gameType,attempt]);
  if(game.gameType===5&&!game.platformLinks.some(platform=>(ROM_HACK_PLATFORMS as readonly number[]).includes(platform.id)))return null;
  if(game.gameType===5)return <section className="games-hack-install games-section games-inset"><div><h2>{t("games.hub.makePlayable")}</h2><p>{t(hackRelease(game)?.method === "modpack" ? "games.hub.packNote" : "games.hub.installNote")}</p>{game.parent&&<button className="games-text-action" onClick={()=>browse(hackRoute(game.parent!,false))}>{t("games.hub.moreFor",{name:game.parent.name})}<ArrowRight size={16}/></button>}</div><div className="games-actions">{projectUrl&&<a className="games-button" href={projectUrl} onClick={e=>{e.preventDefault();openUrl(projectUrl!);}}>{t("games.hub.project")}<ArrowUpRight size={16}/></a>}<GamePatchLauncher game={game}/></div></section>;
  if(failed)return <div className="games-inline-status games-inset"><span>{t("games.hub.relatedError")}</span><button className="games-text-action" onClick={()=>setAttempt(n=>n+1)}>{t("common.retry")}</button></div>;
  if(result?.id!==game.id||!result.games.length)return null;
  return <section className="games-section games-inset games-hack-relations"><div className="games-section-heading"><div><h2>{t("games.hub.related")}</h2><p>{t("games.hub.relatedNote",{name:game.name})}</p></div><button className="games-text-action" onClick={()=>browse(hackRoute(game,false))}>{t("games.hub.allHacks")}<ArrowRight size={17}/></button></div><div className="games-hack-grid">{result.games.slice(0,3).map(hack=><GameHackCard key={hack.id} game={hack} open={open} browse={browse}/>)}</div><GameDataStatus at={result.cachedAt} refresh={()=>setAttempt(n=>n+1)}/></section>;
}
