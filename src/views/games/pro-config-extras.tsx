import { useState } from "react";
import { ChevronDown, Cpu, Gem, Headphones, Users, Video } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { ProMate, ProProduct, ProShowcase, ProSkin } from "@/lib/games/pro-config-extras";
import { proMatePlayer } from "@/lib/games/pro-configs";
import type { ProPlayer } from "@/lib/games/pro-configs";
import { PlayerPortrait } from "./pro-player-portrait";
import { SettingGrid } from "./pro-config-groups";

const SHOWCASE={gear:{icon:Headphones,label:"games.guides.gear"},setup:{icon:Video,label:"games.guides.setup"},pcspecs:{icon:Cpu,label:"games.guides.pcSpecs"}} as const;

function ProductCard({item}:{item:ProProduct}) {
  const t=useT(),[open,setOpen]=useState(false);
  return <li className="games-pro-product">
    <div className="games-pro-product-art">{item.image&&<img src={item.image} alt="" loading="lazy" decoding="async"/>}{item.tag&&<span>{item.tag}</span>}</div>
    <strong>{item.name}</strong>
    {!!item.specs.length&&<>
      <button className="games-pro-product-more" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>{t("games.guides.specs")}<ChevronDown size={15}/></button>
      {open&&<SettingGrid values={item.specs}/>}
    </>}
  </li>;
}

export function ProShowcases({showcases}:{showcases:ProShowcase[]}) {
  const t=useT();
  return <>{showcases.map(showcase=>{
    const Icon=SHOWCASE[showcase.id].icon;
    return <section className="games-pro-showcase" key={showcase.id}>
      <h3><Icon size={20}/>{t(SHOWCASE[showcase.id].label)}</h3>
      <ul className="games-pro-product-grid">{showcase.items.map(item=><ProductCard key={item.name} item={item}/>)}</ul>
    </section>;
  })}</>;
}

export function ProSkinList({skins}:{skins:ProSkin[]}) {
  const t=useT();
  return <section className="games-pro-showcase">
    <h3><Gem size={20}/>{t("games.guides.skins")}</h3>
    <ul className="games-pro-product-grid is-skins">{skins.map(skin=><li className="games-pro-product" key={skin.name}>
      <div className="games-pro-product-art">{skin.image&&<img src={skin.image} alt="" loading="lazy" decoding="async"/>}{skin.tag&&<span>{skin.tag}</span>}</div>
      <strong>{skin.name}</strong>
    </li>)}</ul>
  </section>;
}

export function ProTeammates({mates,active,onSelect}:{mates:ProMate[];active:boolean;onSelect:(player:ProPlayer)=>void}) {
  const t=useT();
  return <section className="games-pro-showcase">
    <h3><Users size={20}/>{t("games.guides.teammates")}</h3>
    <div className="games-pro-mates">{mates.map(mate=><button className="games-pro-mate" key={mate.id} onClick={()=>onSelect(proMatePlayer(mate))}>
      <PlayerPortrait player={proMatePlayer(mate)} active={active}/>
      <span><strong>{mate.name}</strong>{mate.team&&<small>{mate.team}</small>}</span>
    </button>)}</div>
  </section>;
}
