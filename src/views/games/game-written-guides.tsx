import { useState, type ReactNode } from "react";
import { BookOpen, Check, ChevronDown, Star, Wrench, X } from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { useT, useUiLanguage } from "@/lib/i18n";
import { STEAM_GUIDE_CATEGORIES, STEAM_GUIDE_LANGUAGES, STEAM_GUIDE_PERIODS, steamGuidesUrl, type SteamGuideFilters } from "@/lib/games/steam-guide-options";
import type { GameGuide } from "@/lib/games/guides-data";
import type { useGuideResults } from "./use-guide-results";
import type { GuideGame } from "./game-guides";
import { GameArt } from "./game-art";
import { GuideSourceLink } from "./guide-shared";
import { SteamMark } from "./game-detail-marks";
import { pokemonEdition, pokemonGuideTitle } from "@/lib/games/pokemon-games";
import { POKEMON_WIKI } from "@/lib/games/pokemon-source";
import { GuideRetry } from "./guide-retry";
import "./game-written-guides.css";

type Props={game:GuideGame;filters:SteamGuideFilters;query:string;setFilters:(next:SteamGuideFilters)=>void;reset:()=>void;result:ReturnType<typeof useGuideResults>;read:(item:GameGuide,origin?:HTMLElement)=>void;pcwiki:GameGuide;children:ReactNode};
export function GameWrittenGuides({game,filters,query,setFilters,reset,result,read,pcwiki,children}:Props) {
  const t=useT(),locale=useUiLanguage(),[expanded,setExpanded]=useState(false);
  const languageNames=new Intl.DisplayNames([locale],{type:"language"});
  const categories=STEAM_GUIDE_CATEGORIES.filter(([value])=>!result.categories?.length||result.categories.includes(value));
  const preferred=["Walkthroughs","Gameplay Basics","Achievements","Characters","Weapons","Maps or Levels"];
  const ordered=[...categories].sort((a,b)=>(preferred.indexOf(a[0])<0?99:preferred.indexOf(a[0]))-(preferred.indexOf(b[0])<0?99:preferred.indexOf(b[0])));
  const shown=expanded?ordered:ordered.filter(([value],index)=>index<6||filters.categories.includes(value));
  const set=(patch:Partial<SteamGuideFilters>)=>setFilters({...filters,...patch});
  const toggle=(value:string)=>set({categories:filters.categories.includes(value)?filters.categories.filter(tag=>tag!==value):[...filters.categories,value]});
  const pokemon=!game.steamId?pokemonEdition(game.name):null;
  const pokemonUrl=pokemon&&!pokemon.hack?`${POKEMON_WIKI}/wiki/${encodeURIComponent(pokemonGuideTitle(pokemon).replaceAll(" ","_"))}`:undefined;
  const filtered=!!query||!!filters.language||!!filters.categories.length;
  return <div className="games-written-layout">
    <aside className="games-written-filters" aria-label={t("games.guides.filters")}>
      {game.steamId&&<>
        <header><h2>{t("games.guides.filters")}</h2>{filtered&&<button onClick={reset}>{t("games.guides.clearFilters")}</button>}</header>
        <div className="games-written-selects">
          <div><span>{t("games.guides.order")}</span><Dropdown ariaLabel={t("games.guides.sort")} value={filters.sort} onChange={value=>set({sort:value as SteamGuideFilters["sort"]})} options={[{value:"popular",label:t("games.guides.popular")},{value:"rated",label:t("games.guides.ratedAllTime")},{value:"recent",label:t("games.guides.recent")}]} /></div>
          {filters.sort==="popular"&&<div><span>{t("games.guides.period")}</span><Dropdown ariaLabel={t("games.guides.period")} value={String(filters.days)} onChange={value=>set({days:Number(value)})} options={STEAM_GUIDE_PERIODS.map(days=>({value:String(days),label:t(`games.guides.period.${days}`)}))}/></div>}
          <div><span>{t("games.guides.guideLanguage")}</span><Dropdown ariaLabel={t("games.guides.guideLanguage")} value={filters.language} onChange={value=>set({language:value})} options={[{value:"",label:t("games.guides.allLanguages")},...STEAM_GUIDE_LANGUAGES.map(([value,code])=>({value,label:languageNames.of(code)??value}))]}/></div>
        </div>
        <fieldset className="games-written-categories"><legend>{t("games.guides.categories")}</legend>
          {shown.map(([value,key])=><label key={value}><input type="checkbox" checked={filters.categories.includes(value)} onChange={()=>toggle(value)}/><span className="games-written-check" aria-hidden="true">{filters.categories.includes(value)&&<Check size={13}/>}</span><span>{t(`games.guides.category.${key}`)}</span></label>)}
          {categories.length>6&&<button className="games-written-category-toggle" aria-expanded={expanded} onClick={()=>setExpanded(value=>!value)}>{t(expanded?"games.guides.fewerCategories":"games.guides.moreCategories",{count:categories.length})}<ChevronDown size={15}/></button>}
          {filters.categories.length>1&&<p>{t("games.guides.matchAll")}</p>}
        </fieldset>
      </>}
      <div className="games-written-resources"><h2>{t("games.guides.resources")}</h2>{pokemonUrl?<GuideSourceLink href={pokemonUrl}>Bulbapedia</GuideSourceLink>:<button onClick={event=>read(pcwiki,event.currentTarget)}><Wrench size={18}/>{t("games.guides.pcTitle")}</button>}<GuideSourceLink href={`https://strategywiki.org/w/index.php?search=${encodeURIComponent(game.name)}`}>StrategyWiki</GuideSourceLink><GuideSourceLink href={`https://www.ign.com/search?q=${encodeURIComponent(`${game.name} guide`)}`}>IGN</GuideSourceLink></div>
    </aside>
    <section className="games-written-results" aria-label={t("games.guides.written")}>
      <header className="games-written-heading"><div><h2>{game.steamId&&<SteamMark/>}{game.steamId?"Steam Community":pokemonUrl?"Bulbapedia":t("games.guides.written")}</h2>{result.total!==undefined&&<p role="status">{t("games.guides.resultCount",{count:result.total.toLocaleString(locale)})}</p>}</div>{game.steamId&&<GuideSourceLink href={steamGuidesUrl(game.steamId,query,1,filters)}>{t("games.guides.original")}</GuideSourceLink>}</header>
      {!!filters.categories.length&&<div className="games-written-selected">{filters.categories.map(value=><button key={value} onClick={()=>toggle(value)}>{t(`games.guides.category.${STEAM_GUIDE_CATEGORIES.find(([tag])=>tag===value)?.[1]}`)}<X size={14}/></button>)}</div>}
      <div aria-busy={result.busy}>
        {!!result.items.length&&<div className="games-written-list">{result.items.map(item=><WrittenGuideRow key={item.id} item={item} read={read}/>)}</div>}
        {result.busy&&<div className="games-written-list" role="status" aria-label={t("common.loading")}>{Array.from({length:result.items.length?3:6},(_,i)=><div key={i} className="games-written-row games-written-skeleton" aria-hidden="true"><i/><div><i/><i/><i/></div></div>)}</div>}
        {!result.items.length&&!result.busy&&(result.error?<div className="games-written-empty" role="alert"><BookOpen size={28}/><h3>{t("games.guides.sourceErrorTitle")}</h3><p>{t("games.guides.error")}</p><GuideRetry retryAt={result.retryAt} onRetry={result.retry}/></div>:<div className="games-written-empty"><BookOpen size={28}/><h3>{t("games.guides.empty")}</h3>{(game.steamId||pokemonUrl)&&filtered&&<button className="games-button" onClick={reset}>{t("games.guides.clearFilters")}</button>}</div>)}
      </div>
      {children}
    </section>
  </div>;
}
function WrittenGuideRow({item,read}:{item:GameGuide;read:Props["read"]}) {
  const t=useT();return <button className="games-written-row" onClick={event=>read(item,event.currentTarget)}>
    <span className="games-written-art"><BookOpen size={26} aria-hidden="true"/><GameArt src={item.image}/></span>
    <span className="games-written-copy"><span className="games-written-title"><h3>{item.title}</h3>{item.rating!==undefined&&<span className="games-written-rating" role="img" aria-label={t("games.guides.rating",{rating:item.rating})}>{[1,2,3,4,5].map(star=><Star key={star} size={12} fill={star<=item.rating!?"currentColor":"none"} data-filled={star<=item.rating!}/>)}</span>}</span><span className="games-written-author">{item.author}</span>{item.description&&<span className="games-written-description">{item.description}</span>}</span>
  </button>;
}
