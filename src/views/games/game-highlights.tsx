import { GameAvailabilityBadge } from "./game-availability";
import { observeWithin } from "@/lib/visibility";
import { Row } from "@/components/row";
import { useEffect, useRef, useState } from "react";
import { Play } from "@/components/icons/play-filled";
import { useT, useUiLanguage } from "@/lib/i18n";
import { HoverTooltip } from "@/components/hover-tooltip";
import { RatingMark, scoreTone } from "./game-discovery-ratings";
import { Dropdown } from "@/components/dropdown";
import { loadGameFavorites, readGameFavoritesSnapshot } from "@/lib/games/favorites";
import { rotateExplorePage } from "@/lib/games/explore-selection";
import { DEFAULT_FAVORITE_REVIEWS, GAME_FAVORITE_FILTERS, favoriteCatalogFilters, type FavoriteReviewFilters, type GameFavoriteFilter } from "@/lib/games/favorites-data";
import { GameFavoriteReviewFilters } from "./game-favorite-review-filters";
import type { CatalogFilters } from "@/lib/games/catalog-filters";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GamePosterSave } from "./game-poster-save";
import { GameDataStatus } from "./game-data-status";
import { usePagedGameRow } from "./use-paged-game-row";
import "./game-rails.css";
import "./games-discovery-refinement.css";

export function GameHighlights({open,browse,filter,setFilter,reviews,setReviews,active=true,visit=""}:{open:(game:GameSummary)=>void;browse:(filters:Partial<CatalogFilters>)=>void;filter:GameFavoriteFilter;setFilter:(filter:GameFavoriteFilter)=>void;reviews:FavoriteReviewFilters;setReviews:(reviews:FavoriteReviewFilters)=>void;active?:boolean;visit?:string}) {
  const t=useT(),language=useUiLanguage(),root=useRef<HTMLElement>(null),[near,setNear]=useState(false);
  useEffect(()=>{const node=root.current;if(!node)return;return observeWithin(node,"500px",entry=>{if(entry.isIntersecting)setNear(true);});},[]);
  const selection=`${filter}:${reviews.minCount}:${reviews.minPositive}`,filtered=!!(reviews.minCount||reviews.minPositive);
  const row=usePagedGameRow({id:`steam-favorites:${selection}:${visit}`,active:active&&near,load:async(offset,signal)=>{const page=await loadGameFavorites(filter,offset,signal,reviews);return {...page,games:rotateExplorePage(page.games,visit,offset)};},snapshot:async()=>{const page=await readGameFavoritesSnapshot(filter,reviews);return page?{...page,games:rotateExplorePage(page.games,visit,0)}:null;}});
  return <section className="games-section games-inset games-highlights" ref={root} aria-busy={row.busy}>
    <div className="games-section-heading"><div><h2>{t("games.editorial.favorites")}</h2><p>{t(filter === "aaa" ? "games.favorites.aaaNote" : "games.favorites.note")}</p></div><div className="games-highlight-controls"><Dropdown size="sm" className="games-favorites-filter" ariaLabel={t("games.favorites.filter")} value={filter} options={GAME_FAVORITE_FILTERS.map(value=>({value,label:t(`games.favorites.${value}`)}))} onChange={value=>{if(GAME_FAVORITE_FILTERS.includes(value as GameFavoriteFilter))setFilter(value as GameFavoriteFilter);}}/><GameFavoriteReviewFilters value={reviews} onChange={setReviews} active={active}/>{filtered?<button className="games-text-action" onClick={()=>setReviews(DEFAULT_FAVORITE_REVIEWS)}>{t("games.favorites.clearReviews")}</button>:filter!=="aaa"&&<button className="games-text-action" onClick={()=>browse(favoriteCatalogFilters(filter))}>{t("games.editorial.moreRated")}</button>}</div></div>
    <Row key={selection} className="games-content-rail" min={144} shape="portrait" scrollKey={`games:favorites:${selection}`} onEndReached={()=>{if(!row.busy&&!row.failed&&row.nextOffset!==null)void row.more(row.games.length+12);}}>
      {row.games.map(game=><article className="games-highlight-entry games-save-card" key={game.id}><button className="games-highlight-card" data-game={game.id} onClick={()=>open(game)}>
        <span className="games-highlight-art"><GameArt src={game.portrait??game.capsule} fallback={game.capsule}/><GameAvailabilityBadge game={game}/><span className="games-highlight-open"><Play size={22}/></span></span>
        <strong>{game.name}</strong><span>{game.reviews?t("games.discovery.reviewCount",{count:game.reviews.count.toLocaleString(language)}):game.platforms.join(" · ")}</span>
      </button><GamePosterSave game={game}/>{game.reviews&&<HoverTooltip className="games-highlight-rating" label={t("games.discovery.rating.steam")} sublabel={t("games.editorial.scoreNote",{score:game.reviews.positive,count:game.reviews.count.toLocaleString(language)})} mark={<RatingMark source="steam"/>} arrow side="top" align="center"><button className="games-review-seal" data-score-tone={scoreTone(game.reviews.positive)} aria-label={t("games.editorial.scoreNote",{score:game.reviews.positive,count:game.reviews.count.toLocaleString(language)})} onClick={()=>open(game)}><strong>{game.reviews.positive}<small>%</small></strong></button></HoverTooltip>}</article>)}
      {(!row.loaded||row.busy)&&!row.games.length&&!row.failed&&Array.from({length:6},(_,i)=><div key={i} className="games-highlight-placeholder" aria-hidden="true"><div className="games-highlight-skeleton games-skeleton"/><i className="games-skeleton"/><i className="games-skeleton"/></div>)}
      {row.busy&&row.games.length>0&&[0,1,2].map(i=><div key={`pending:${i}`} className="games-highlight-placeholder" aria-hidden="true"><div className="games-highlight-skeleton games-skeleton"/><i className="games-skeleton"/><i className="games-skeleton"/></div>)}
    </Row>
    {row.busy&&<span className="sr-only" role="status">{t("common.loading")}</span>}
    {row.loaded&&!row.busy&&!row.failed&&!row.games.length&&row.nextOffset===null&&<p className="games-inline-status" role="status">{t(filtered?"games.favorites.noReviewMatches":"games.favorites.empty")}</p>}
    {filtered&&row.loaded&&!row.failed&&row.nextOffset!==null&&<div className="games-favorite-review-more">{!row.games.length&&<span role="status">{t("games.favorites.moreToCheck")}</span>}<button className="games-button" disabled={row.busy} onClick={()=>void row.more(row.games.length+12)}>{t(row.busy?"common.loading":"games.favorites.findMore")}</button></div>}
    {row.failed&&<div className="games-inline-status" role="alert"><span>{t("games.editorial.favoritesError")}</span><button className="games-button" onClick={row.retry}>{t("common.retry")}</button></div>}
    <GameDataStatus at={row.cachedAt} busy={row.busy} refresh={row.refresh} />
  </section>;
}
