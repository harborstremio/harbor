import { Play } from "@/components/icons/play-filled";
import { observeWithin } from "@/lib/visibility";
import { Dropdown } from "@/components/dropdown";
import { loadGuideVideos } from "@/lib/games/guides-fetch";
import { guideVideoAge, type GuideVideoDate, type GuideVideoSort } from "@/lib/games/guide-video-options";
import { NavChevron } from "@/components/nav-arrow";
import { useEffect, useRef, useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { ROM_PLATFORMS, type RomFranchise } from "@/lib/games/rom-discovery";
import { franchiseArtwork } from "@/lib/games/franchise-artwork";
import { romCollectionArtwork } from "@/lib/games/rom-collection-artwork";
import { RETRO_LOGO_FOLDERS } from "@/lib/games/hero-logo-data";
import { romPreview, romConsoleNames, romCollectionScenes } from "@/lib/games/rom-presentation";
import { HACK_CREATOR_VIDEOS, type HackVideo } from "@/lib/games/hack-editorial";
import type { AtlasGame } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameHeroLogo } from "./game-hero-logo";
import { RomPendingCards } from "./rom-continuation";
import { useHackVideo } from "./game-hack-video";
import { RomMark } from "./game-rom-mark";

const featuredConsoleIds = [24, 19, 4, 7, 21];
export function RomConsoles({ all, platform, change, more }: { all?: boolean; platform?: number; change: (id: number) => void; more: () => void }) {
  const t = useT(), rail = useRef<HTMLDivElement>(null), [edges, setEdges] = useState({left:false,right:false});
  const systems = [...featuredConsoleIds.flatMap(id => ROM_PLATFORMS.find(system => system.id === id) ?? []), ...ROM_PLATFORMS.filter(system => !featuredConsoleIds.includes(system.id))];
  const measure = () => { const node=rail.current; if (!node) return; const box=node.getBoundingClientRect(), children=[...node.children].map(child=>child.getBoundingClientRect()); setEdges({left:children.some(child=>child.left<box.left-2),right:children.some(child=>child.right>box.right+2)}); };
  useEffect(() => { const node=rail.current; if (!node) return; const observer=new ResizeObserver(measure);observer.observe(node);measure();return ()=>observer.disconnect(); }, [all]);
  const move = (direction: number) => rail.current?.scrollBy({left:direction*rail.current.clientWidth,behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"instant":"smooth"});
  return <section className="games-section games-rom-hardware">
    <div className="games-section-heading"><div><h2>{t("games.roms.pickConsole")}</h2></div>{!all && <button className="games-text-action" onClick={more}>{t("games.roms.allConsoles")}</button>}</div>
    <div className="games-rom-device-rail"><div ref={rail} onScroll={measure} className={`games-rom-devices${all ? " is-all" : ""}`}>{systems.map(system => {
      return <button key={system.id} aria-label={system.name} aria-pressed={platform === system.id} onClick={() => change(system.id)}>
        <span className="games-rom-device-art"><GameArt src={system.image || ""}/></span>
        <span className="games-rom-device-label"><strong>{system.name}</strong></span>
      </button>;
    })}</div>{!all && <>{edges.left && <button className="games-rom-rail-arrow is-left" aria-label={t("Scroll left")} onClick={()=>move(-1)}><NavChevron dir="left" size={28}/></button>}{edges.right && <button className="games-rom-rail-arrow is-right" aria-label={t("Scroll right")} onClick={()=>move(1)}><NavChevron dir="right" size={28}/></button>}</>}</div>
  </section>;
}

function RomCollectionTile({ group, scene, choose }: { group: RomFranchise; scene: string; choose: (group: RomFranchise) => void }) {
  const root = useRef<HTMLButtonElement>(null), [near, setNear] = useState(false);
  useEffect(() => {
    const node = root.current; if (!node) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setNear(true); observer.disconnect(); } }, { root: node.closest('.games-view'), rootMargin: '500px' });
    observer.observe(node); return () => observer.disconnect();
  }, []);
  const artwork = romCollectionArtwork(group.name) ?? (group.kind === "franchise" && group.id === 60 ? { logo: "/games/roms/pokemon.svg", originalColor: true, hero: undefined } : franchiseArtwork(`${group.kind}:${group.id}`));
  return <button ref={root} onClick={() => choose(group)} aria-label={group.name}>
    <GameArt className="games-rom-world-scene" src={romCollectionArtwork(group.name)?.hero ?? scene}/><span className="games-rom-world-shade"/>
    {near && <GameHeroLogo sources={[artwork?.logo]} name={group.name} alternativeNames={group.games.flatMap(game => [game.name, ...(game.alternativeTitles?.map(title => title.name) ?? [])])} platformIds={Object.keys(RETRO_LOGO_FOLDERS).map(Number)} gameType={0} ready active className={`games-rom-world-logo${!artwork || artwork.originalColor ? " original-color" : ""}`}/>}
    <strong className="games-rom-world-name">{group.name}</strong><span className="games-rom-world-footer"><span>{group.name}</span></span>
  </button>;
}

