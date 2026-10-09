import { GameAvailabilityBadge } from "./game-availability";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Row } from "@/components/row";
import { useT } from "@/lib/i18n";
import { useInViewport, observeWithin } from "@/lib/visibility";
import { loadAtlasPage, readAtlasPageSnapshot } from "@/lib/games/atlas";
import { DEFAULT_ATLAS_FILTERS, type AtlasRoute } from "@/lib/games/igdb-data";
import type { GameSummary } from "@/lib/games/types";
import { GamePosterSave } from "./game-poster-save";
import { GameArt } from "./game-art";
import { GameDataStatus } from "./game-data-status";
import { usePagedGameRow } from "./use-paged-game-row";
import "./game-rails.css";

function HackContinuation({active,busy,cursor,more}:{active:boolean;busy:boolean;cursor:number;more:()=>void}) {
  const root=useRef<HTMLDivElement>(null),visible=useInViewport(root);
  useEffect(()=>{if(active&&visible&&!busy)more();},[active,visible,busy,cursor,more]);
  return <div ref={root} className="games-rom-skeleton" aria-hidden="true"/>;
}
export function GameRomShowcase({open,browse,active}:{open:(game:GameSummary)=>void;browse:(route:AtlasRoute)=>void;active:boolean}) {
  const t=useT(),root=useRef<HTMLElement>(null),[seen,setSeen]=useState(false);
  const route:AtlasRoute={kind:"romhacks",name:"ROM hacks"};
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node, "350px", entry => { if (entry.isIntersecting) setSeen(true); });},[]);
  const row=usePagedGameRow({id:"explore:romhacks",active:active&&seen,load:(offset,signal)=>loadAtlasPage(route,DEFAULT_ATLAS_FILTERS,offset,signal),snapshot:()=>readAtlasPageSnapshot(route,DEFAULT_ATLAS_FILTERS)});
  const more=()=>{if(!row.busy&&!row.failed&&row.loaded&&row.nextOffset!==null)void row.more(row.games.length+12);};
  return <section className="games-section games-inset games-rom-showcase" ref={root}><div className="games-rom-heading"><div><span>{t("games.romShowcase.eyebrow")}</span><h2>{t("games.romShowcase.title")}</h2><p>{t("games.romShowcase.note")}</p></div><button className="games-text-action" onClick={()=>browse({kind:"romhacks",name:t("games.romShowcase.title")})}>{t("games.romShowcase.browse")}<ArrowRight size={18}/></button></div>
    <Row className="games-content-rail games-hack-rail" min={144} shape="portrait" arrowsAlways scrollKey="games:explore:hacks" onEndReached={more}>
      {row.games.map(game=><div key={game.id} className="games-save-card"><button className="games-rom-card" data-game={game.id} onClick={()=>open(game)}><span className="games-rom-cover"><GameArt src={game.portrait??game.capsule} fallback={game.capsule}/><GameAvailabilityBadge game={game}/></span><strong>{game.name}</strong><span>{game.platforms.join(" · ")}</span><span className="games-rom-detail">{t("games.exploreGame")}<ArrowRight size={15}/></span></button><GamePosterSave game={game}/></div>)}
      {!row.loaded&&!row.failed&&Array.from({length:6},(_,i)=><div className="games-rom-skeleton" key={i}/>)}
      {row.loaded&&row.nextOffset!==null&&!row.failed&&<HackContinuation active={active} busy={row.busy} cursor={row.nextOffset} more={more}/>}
    </Row>
    {row.loaded&&!row.games.length&&!row.failed&&<p className="games-inline-status">{t("games.romShowcase.empty")}</p>}
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.atlas.error")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    <GameDataStatus at={row.cachedAt} busy={row.busy} refresh={row.refresh}/>
  </section>;
}
