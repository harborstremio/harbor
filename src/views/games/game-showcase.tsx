import { NavArrow } from "@/components/nav-arrow";
import { GameAvailabilityBadge } from "./game-availability";
import { GameHeroSkeleton } from "./game-loading";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useEffect, useLayoutEffect, useState } from "react";
import { Heart, Gamepad2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { loadExploreVisit, recordExploreVisit, type ExploreVisit } from "@/lib/games/explore-visit";
import { GameDataStatus } from "./game-data-status";
import { GameHeroLogo } from "./game-hero-logo";
import { genreCatalogTag, type CatalogFilters } from "@/lib/games/catalog-filters";
import { gameHeroSources } from "@/lib/games/hero-art";

import { GameShowcaseMedia, HERO_TIMING } from "./game-showcase-media";
import { useHeroMotion } from "./use-hero-motion";
import { GameDiscoveryRatings } from "./game-discovery-ratings";

export function GameShowcase({ active, open, save, isSaved, visit, browse }: {
  visit: ExploreVisit;
  browse: (filters: Partial<CatalogFilters>) => void;
  active: boolean; open: (game: GameSummary) => void; save: (game: GameSummary) => void; isSaved: (game: GameSummary) => boolean;
}) {
  const t = useT();
  const [games, setGames] = useState<GameDetail[]>(() => [...visit.games]);
  const [selected, setSelected] = useState<number | undefined>(visit.selected);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [page,setPage] = useState(visit.page);
  const [slots,setSlots] = useState(3);
  useEffect(() => {
    if (!active) return;
    let current = true;
    setFailed(false);
    void loadExploreVisit(visit, () => {
      if (current) { setGames([...visit.games]); setSelected(visit.selected); }
    }, attempt > 0 || !!visit.detailsAt && Date.now() - visit.detailsAt > 15 * 60_000).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [active, attempt, visit]);
  const ordered = games;
  const game = ordered.find(item => item.steamId === selected) ?? ordered[0];
  useEffect(() => { visit.selected = selected; visit.page = page; }, [visit, selected, page]);
  const [motion, setMotion] = useState(true);
  const [hovered, setHovered] = useState(false);
  const [artworkReady, setArtworkReady] = useState('');
  const { root, playing, visible } = useHeroMotion(active, !!game, motion);
  useEffect(() => {
    if (active && visible && game && artworkReady === game.id) recordExploreVisit(visit, game.steamId);
  }, [active, visible, game?.id, artworkReady, visit]);
  useLayoutEffect(()=>{setHovered(!!root.current?.querySelector('button:hover,a:hover'));},[!!game]);
  useLayoutEffect(()=>{const el=root.current;if(!el)return;const measure=()=>{if(el.clientWidth>0)setSlots(el.clientWidth<650?2:3);};measure();const observer=new ResizeObserver(measure);observer.observe(el);return()=>observer.disconnect();},[!!game,active]);
  const pages=Math.ceil(ordered.length/slots),currentPage=Math.min(page,Math.max(0,pages-1));
  useEffect(()=>{const index=ordered.findIndex(item=>item.steamId===selected);if(index>=0)setPage(Math.floor(index/slots));},[selected,slots]);
  const orderedIdentity=ordered.map(item=>item.steamId).join(',');
  useEffect(()=>{
    if(!playing||hovered||!game||artworkReady!==game.id||ordered.length<2)return;
    const timer=setTimeout(()=>{
      // Also check the DOM: the pointer can already be here when the hero mounts.
      if(!!root.current?.querySelector('button:hover,a:hover')||root.current?.querySelector(':focus-visible'))return;
      const next=(ordered.findIndex(item=>item.id===game.id)+1)%ordered.length;
      setSelected(ordered[next].steamId);setPage(Math.floor(next/slots));
    },HERO_TIMING.nextGame);
    return()=>clearTimeout(timer);
  },[playing,hovered,game?.id,artworkReady,orderedIdentity,slots,currentPage]);
  const nextGame=ordered[(ordered.findIndex(item=>item.id===game?.id)+1)%ordered.length];
  useEffect(()=>{
    if(!playing||!nextGame||nextGame.id===game?.id)return;
    const image=new Image();image.src=gameHeroSources(nextGame)[0]??"";
    return()=>{image.src='';};
  },[playing,game?.id,nextGame?.id,nextGame?.libraryHero,nextGame?.hero]);
  if (!game) return <GameHeroSkeleton failed={failed} retry={() => setAttempt(value => value + 1)}/>;
  return <section ref={root} className="games-showcase games-home-hero games-cycle-hero" aria-label={t("games.featuredSelection")}
    onPointerOver={event=>setHovered(!!(event.target as Element).closest("button,a"))} onPointerLeave={()=>setHovered(false)}
    onFocusCapture={event=>{if(event.target.matches(':focus-visible'))setMotion(false);}} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))setMotion(true);}}>
    <GameShowcaseMedia game={game} playing={playing} onReady={setArtworkReady}/>
    <div className="games-showcase-shade" />
    <div className="games-showcase-content games-inset" key={game.id} data-game={game.id}>
      <div className="games-showcase-identity"><GameHeroLogo className="games-showcase-logo" sources={[game.logo]} name={game.name} steamId={game.steamId} platformIds={[]} ready active={active && visible} preferCurrentSteamLogo/><h2 className="games-showcase-name">{game.name}</h2></div>
      <div className="games-showcase-metadata">
        <div className="games-showcase-facts"><GameAvailabilityBadge game={game} inline iconOnly/>
          {game.developers[0] && <button onClick={() => browse({ developer: game.developers[0] })}>{game.developers[0]}</button>}
          {(/\b(?:19|20)\d{2}\b/.exec(game.release)?.[0]) && <span>{/\b(?:19|20)\d{2}\b/.exec(game.release)?.[0]}</span>}
          {game.controller && <HoverTooltip label={t(game.controller === "full" ? "games.fullController" : "games.partialController")} side="top"><button aria-label={t("games.controller")} onClick={() => browse({ controller: true })}><Gamepad2 size={17}/></button></HoverTooltip>}
        </div>
        {!!game.genres.length && <div className="games-showcase-genres">{game.genres.slice(0, 4).map(genre => {
          const tag = genreCatalogTag(genre);
          return tag ? <button key={genre} onClick={() => browse({ tags: [tag] })}>{genre}</button> : <span key={genre}>{genre}</span>;
        })}</div>}
      </div>
      <p className="games-showcase-deck is-description">{game.description}</p>
      <div className="games-actions">
        <button className="games-button games-hero-open" onClick={() => open(game)}><Play size={24}/>{t("games.discovery.viewGame")}</button>
        <HoverTooltip label={t(isSaved(game) ? "games.saved" : "games.save")} side="top" align="center">
          <button className="games-showcase-save" aria-label={t(isSaved(game) ? "games.saved" : "games.save")} aria-pressed={isSaved(game)} onClick={() => save(game)}>
            <Heart size={28} fill={isSaved(game) ? "currentColor" : "none"} aria-hidden="true"/>
          </button>
        </HoverTooltip>
      </div>
      <GameDataStatus at={game.cachedAt} refresh={() => setAttempt(value => value + 1)} />
    </div>
    {ordered.length > 1 && <>{([-1,1] as const).map(direction => <NavArrow key={direction} dir={direction < 0 ? "left" : "right"} size={32} label={t(direction < 0 ? "Previous" : "Next")} className={`games-cycle-arrow ${direction < 0 ? "is-previous" : "is-next"}`} onClick={() => setSelected(ordered[(ordered.findIndex(item => item.id === game.id) + direction + ordered.length) % ordered.length].steamId)}/>)}</>}
    {ordered.length > 1 && <div className="games-hero-dots" aria-label={t("games.featuredSelection")}>{ordered.map(item => <button key={item.id} aria-label={item.name} aria-current={item.id === game.id ? "true" : undefined} onClick={() => setSelected(item.steamId)}/>)}</div>}
    <div className="games-showcase-ratings games-inset"><GameDiscoveryRatings key={game.id} game={game} active={active&&visible}/></div>

  </section>;
}
