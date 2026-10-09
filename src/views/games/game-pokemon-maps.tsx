import { useEffect, useState } from "react";
import { ArrowRight, Search, MapPin, List, LayoutGrid, ZoomIn } from "lucide-react";
import { NavChevron } from "@/components/nav-arrow";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { useT } from "@/lib/i18n";
import { loadPokemonMaps, type PokemonMap } from "@/lib/games/pokemon";
import { groupPokemonMaps, POKEMON_MAP_KINDS, type PokemonMapKind } from "@/lib/games/pokemon-map-index";
import type { PokemonEdition } from "@/lib/games/pokemon-games";
import { PokemonMapImage } from "./game-pokemon-map-image";
import { usePokemonFeed } from "./use-pokemon-feed";
import { PokemonStatus } from "./game-pokemon-shared";
import { PokemonMapViewer } from "./game-pokemon-map-viewer";
import "./game-pokemon-maps.css";
export function PokemonMaps(props: {edition: PokemonEdition; active: boolean}) {
  return <MapBrowser key={props.edition.key} {...props}/>;
}
function MapBrowser({edition, active}: {edition: PokemonEdition; active: boolean}) {
  const t=useT(), [cursor,setCursor]=useState<string>(), [maps,setMaps]=useState<PokemonMap[]>([]), [selected,setSelected]=useState<PokemonMap|null>(null);
  const [query,setQuery]=useState(""), [kind,setKind]=useState<PokemonMapKind|"all">("all"), [view,setView]=useState<"list"|"grid">("list");
  const feed=usePokemonFeed(`${edition.key}:${cursor??""}`,active&&!!edition.maps,signal=>loadPokemonMaps(edition.maps!,signal,cursor,500));
  useEffect(()=>{if(feed.data)setMaps(previous=>[...new Map([...previous,...feed.data!.maps].map(map=>[map.url,map])).values()]);},[feed.data]);
  const groups=groupPokemonMaps(maps,query,kind), visible=groups.flatMap(group=>group.maps);
  return <><div className="pokemon-section-heading"><div><h3>{t("games.pokemon.maps")}</h3><p>{t("games.pokemon.mapScope")}</p></div></div>
    <div className="pokemon-map-toolbar"><label className="pokemon-search" data-nav-focus-container><Search size={20}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={t("games.pokemon.searchMaps")} aria-label={t("games.pokemon.searchMaps")}/></label>
      <Dropdown ariaLabel={t("games.pokemon.mapKind")} value={kind} onChange={value=>setKind(value as typeof kind)} options={["all",...POKEMON_MAP_KINDS].map(value=>({value,label:t(`games.pokemon.mapKind.${value}`)}))}/>
      <div className="pokemon-map-view-toggle">{(["list","grid"] as const).map(mode=><HoverTooltip key={mode} label={t(`games.pokemon.mapView.${mode}`)}><button aria-label={t(`games.pokemon.mapView.${mode}`)} aria-pressed={view===mode} onClick={()=>setView(mode)}>{mode==="list"?<List size={21}/>:<LayoutGrid size={21}/>}</button></HoverTooltip>)}</div>
    </div>
    {!!maps.length&&<p className="pokemon-map-count" role="status">{t("games.pokemon.mapCount",{count:visible.length})}</p>}
    {view==="grid"?<div className="pokemon-map-grid">{visible.map(map=><button key={map.url} onClick={()=>setSelected(map)}><PokemonMapImage src={map.image}/><span><strong>{map.title}</strong><ZoomIn size={20}/></span></button>)}</div>:<div className="pokemon-map-index">{groups.map(group=><MapGroup key={group.name} name={group.name} maps={group.maps} searching={!!query.trim()} choose={setSelected}/>)}</div>}
    <PokemonStatus feed={feed} layout={view==="list"?"locations":"maps"}/>
    {!feed.busy&&!feed.failed&&!visible.length&&<p className="pokemon-note">{t(maps.length?"games.pokemon.mapNoMatch":"games.pokemon.noMaps")}</p>}
    {feed.data?.cursor&&<button className="pokemon-more" disabled={feed.busy} onClick={()=>setCursor(feed.data?.cursor)}>{t("games.pokemon.moreMaps")}<ArrowRight size={20}/></button>}
    {active&&selected&&<PokemonMapViewer map={selected} close={()=>setSelected(null)}/>}</>;
}
function MapGroup({name,maps,searching,choose}:{name:string;maps:PokemonMap[];searching:boolean;choose:(map:PokemonMap)=>void}) {
  const t=useT(), [expanded,setExpanded]=useState(false);
  return <details className="pokemon-map-group" open={expanded||searching} onToggle={event=>{if(!searching)setExpanded(event.currentTarget.open);}}><summary><MapPin size={20}/><strong>{name}</strong><span>{t("games.pokemon.mapCount",{count:maps.length})}</span><NavChevron dir="down" size={16}/></summary>
    {(expanded||searching)&&<div>{maps.map(map=><button key={map.url} className="pokemon-map-file" onClick={()=>choose(map)}><PokemonMapImage src={map.image}/><strong>{map.title}</strong><ZoomIn size={20}/></button>)}</div>}
  </details>;
}
