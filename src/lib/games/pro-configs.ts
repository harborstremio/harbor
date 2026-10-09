import { guideUrl, normalizeGuideGame } from "./guides-data";
import { readGuideSource } from "./guides-fetch";
import { archivedProPlayers } from "./pro-config-archives";
import { crosshairMaps, inlineProduct, optionsText, proShowcases, proSkins, proTeammates, settingBlocks, settingRows, type ProBlock, type ProMate, type ProProduct, type ProShowcase, type ProSkin } from "./pro-config-extras";
import { CROSSHAIR_COLOR_NAMES, CROSSHAIR_OUTLINE_NAMES, CROSSHAIR_STYLE_NAMES, cs2CrosshairCode } from "./pro-crosshair-code";
import { portraitFromProfile } from "./pro-portrait-data";
import { rememberProPortrait } from "./pro-portraits";

export type ProConfigGame = "cs2" | "valorant" | "rainbowsixsiege" | "callofdutywarzone" | "cod" | "css";
export type ProPlayer = { id:string; name:string; image:string; team:string; url:string; source?:string; edition?:string; published?:string; snapshot?:ProConfig };
export type ProSetting = { key:string; label:string; value:string };
export type ProGroup = { id:string; title:string; values:ProSetting[]; blocks?:ProBlock[]; product?:ProProduct; text?:string };
export type ProConfig = { groups:ProGroup[]; crosshair:string; commands:string; checkedAt:number; updated?:string; portrait?:string; maps?:string[]; skins?:ProSkin[]; showcases?:ProShowcase[]; teammates?:ProMate[] };
export function proConfigGame(name:string,steamId?:number):ProConfigGame|undefined {
  if(steamId===730)return "cs2";
  if(steamId===359550)return "rainbowsixsiege";
  if(steamId===240)return "css";
  const key=normalizeGuideGame(name);
  if(key==="counter strike 2")return "cs2";
  if(key==="valorant")return "valorant";
  if(key==="counter strike source")return "css";
  if(key==="call of duty warzone"||key==="call of duty warzone 2 0")return "callofdutywarzone";
  if(key==="call of duty"||archivedProPlayers("cod",name).length)return "cod";
  if(["tom clancy s rainbow six siege","tom clancy s rainbow six siege x","rainbow six siege","rainbow six siege x"].includes(key))return "rainbowsixsiege";
}
export const proGamePath=(game:ProConfigGame)=>game==="rainbowsixsiege"?"rainbow-six-siege":game==="callofdutywarzone"||game==="cod"?"call-of-duty-warzone":game;
const sourceUrl=(raw:string)=>{const url=guideUrl(raw);return url && new URL(url).hostname==="prosettings.net"?url:"";};
const text=(el:Element|null)=>(el?.textContent??"").replace(/\s+/g," ").trim();
export function parseProPlayers(html:string):ProPlayer[] {
  const root=new DOMParser().parseFromString(html,"text/html"),seen=new Set<string>();
  const list=root.querySelector("#players");if(!list)throw Error("Player directory unavailable");
  return [...list.querySelectorAll(".player")].flatMap(node=>{
    const link=node.querySelector<HTMLAnchorElement>("h4 a"),url=sourceUrl(link?.getAttribute("href")??""),id=url?new URL(url).pathname.match(/^\/players\/([\w-]+)\/$/)?.[1]:undefined;
    if(!id || seen.has(id))return [];seen.add(id);
    return [{id,url,name:text(link),team:text(node.querySelector(".player_team a")),image:sourceUrl(node.querySelector(".player_avatar img")?.getAttribute("src")??"")}];
  });
}
export function parseProDirectory(html:string):ProPlayer[] {
  const root=new DOMParser().parseFromString(html,"text/html"),seen=new Set<string>();
  const items=[...root.querySelectorAll("tbody tr")].flatMap(row=>{
    const link=row.querySelector<HTMLAnchorElement>('a[href^="https://prosettings.net/players/"]'),url=sourceUrl(link?.getAttribute("href")??""),id=url?new URL(url).pathname.match(/^\/players\/([\w-]+)\/$/)?.[1]:undefined;
    if(!id||seen.has(id))return [];seen.add(id);
    return [{id,url,name:text(link),team:text(row.querySelector('a[href*="/teams/"]')),image:""}];
  });
  if(!items.length)throw Error("Player directory unavailable");return items;
}
export function parseProPlayerPage(html:string,game:ProConfigGame){
  const root=new DOMParser().parseFromString(html,"text/html");
  const next=[...root.querySelectorAll<HTMLAnchorElement>('a[href]')].map(a=>a.getAttribute("href")??"").find(href=>new RegExp(`^https://prosettings\\.net/games/${proGamePath(game)}/page/\\d+/$`).test(href)&&root.querySelector(`a.next[href="${href}"]`));
  return {items:parseProPlayers(html),next:next?Number(next.match(/page\/(\d+)/)?.[1]):undefined};
}
// Only ordinary settings commands, with bounded numeric values, ever enter a
// copyable console block. Provider text cannot inject binds/exec/network commands.
const csCommands:Record<string,{command:string;min:number;max:number;integer?:boolean}>={
  sensitivity:{command:"sensitivity",min:0.01,max:20},
  zoom_sensitivity_ratio_mouse:{command:"zoom_sensitivity_ratio",min:0.01,max:10},
  cl_crosshairsize:{command:"cl_crosshairsize",min:0,max:100},
  cl_crosshair_length:{command:"cl_crosshair_length",min:0,max:255,integer:true},
  cl_crosshair_thickness:{command:"cl_crosshair_thickness",min:0,max:31,integer:true},
  cl_crosshair_gap:{command:"cl_crosshair_gap",min:0,max:128,integer:true},
  cl_crosshaircolor_a:{command:"cl_crosshaircolor_a",min:0,max:255,integer:true},
  cl_crosshair_dynamic_splitdist:{command:"cl_crosshair_dynamic_splitdist",min:0,max:127,integer:true},
  cl_crosshair_dynamic_splitalpha_innermod:{command:"cl_crosshair_dynamic_splitalpha_innermod",min:0,max:1},
  cl_crosshair_dynamic_splitalpha_outermod:{command:"cl_crosshair_dynamic_splitalpha_outermod",min:.3,max:1},
  cl_crosshair_dynamic_maxdist_splitratio:{command:"cl_crosshair_dynamic_maxdist_splitratio",min:0,max:1},
  cl_crosshair_dynamic_spread_limit:{command:"cl_crosshair_dynamic_spread_limit",min:0,max:255,integer:true},
  cl_crosshair_screen_height:{command:"cl_crosshair_screen_height",min:240,max:16384,integer:true},
  cl_crosshair_sniper_width:{command:"cl_crosshair_sniper_width",min:0,max:31,integer:true},
  cl_crosshairgap:{command:"cl_crosshairgap",min:-100,max:100},
  cl_crosshairthickness:{command:"cl_crosshairthickness",min:0,max:100},
  cl_crosshairalpha:{command:"cl_crosshairalpha",min:0,max:255},
  cl_crosshaircolor_r:{command:"cl_crosshaircolor_r",min:0,max:255},
  cl_crosshaircolor_g:{command:"cl_crosshaircolor_g",min:0,max:255},
  cl_crosshaircolor_b:{command:"cl_crosshaircolor_b",min:0,max:255},
  cl_crosshair_outlinethickness:{command:"cl_crosshair_outlinethickness",min:0,max:3},
  cl_crosshairdot:{command:"cl_crosshairdot",min:0,max:1},
  cl_crosshair_drawoutline:{command:"cl_crosshair_drawoutline",min:0,max:2,integer:true},
  cl_crosshairusealpha:{command:"cl_crosshairusealpha",min:0,max:1},
  cl_crosshair_t:{command:"cl_crosshair_t",min:0,max:1},
  cl_crosshair_recoil:{command:"cl_crosshair_recoil",min:0,max:1},
  cl_crosshairgap_useweaponvalue:{command:"cl_crosshairgap_useweaponvalue",min:0,max:1},
  cl_crosshaircolor:{command:"cl_crosshaircolor",min:0,max:5},
  cl_crosshairstyle:{command:"cl_crosshairstyle",min:0,max:8,integer:true},
};
export function csConfigCommands(values:ProSetting[]):string {
  const names:Record<string,Record<string,string>>={cl_crosshaircolor:CROSSHAIR_COLOR_NAMES,cl_crosshair_drawoutline:CROSSHAIR_OUTLINE_NAMES,cl_crosshairstyle:CROSSHAIR_STYLE_NAMES};
  return values.flatMap(row=>{const spec=csCommands[row.key];let value=row.value.trim();value=names[row.key]?.[value.toLowerCase()]??(/^(yes|on|true)$/i.test(value)?"1":/^(no|off|false)$/i.test(value)?"0":value);if(!spec || !/^-?\d+(?:\.\d+)?$/.test(value))return [];const n=Number(value);return n>=spec.min&&n<=spec.max&&(!spec.integer||Number.isInteger(n))?[`${spec.command} ${value}`]:[];}).join("\n");
}
export function parseProConfig(html:string,game:ProConfigGame,playerId?:string):ProConfig {
  const root=new DOMParser().parseFromString(html,"text/html");
  const owned=[...root.querySelectorAll<HTMLElement>(`section.settings-group[id^="${game}_"], section.settings-textarea[id^="${game}_"]`)];
  const shared=["monitor","graphics_card"].flatMap(id=>{const node=root.getElementById(id);return node?[node]:[];});
  const groups:ProGroup[]=[...owned,...shared].map(section=>{
    const blocks=settingBlocks(section),product=inlineProduct(section);
    return {id:section.id.startsWith(`${game}_`)?section.id.slice(game.length+1):section.id,title:text(section.querySelector("h3")),
      values:settingRows(section),...(blocks.length?{blocks}:{}),...(product?{product}:{}),
      ...(section.classList.contains("settings-textarea")?{text:optionsText(section)}:{})};
  }).filter(group=>group.values.length||group.text);
  if(!groups.length)throw Error("No published settings for this game");
  const crosshairSection=root.getElementById(`${game}_crosshair`);
  const crosshairValues=groups.find(group=>group.id==="crosshair")?.values??[];
  const values=groups.flatMap(group=>group.values),code=crosshairValues.find(row=>row.key==="code")?.value??"";
  const generated=game==="cs2"?cs2CrosshairCode(crosshairValues):"";
  const crosshair=game==="valorant"&&/^[\d\w.;-]{10,1000}$/.test(code)?code:game==="cs2"&&/^(?:CSGO-[\w-]{20,80}|CS[\w]{20,120})$/.test(generated)?generated:"";
  const portrait=playerId?portraitFromProfile(root,playerId):"";
  if(playerId&&portrait)rememberProPortrait(playerId,portrait);
  return {groups,crosshair,commands:game==="cs2"?csConfigCommands(values):"",checkedAt:Date.now(),
    updated:root.querySelector('.last_updated time[datetime]')?.getAttribute('datetime')||undefined,portrait,
    maps:crosshairSection?crosshairMaps(crosshairSection):[],skins:proSkins(root,game),showcases:proShowcases(root),teammates:proTeammates(root)};
}
export const proMatePlayer=(mate:ProMate):ProPlayer=>({id:mate.id,name:mate.name,image:mate.image,team:mate.team,url:mate.url});
export async function loadProPlayers(game:ProConfigGame,signal:AbortSignal,gameName="") {
  if(game==="css"||game==="cod"){signal.throwIfAborted();return {items:archivedProPlayers(game,gameName),next:undefined as number|undefined};}
  const path=proGamePath(game),pages=await Promise.allSettled([
    readGuideSource(`https://prosettings.net/games/${path}/`,signal,html=>parseProPlayerPage(html,game)),
    ...(["cs2","valorant","rainbowsixsiege"].includes(game)?[readGuideSource(`https://prosettings.net/lists/${path}/`,signal,html=>({items:parseProDirectory(html),next:undefined}))]:[]),
  ]);
  signal.throwIfAborted();const unique=new Map<string,ProPlayer>();
  for(const page of pages)if(page.status==="fulfilled")for(const player of page.value.items)if(!unique.has(player.id))unique.set(player.id,player);
  if(!unique.size)throw Error("Player directory unavailable");
  if(game==="cs2")for(const [id,name] of [["kennys","kennyS"],["f0rest","f0rest"],["guardian","GuardiaN"],["shox","shox"],["scream","ScreaM"],["shroud","shroud"]])if(!unique.has(id))unique.set(id,{id,name,url:`https://prosettings.net/players/${id}/`,image:"",team:""});
  return {items:[...unique.values(),...archivedProPlayers(game,gameName)],next:pages[0]?.status==="fulfilled"?pages[0].value.next:undefined};
}
export function loadMoreProPlayers(game:ProConfigGame,page:number,signal:AbortSignal){
  if(!Number.isInteger(page)||page<1||page>150)throw Error("Invalid directory page");
  return readGuideSource(`https://prosettings.net/games/${proGamePath(game)}/${page>1?`page/${page}/`:""}`,signal,html=>parseProPlayerPage(html,game));
}
export async function loadProConfig(player:ProPlayer,game:ProConfigGame,signal:AbortSignal) {
  if(player.snapshot)return player.snapshot;
  if(!/^[\w-]{1,80}$/.test(player.id))throw Error("Invalid player");
  return readGuideSource(`https://prosettings.net/players/${player.id}/`,signal,html=>parseProConfig(html,game==="cod"?"callofdutywarzone":game,player.id));
}
