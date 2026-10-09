import { Play } from "@/components/icons/play-filled";
import { NavChevron } from "@/components/nav-arrow";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { GAME_COLLECTIONS, type GameCollection } from "@/lib/games/collections";
import { loadGameCatalog, loadGameDetail } from "@/lib/games/catalog";
import { preloadGameArt } from "@/lib/games/preload-art";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { usePageVisible } from "@/lib/visibility";
import { DEFAULT_CATALOG_FILTERS, type CatalogFilters } from "@/lib/games/catalog-filters";
import type { GameDetail, GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameCatalog } from "./game-catalog";
import "./game-collections.css";
import "./game-row-motion.css";

export function GameCollections({ open, active=true }: { open: (collection: GameCollection) => void; active?:boolean }) {
  const t=useT(), [page,setPage]=useState(0), [direction,setDirection]=useState(1), [columns,setColumns]=useState(3),root=useRef<HTMLElement>(null);
  useEffect(()=>{const node=root.current;if(!node)return;const measure=()=>{const width=node.querySelector<HTMLElement>(".games-collection-grid")?.clientWidth??node.clientWidth;if(width>0)setColumns(width<530?1:width<900?2:3);};measure();const observer=new ResizeObserver(measure);observer.observe(node);return()=>observer.disconnect();},[]);
  const slots=columns===1?3:columns*2;
  const pages=Math.ceil(GAME_COLLECTIONS.length/slots),current=Math.min(page,pages-1);
  const turn=(next:number)=>{setDirection(next<current?-1:1);setPage(next);};
  return <section className="games-section games-inset games-collections" ref={root}>
    <div className="games-section-heading"><div><h2>{t("games.discovery.collections")}</h2><p>{t("games.collectionNote")}</p></div><div className="games-page-controls"><span dir="ltr" aria-label={t("games.discovery.collectionPosition",{start:current*slots+1,end:Math.min((current+1)*slots,GAME_COLLECTIONS.length),total:GAME_COLLECTIONS.length})}>{current+1} / {pages}</span><button className="games-icon-button" disabled={!current} aria-label={t("common.previous")} onClick={()=>turn(current-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" disabled={current===pages-1} aria-label={t("common.next")} onClick={()=>turn(current+1)}><NavChevron dir="right" size={18}/></button></div></div>
    <div key={`${current}:${columns}`} className="games-collection-grid games-row-motion" data-direction={direction} style={{gridTemplateColumns:`repeat(${columns},minmax(0,1fr))`}}>{GAME_COLLECTIONS.slice(current*slots,(current+1)*slots).map(collection => <CollectionTile key={collection.id} collection={collection} active={active} open={()=>open(collection)}/>)}</div>
  </section>;
}

function CollectionTile({collection,active,open}:{collection:GameCollection;active:boolean;open:()=>void}) {
  const t=useT(),reduced=useReducedMotion(),visible=usePageVisible();
  const [hovered,setHovered]=useState(false),[focused,setFocused]=useState(false),[games,setGames]=useState<GameSummary[]>([]);
  const [preview,setPreview]=useState<{src:string;name:string;previous?:string}>();
  const index=useRef(0),running=active&&visible&&!reduced&&(hovered||focused);
  useEffect(()=>{
    if(!running||games.length)return;
    const request=new AbortController(),timer=setTimeout(()=>{
      void loadGameCatalog("",{...DEFAULT_CATALOG_FILTERS,tags:[collection.tag]},0,request.signal).then(page=>{
        if(!request.signal.aborted)setGames(page.games.filter(game=>game.steamId!==collection.feature).slice(0,5));
      },()=>{});
    },400);
    return()=>{clearTimeout(timer);request.abort();};
  },[running,games.length,collection.tag,collection.feature]);
  useEffect(()=>{
    if(!running||!games.length)return;
    const request=new AbortController();let timer:ReturnType<typeof setTimeout>;
    const next=async()=>{
      const game=games[index.current++%games.length],hero=game.steamId?`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.steamId}/library_hero.jpg`:game.capsule;
      const src=await preloadGameArt(hero,request.signal)?hero:await preloadGameArt(game.capsule,request.signal)?game.capsule:undefined;
      if(request.signal.aborted)return;
      if(src)setPreview(previous=>({src,name:game.name,previous:previous?.src}));
      timer=setTimeout(next,3200);
    };
    timer=setTimeout(next,1800);
    return()=>{clearTimeout(timer);request.abort();};
  },[running,games]);
  return <button className={`games-collection games-collection-${collection.id}`} onClick={open} onPointerEnter={event=>{if(event.pointerType!=="touch")setHovered(true)}} onPointerLeave={()=>setHovered(false)} onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}>
    <CollectionArt collection={collection}/>{preview?.previous&&<img className="games-collection-preview" src={preview.previous} alt=""/>}{preview&&<img key={preview.src} className="games-collection-preview is-current" src={preview.src} alt=""/>}<div className="games-collection-shade"/>
    <span className="games-collection-copy"><strong>{t(collection.titleKey??`games.collection.${collection.id}.title`)}</strong><small>{preview?.name??collection.featureName}</small></span><span className="games-collection-arrow"><Play size={18}/></span>
  </button>;
}

function CollectionArt({collection,eager=false}:{collection:GameCollection;eager?:boolean}) {
  const [game,setGame]=useState<GameDetail|null>(null);
  useEffect(()=>{let current=true;void loadGameDetail(collection.feature).then(value=>{if(current)setGame(value);},()=>{});return()=>{current=false;};},[collection.feature]);
  return <GameArt src={game?.libraryHero??game?.hero??`https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${collection.feature}/library_hero.jpg`} fallback={game?.screenshots[0]??game?.capsule} eager={eager}/>;
}

export function GameCollectionPage({ collection, open, back, active, shellBackAvailable = false, profile = "default" }: { collection: GameCollection; open: (game: GameSummary) => void; back: () => void; active:boolean; shellBackAvailable?: boolean; profile?: string }) {
  const t=useT(),[query,setQuery]=useState(""),[filters,setFilters]=useState<CatalogFilters>({...DEFAULT_CATALOG_FILTERS,tags:[collection.tag]});
  const input = useRef<HTMLInputElement>(null);
  const refine = (value: CatalogFilters) => setFilters({ ...value, tags: [...new Set([collection.tag, ...value.tags])] });
  return <article className="games-collection-page">
    <div className="games-collection-banner"><CollectionArt collection={collection} eager/><div className="games-collection-shade" />{!shellBackAvailable && <button className="games-back games-button" onClick={back}><ArrowLeft size={18} />{t("common.back")}</button>}<div className="games-inset games-collection-banner-copy"><h1 tabIndex={-1}>{t(collection.titleKey??`games.collection.${collection.id}.title`)}</h1><p>{collection.titleKey?t("games.rows.categoryNote",{category:t(collection.titleKey)}):t(`games.collection.${collection.id}.subtitle`)}</p><label className="games-collection-search"><Search size={18}/><input ref={input} value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("games.collection.search")} aria-label={t("games.collection.search")}/>{query && <button type="button" aria-label={t("games.clear")} onClick={() => { setQuery(""); requestAnimationFrame(() => input.current?.focus()); }}><X size={17}/></button>}</label></div></div>
    <GameCatalog profile={profile} embedded lockedTags={[collection.tag]} query={query} filters={filters} setFilters={refine} active={active} open={open} back={back} shellBackAvailable/>
  </article>;
}