export function RomCollections({ groups, all, busy, pending = false, choose, more }: { groups: RomFranchise[]; all?: boolean; busy: boolean; pending?: boolean; choose: (group: RomFranchise) => void; more: () => void }) {
  const t = useT(), scenes = romCollectionScenes(groups);
  return <section className="games-section games-rom-collections" aria-busy={busy}>
    <div className="games-section-heading"><div><h2>{t("games.roms.franchises")}</h2></div>{!all && <button className="games-text-action" onClick={more}>{t("games.roms.seeAll")}</button>}</div>
    <div className="games-rom-worlds">{groups.slice(0, all ? groups.length : 4).map(group => <RomCollectionTile key={`${group.kind}:${group.id}`} group={group} scene={scenes.get(`${group.kind}:${group.id}`) ?? ""} choose={choose}/>)}{(pending || busy && !groups.length) && <RomPendingCards count={4} worlds/>}</div>
    {!busy && !groups.length && <p className="games-inline-status">{t(busy ? "common.loading" : "games.roms.noFranchises")}</p>}
  </section>;
}

export function RomPopular({ games, busy, open, browse }: { games: AtlasGame[]; busy: boolean; open: (game: GameSummary) => void; browse: () => void }) {
  const t = useT();
  return <section className="games-section games-rom-popular">
    <div className="games-section-heading"><div><h2>{t("games.roms.popular")}</h2><p>{t("games.roms.popularNote")}</p></div><button className="games-text-action" onClick={browse}>{t("games.roms.seeAll")}</button></div>
    <div className="games-rom-chart">{games.slice(0, 9).map((game, index) => <button key={game.id} onClick={() => open(game)} data-game={game.id}>
      <span className="games-rom-rank" dir="ltr">{String(index + 1).padStart(2, "0")}</span><GameArt src={game.portrait || game.capsule}/>
      <span className="games-rom-chart-copy"><strong>{game.name}</strong><span>{romConsoleNames(game).join(" · ")}</span><small>{t("games.roms.ratingActivity", { count: game.ratingCount.toLocaleString() })}</small></span>
    </button>)}</div>
    {!games.length && <p className="games-inline-status">{t(busy ? "common.loading" : "games.roms.noCollection")}</p>}
  </section>;
}

