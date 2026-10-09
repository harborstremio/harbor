import { useEffect, useRef, useState } from "react";
import { observeWithin } from "@/lib/visibility";
import { Row } from "@/components/row";
import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import { loadStoreSelectionPage } from "@/lib/games/catalog";
import type { GameSummary } from "@/lib/games/types";
import { savedMetadataAt } from "@/lib/games/metadata-records";
import { GameCard, GameMark } from "./game-ui";
import { GamePosterSkeletons } from "./game-loading";
import { GameDataStatus } from "./game-data-status";
import { usePagedGameRow, useRowNavigation } from "./use-paged-game-row";
import "./game-row-motion.css";

export function useStoreRow(filter:"popularnew"|"popularcomingsoon", active:boolean, initial:GameSummary[]) {
  const root=useRef<HTMLElement>(null),[near,setNear]=useState(false);
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node, "500px", entry => { if (entry.isIntersecting) setNear(true); });},[]);
  const row=usePagedGameRow({id:filter,active:active&&near,load:async(offset,signal)=>{const page=await loadStoreSelectionPage(filter,offset,signal);return {...page,cachedAt:savedMetadataAt(page)};},snapshot:async()=>initial.length?{games:initial,nextOffset:0,cachedAt:savedMetadataAt(initial)}:null});
  return {root,row};
}

export function GameRowArrows({row,navigation}:{row:ReturnType<typeof usePagedGameRow<GameSummary>>;navigation:ReturnType<typeof useRowNavigation<GameSummary>>}) {
  const t=useT();
  return <div className="games-page-controls" aria-busy={row.busy}><span dir="ltr">{navigation.page+1}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!navigation.page} aria-disabled={!navigation.page||row.busy} onClick={()=>void navigation.go(navigation.page-1)}><NavChevron dir="left" size={18}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={!navigation.hasNext} aria-disabled={!navigation.hasNext||row.busy} onClick={()=>void navigation.go(navigation.page+1)}><NavChevron dir="right" size={18}/></button></div>;
}

export function GameUpcoming({active,games,open}:{active:boolean;games:GameSummary[];open:(game:GameSummary)=>void}) {
  const t=useT(),{root,row}=useStoreRow("popularcomingsoon",active,games);
  return <section ref={root} className="games-section games-inset games-poster-section games-upcoming-row">
    <div className="games-section-heading"><div><div className="games-section-kicker"><GameMark kind="soon"/>{t("games.onTheHorizon")}</div><h2>{t("games.coming_soon")}</h2><p>{t("games.coming_soonNote")}</p></div></div>
    {row.games.length?<Row min={160} shape="portrait" scrollKey="games:upcoming" onEndReached={()=>{if(!row.busy&&!row.failed&&row.nextOffset!==null)void row.more(row.games.length+12);}}>
      {row.games.map(game=><GameCard key={game.id} game={game} open={open} portrait showRelease/>)}
    </Row>:!row.loaded&&!row.failed?<GamePosterSkeletons/>:null}
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.charts.error")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    <GameDataStatus at={row.cachedAt} busy={row.busy} refresh={row.refresh}/>
  </section>;
}
