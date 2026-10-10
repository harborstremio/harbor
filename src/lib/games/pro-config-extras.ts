import { proPortraitId, proPortraitImage } from "./pro-portrait-data";
import type { ProSetting } from "./pro-configs";

export type ProProduct={name:string;tag:string;image:string;specs:ProSetting[]};
export type ProSkin={name:string;tag:string;image:string};
export type ProMate={id:string;name:string;team:string;image:string;url:string};
export type ProBlock={title:string;values:ProSetting[]};
export type ProShowcase={id:"gear"|"setup"|"pcspecs";items:ProProduct[]};

const text=(el:Element|null|undefined,limit=160)=>(el?.textContent??"").replace(/\s+/g," ").trim().slice(0,limit);
const image=(el:Element|null|undefined)=>proPortraitImage(el?.getAttribute("src"));
const setting=(row:Element):ProSetting=>({key:row.getAttribute("data-field")??"",label:text(row.querySelector("th")),value:text(row.querySelector("td"),1500)});
const settings=(nodes:Element[]):ProSetting[]=>nodes.map(setting).filter(row=>row.label&&row.value);
const fields=(scope:Element,limit=240)=>[...scope.querySelectorAll("tr[data-field]")].slice(0,limit);

export function settingRows(section:Element):ProSetting[]{return settings(fields(section));}

export function settingBlocks(section:Element):ProBlock[]{
  const children=[...section.querySelectorAll(".section--child")].slice(0,10);
  const blocks=children.map(child=>({title:text(child.querySelector("h4")),values:settings(fields(child))})).filter(block=>block.values.length);
  if(blocks.length<2)return [];
  const inside=new Set(children.flatMap(child=>[...child.querySelectorAll("tr[data-field]")]));
  const loose=settings(fields(section).filter(row=>!inside.has(row)));
  return loose.length?[{title:"",values:loose},...blocks]:blocks;
}

export function inlineProduct(section:Element):ProProduct|undefined{
  const promo=section.querySelector(":scope > .promo > .promo_heading-wrapper");if(!promo)return undefined;
  const name=text(promo.querySelector("h4"));
  return name?{name,tag:"",image:image(promo.querySelector("img")),specs:[]}:undefined;
}

export function productCards(section:Element|null):ProProduct[]{
  if(!section)return [];
  const seen=new Set<string>();
  return [...section.querySelectorAll(".cta-box")].slice(0,60).flatMap(card=>{
    const name=text(card.querySelector("h4"));if(!name||seen.has(name))return [];
    seen.add(name);
    const specs=[...card.querySelectorAll("dialog tr")].slice(0,40)
      .map(row=>({key:"",label:text(row.querySelector("th")),value:text(row.querySelector("td"))})).filter(row=>row.label&&row.value);
    return [{name,tag:text(card.querySelector(".cta-box__tag"),40),image:image(card.querySelector(".cta-box_heading-wrapper img")),specs}];
  });
}

export function proShowcases(root:Document):ProShowcase[]{
  return ([["gear","gear"],["setup","setupstreaming"],["pcspecs","pcspecs"]] as const)
    .map(([id,element])=>({id,items:productCards(root.getElementById(element))}))
    .filter(showcase=>showcase.items.length);
}

export function proSkins(root:Document,game:string):ProSkin[]{
  const section=root.getElementById(`${game}_cosmetics`);if(!section)return [];
  const seen=new Set<string>();
  return [...section.querySelectorAll(".cta-box-skin")].slice(0,40).flatMap(card=>{
    const name=text(card.querySelector("h4"));if(!name||seen.has(name))return [];
    seen.add(name);
    return [{name,tag:text(card.querySelector(".cta-box__tag"),40),image:image(card.querySelector(".cta-box_heading-wrapper img"))}];
  });
}

export function proTeammates(root:Document):ProMate[]{
  const section=root.getElementById("teammates");if(!section)return [];
  const seen=new Set<string>();
  return [...section.querySelectorAll(".cta-box")].slice(0,12).flatMap(card=>{
    const link=card.querySelector("h4 a"),url=link?.getAttribute("href")??"",id=proPortraitId(url),name=text(link,80);
    if(!id||!name||seen.has(id))return [];seen.add(id);
    return [{id,name,url,team:text(card.querySelector(".team_team a"),80),image:image(card.querySelector(".cta-box_heading-wrapper img"))}];
  });
}

export function crosshairMaps(section:Element):string[]{
  const slider=section.querySelector(".crosshair-slider");if(!slider)return [];
  return [...new Set([...slider.querySelectorAll("img")].slice(0,16).map(node=>image(node)).filter(Boolean))].slice(0,12);
}

export const isLaunchOptions=(value:string)=>/(?:^|\s)[-+]\w/.test(value);
export function optionsText(section:Element):string{return text(section.querySelector("pre"),600);}