export function RomVideos({ games, platform, active }: { games: AtlasGame[]; platform?: number; active: boolean }) {
  const t = useT(), language = useUiLanguage(), watch = useHackVideo(), root = useRef<HTMLElement>(null), [near, setNear] = useState(false);
  const [source, setSource] = useState<"classics" | "creators">(platform ? "classics" : "creators");
  const [order, setOrder] = useState<"featured" | GuideVideoSort>("featured"), [date, setDate] = useState<GuideVideoDate>("all"), [page, setPage] = useState(0), [attempt, setAttempt] = useState(0);
  type Video = HackVideo & {views?:number;published?:string};
  const [results, setResults] = useState<{key:string;videos:Video[];busy:boolean;failed:boolean}>({key:"",videos:[],busy:false,failed:false});
  useEffect(() => { const node=root.current;if(!node||!active)return;return observeWithin(node, "300px", entry => { if (entry.isIntersecting) setNear(true); }); }, [active]);
  const previews = [...new Map(games.flatMap(game => { const video = romPreview(game); return video ? [[video.id, video] as const] : []; })).values()];
  const featured: readonly HackVideo[] = source === "creators" ? HACK_CREATOR_VIDEOS : previews.slice(0, 4);
  const key = JSON.stringify([source, platform, order, date, featured.map(video=>[video.gameId,video.gameName])]);
  useEffect(() => {setSource(platform ? "classics" : "creators");}, [platform]);
  useEffect(() => setPage(0),[key]);
  useEffect(() => {
    if(!active||!near||order==="featured"||!featured.length)return;
    const request=new AbortController();setResults({key,videos:[],busy:true,failed:false});
    void Promise.allSettled(featured.map(async game=>{const found=await loadGuideVideos(game.gameName,"gameplay",false,request.signal,undefined,order,date);return found.items.map(video=>({id:video.id,title:video.title,creator:video.author,gameId:game.gameId,gameName:game.gameName,views:video.views,published:video.published}));})).then(batches=>{
      if(request.signal.aborted)return;
      const videos=[...new Map(batches.flatMap(batch=>batch.status==="fulfilled"?batch.value:[]).map(video=>[video.id,video])).values()];
      videos.sort((a,b)=>order==="popular"?(b.views??-1)-(a.views??-1):order==="newest"?guideVideoAge(a.published)-guideVideoAge(b.published):0);
      setResults({key,videos,busy:false,failed:batches.every(batch=>batch.status==="rejected")});
    });return()=>request.abort();
  },[active,near,key,attempt]);
  const videos: readonly Video[] = order==="featured"?featured:results.key===key?results.videos:[];
  const busy=featured.length>0&&order!=="featured"&&(results.key!==key||results.busy), failed=order!=="featured"&&results.key===key&&results.failed;
  const current=Math.min(page,Math.max(0,Math.ceil(videos.length/4)-1));
  return <section ref={root} className="games-section games-rom-videos" aria-busy={busy}>
    <div className="games-section-heading"><h2>{t("games.roms.watchTitle")}</h2><div className="games-rom-video-controls">{!platform && <div className="games-rom-video-switch" aria-label={t("games.roms.watchTitle")}><button aria-pressed={source === "classics"} onClick={() => setSource("classics")}>{t("games.roms.classics")}</button><button aria-pressed={source === "creators"} onClick={() => setSource("creators")}>{t("games.roms.creators")}</button></div>}
    <Dropdown ariaLabel={t("games.guides.order")} value={order} onChange={value=>setOrder(value as typeof order)} options={[{value:"featured",label:t("games.details.recommended")},{value:"popular",label:t("games.guides.mostViews")},{value:"newest",label:t("games.recent.date")}]}/>
    {order!=="featured"&&<Dropdown ariaLabel={t("games.guides.uploaded")} value={date} onChange={value=>setDate(value as GuideVideoDate)} options={["all","year","month","week"].map(value=>({value,label:t(`games.guides.date.${value}`)}))}/>}
    </div></div>
    <div className="games-rom-video-grid">{videos.slice(current*4,current*4+4).map(video => <button key={video.id} onClick={() => watch(video)} aria-label={`${t("games.roms.watchVideo")}: ${video.gameName}`}>
      <span className="games-rom-video-image">{near && <GameArt src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}/>}<span className="games-rom-video-play"><Play size={22}/></span></span>
      <strong>{order==="featured"?video.gameName:video.title}</strong><span>{video.creator || video.gameName}</span>{video.views!==undefined&&<small>{t("games.guides.views",{count:video.views.toLocaleString(language)})}</small>}
    </button>)}</div>
    {busy&&<p role="status">{t("common.loading")}</p>}{failed&&<div className="games-inline-status" role="alert"><span>{t("games.loadError")}</span><button className="games-text-action" onClick={()=>setAttempt(value=>value+1)}>{t("common.retry")}</button></div>}
    {!busy&&!failed&&!videos.length&&<p className="games-inline-status">{t("games.roms.noVideos")}</p>}
    {videos.length>4&&<div className="games-page-controls"><button className="games-icon-button" aria-label={t("common.previous")} disabled={!current} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={(current+1)*4>=videos.length} onClick={()=>setPage(current+1)}><NavChevron dir="right" size={18}/></button></div>}
  </section>;
}

export function RomLibraryEntry({ open }: { open: () => void }) {
  const t = useT();
  return <section className="games-rom-library-entry"><RomMark kind="library"/><div><h2>{t("games.roms.yourLibrary")}</h2><p>{t("games.roms.libraryNote")}</p></div><button className="games-button" onClick={open}>{t("games.roms.openLibrary")}</button></section>;
}
