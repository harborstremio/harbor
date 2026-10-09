import { useEffect, useState } from "react";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadGameRatings, type GameRating } from "@/lib/games/ratings";
import type { GameSummary } from "@/lib/games/types";
import { openUrl } from "@/lib/window";
import { GameArt } from "./game-art";
import { HoverTooltip } from "@/components/hover-tooltip";

export function scoreTone(score: number) { return score >= 75 ? "high" : score >= 50 ? "mixed" : "low"; }

export function RatingMark({source}:{source:GameRating["source"]}) {
  const brand=source.startsWith("igdb-")?"igdb":source;
  return <GameArt className={`games-rating-mark games-rating-${brand}`} src={`/games/brands/${brand}.svg`}/>;
}

/** The combined IGDB score is already part of atlas pages; no per-card fetch. */
export function GameCatalogRating({ score, count, open }: { score?: number; count: number; open: () => void }) {
  const t = useT(), language = useUiLanguage();
  if (score === undefined || !Number.isFinite(score) || score < 0 || score > 100 || count <= 0) return null;
  return <HoverTooltip className="games-studio-rating-tab" label={t("games.discovery.ratingCombined")}
    sublabel={t("games.discovery.ratingCombinedNote", { count: count.toLocaleString(language) })}
    mark={<RatingMark source="igdb-users"/>} arrow side="top" align="center">
    <button data-score-tone={scoreTone(score)} aria-label={t("games.discovery.ratingCombinedValue", { score: Math.round(score) })} onClick={open}>
      <strong>{Math.round(score)}<small>/100</small></strong>
    </button>
  </HoverTooltip>;
}

/** Only active previews or visible chart rows request enrichment; leaving cancels queued work. */
export function GameDiscoveryRatings({ game, active, compact = false, initialRatings = [] }: { game: GameSummary; active: boolean; compact?: boolean; initialRatings?: GameRating[] }) {
  const t=useT(),language=useUiLanguage();
  const [ratings,setRatings]=useState<GameRating[]>([]),[loaded,setLoaded]=useState(false);
  useEffect(()=>{
    if(!active||loaded)return;
    const request=new AbortController();
    const timer=setTimeout(()=>{void loadGameRatings(game,request.signal).then(value=>{
      if(!request.signal.aborted){setRatings(value);setLoaded(true);}
    },()=>{if(!request.signal.aborted)setLoaded(true);});},250);
    return()=>{clearTimeout(timer);request.abort();};
  },[active,game,loaded]);
  const displayed=ratings.length?ratings:initialRatings;
  if(!loaded&&!displayed.length)return <div className="games-season-rating-skeleton" aria-busy="true"><span className="sr-only">{t("games.discovery.ratingsLoading")}</span><i/><i/></div>;
  if(!displayed.length)return null;
  return <div className={`games-discovery-ratings${compact?" is-compact":""}`} role="group" aria-label={t("games.details.ratings")}>{displayed.map(rating=>{
    const label=rating.source==="steam"&&rating.verdict?t(`games.discovery.steamVerdict.${rating.verdict}`):t(`games.discovery.rating.${rating.source}`);
    const tone=rating.source==="steam"&&rating.verdict?(rating.verdict.includes("Negative")?"low":rating.verdict==="Mixed"?"mixed":"high"):scoreTone(rating.score);
    const explanation=[t(`games.discovery.ratingNote.${rating.source}`),rating.count?t("games.discovery.ratingCount",{count:rating.count.toLocaleString(language)}):"",rating.cachedAt?t("games.cache.saved",{date:new Date(rating.cachedAt).toLocaleString(language)}):""].filter(Boolean).join(" · ");
    return <HoverTooltip key={rating.source} label={label} sublabel={explanation} mark={<RatingMark source={rating.source}/>} arrow side="top" align="center"><a data-rating-source={rating.source} href={rating.url} onClick={e=>{e.preventDefault();openUrl(rating.url);}} aria-label={`${label}: ${Math.round(rating.score)}${rating.kind==="positive-reviews"?"%":"/100"}. ${explanation}`}><strong data-score-tone={tone}>{Math.round(rating.score)}<small>{rating.kind==="positive-reviews"?"%":"/100"}</small></strong><span><RatingMark source={rating.source}/>{!compact&&label}</span></a></HoverTooltip>;
  })}</div>;
}
