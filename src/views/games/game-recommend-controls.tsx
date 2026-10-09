import { useState } from "react";
import { Bookmark, Check, RotateCcw, X } from "lucide-react";
import { NavChevron } from "@/components/nav-arrow";
import { useT } from "@/lib/i18n";
import { hiddenRecommendationChoices, type RecommendationChoice, type RecommendationPreferences, type RecommendationSeed } from "@/lib/games/recommendations";
import type { GameSummary } from "@/lib/games/types";
import { GameArt } from "./game-art";
import { GameMark } from "./game-ui";

function ChoiceHistory({label,choices,restore,kind}: {label:string;choices:RecommendationChoice[];restore:(choice:RecommendationChoice)=>void;kind:"hidden"|"excluded"}) {
  const t=useT(),[page,setPage]=useState(0);
  const pages=Math.ceil(choices.length/6),current=Math.min(page,Math.max(0,pages-1));
  if(!choices.length)return null;
  return <details className="games-recommend-history"><summary>{label}<NavChevron dir="down" size={14}/></summary>
    <div className="games-recommend-choice-list">{choices.slice(current*6,current*6+6).map(choice=><div className="games-recommend-choice" key={choice.id}>
      {choice.image&&<GameArt src={choice.image}/>}
      <strong>{choice.name}</strong>
      <button className="games-icon-button" onClick={event=>{
        const history=event.currentTarget.closest("details");
        const fallback=history?.closest(".games-recommend-settings")?.querySelector<HTMLButtonElement>(".games-recommend-signals button");
        const index=choices.indexOf(choice)-current*6;
        restore(choice);
        requestAnimationFrame(()=>{
          const actions=history?.querySelectorAll<HTMLButtonElement>(".games-recommend-choice button");
          const target=actions?.[Math.min(index,(actions?.length??0)-1)]??history?.querySelector<HTMLElement>("summary");
          (target?.isConnected?target:fallback)?.focus({preventScroll:true});
        });
      }} aria-label={t(kind==="hidden"?"games.recommend.restore":"games.recommend.useAgain",{name:choice.name})} title={t(kind==="hidden"?"games.recommend.restore":"games.recommend.useAgain",{name:choice.name})}><RotateCcw size={16}/></button>
    </div>)}</div>
    {pages>1&&<div className="games-page-controls"><span>{current+1} / {pages}</span><button className="games-icon-button" aria-label={t("common.previous")} disabled={!current} onClick={()=>setPage(current-1)}><NavChevron dir="left" size={16}/></button><button className="games-icon-button" aria-label={t("common.next")} disabled={current===pages-1} onClick={()=>setPage(current+1)}><NavChevron dir="right" size={16}/></button></div>}
  </details>;
}

export function RecommendationControls({preferences,seeds,update,exclude,restoreHidden,restoreSeed,close,libraryNote}: {
  preferences:RecommendationPreferences;seeds:RecommendationSeed[];
  update:(next:RecommendationPreferences)=>boolean;exclude:(game:GameSummary)=>void;
  restoreHidden:(choice:RecommendationChoice)=>void;restoreSeed:(choice:RecommendationChoice)=>void;close:()=>void;
  libraryNote:string;
}) {
  const t=useT(),hidden=hiddenRecommendationChoices(preferences);
  return <div className="games-recommend-settings">
    <div className="games-recommend-settings-heading"><div><h3>{t("games.recommend.influences")}</h3><p>{t("games.recommend.influencesNote")}</p></div><button className="games-icon-button" onClick={close} aria-label={t("games.recommend.close")}><X size={18}/></button></div>
    <div className="games-recommend-signals"><span>{t("games.recommend.use")}</span><button aria-pressed={preferences.saved} onClick={()=>update({...preferences,saved:!preferences.saved})}>{preferences.saved&&<Check size={13}/>}<Bookmark size={13}/>{t("games.recommend.saved")}</button><button aria-pressed={preferences.recent} onClick={()=>update({...preferences,recent:!preferences.recent})}>{preferences.recent&&<Check size={13}/>}<GameMark kind="runs" size={14}/>{t("games.recommend.recent")}</button></div>
    <div className="games-recommend-filters" role="group" aria-label={t("games.recommend.filterTitle")}>
      <span>{t("games.recommend.filterTitle")}</span>
      <button role="checkbox" aria-checked={preferences.hideLibrary} onClick={()=>update({...preferences,hideLibrary:!preferences.hideLibrary})}><i aria-hidden="true">{preferences.hideLibrary&&<Check size={12}/>}</i>{t("games.recommend.hideLibrary")}</button>
      <button role="checkbox" aria-checked={preferences.hideSaved} onClick={()=>update({...preferences,hideSaved:!preferences.hideSaved})}><i aria-hidden="true">{preferences.hideSaved&&<Check size={12}/>}</i>{t("games.recommend.hideSaved")}</button>
      <p>{t("games.recommend.libraryNote")} <span>{libraryNote}</span></p>
    </div>
    {seeds.length>0&&<div className="games-recommend-seeds">{seeds.map(seed=><div className="games-recommend-seed" key={seed.game.id}>
      <GameArt src={seed.game.portrait??seed.game.capsule} fallback={seed.game.capsule}/>
      <div><strong>{seed.game.name}</strong><span>{t(seed.reason==="saved"?"games.recommend.saved":"games.recommend.recent")}</span></div>
      <button className="games-icon-button" data-recommend-seed={seed.game.id} onClick={()=>exclude(seed.game)} aria-label={t("games.recommend.exclude",{name:seed.game.name})} title={t("games.recommend.exclude",{name:seed.game.name})}><X size={16}/></button>
    </div>)}</div>}
    <ChoiceHistory label={t("games.recommend.excluded",{count:preferences.excludedSeeds.length})} choices={preferences.excludedSeeds} restore={restoreSeed} kind="excluded"/>
    <ChoiceHistory label={t("games.recommend.hiddenGames",{count:hidden.length})} choices={hidden} restore={restoreHidden} kind="hidden"/>
  </div>;
}
