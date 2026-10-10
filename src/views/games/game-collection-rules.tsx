import {LibrarySourceMark} from "./game-library-marks";
import type {GameLauncher} from "@/lib/games/launchers";
import {Dropdown} from "@/components/dropdown";
import {useT} from "@/lib/i18n";
import {LAUNCHER_NAMES} from "@/lib/games/launchers";
import type {CollectionRules} from "@/lib/games/collection-rules";
import {LibraryVisibilityFilter} from "./game-library-personal";
import {LibraryStatusFilter} from "./game-library-status";
import {LibraryPlaytimeFilter} from "./game-library-playtime";

export function CollectionRuleSummary({rules}:{rules:CollectionRules}) {
  const t=useT();
  const source=rules.source==="all"?t("games.unified.allSources"):rules.source==="steam"?"Steam":rules.source in LAUNCHER_NAMES?LAUNCHER_NAMES[rules.source as keyof typeof LAUNCHER_NAMES]:t(rules.source==="retro"?"games.emulation.library":"games.custom.nav");
  return <p className="games-collection-rule-summary"><span>{source}</span><span>{t(rules.availability==="all"?"games.unified.anyState":rules.availability==="ready"?"games.unified.ready":rules.availability==="attention"?"games.unified.attention":"games.unified.state.notInstalled")}</span><span>{t(rules.visibility==="pinned"?"games.libraryPersonal.pinned":rules.visibility==="hidden"?"games.libraryPersonal.hidden":"games.libraryPersonal.visible")}</span>{rules.playtime&&rules.playtime!=="all"&&<span>{t(`games.unified.playtime.${rules.playtime}`)}</span>}{rules.playStatus&&rules.playStatus!=="all"&&<span>{t(`games.libraryStatus.${rules.playStatus}`)}</span>}{rules.query&&<q dir="auto">{rules.query}</q>}</p>;
}

export function GameCollectionRules({rules,onChange}:{rules:CollectionRules;onChange:(value:CollectionRules)=>void}) {
  const t=useT();
  return <fieldset className="games-collection-rules">
    <legend>{t("games.collections.filters")}</legend>
    <label>{t("games.collections.ruleQuery")}<input maxLength={200} value={rules.query} onChange={e=>onChange({...rules,query:e.target.value})}/></label>
    <div><Dropdown value={rules.source} onChange={source=>onChange({...rules,source:source as CollectionRules["source"]})} ariaLabel={t("games.dock.source")} size="sm" options={[
      {value:"all",label:t("games.unified.allSources")},{value:"steam",label:"Steam",left:<LibrarySourceMark source="steam" size={18}/>},
      ...Object.entries(LAUNCHER_NAMES).map(([value,label])=>({value,label,left:<LibrarySourceMark source={value as GameLauncher} size={18}/>})),
      {value:"custom",label:t("games.custom.nav")},{value:"retro",label:t("games.emulation.library")},
    ]}/>
    <Dropdown value={rules.availability} onChange={availability=>onChange({...rules,availability:availability as CollectionRules["availability"]})} ariaLabel={t("games.unified.availability")} size="sm" options={[
      {value:"all",label:t("games.unified.anyState")},{value:"ready",label:t("games.unified.ready")},
      {value:"notInstalled",label:t("games.unified.state.notInstalled")},{value:"attention",label:t("games.unified.attention")},
    ]}/><LibraryStatusFilter value={rules.playStatus} onChange={playStatus=>onChange({...rules,playStatus})}/><LibraryPlaytimeFilter value={rules.playtime} onChange={playtime=>onChange({...rules,playtime})}/><LibraryVisibilityFilter value={rules.visibility} setValue={visibility=>onChange({...rules,visibility})}/></div>
    {rules.playtime&&rules.playtime!=="all"&&<p className="games-collection-rule-note">{t("games.unified.playtime.note")}</p>}
  </fieldset>;
}
