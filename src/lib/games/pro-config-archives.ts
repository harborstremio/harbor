import type { ProConfig, ProConfigGame, ProPlayer } from "./pro-configs";

// Dated factual settings only. Original archives are linked, never executed.
// Provenance and extraction details: docs/games/GUIDES-AND-CONFIGS.md.
const snapshot=(values:Record<string,string>,title:string):ProConfig=>({
  groups:[{id:"published",title,values:Object.entries(values).map(([key,value])=>({key,label:key,value}))}],
  crosshair:"",commands:"",checkedAt:Date.parse("2026-10-01T14:00:00Z"),
});
const cssRecords:{id:string;name:string;published:string;values:Record<string,string>}[]=[
  {id:"archive-rattlesnk",name:"RattlesnK",published:"2010-07-07",values:{sensitivity:"3.2",zoom_sensitivity_ratio:"0.8",m_filter:"0",cl_crosshaircolor:"3",cl_dynamiccrosshair:"0",cl_crosshairscale:"1000",cl_crosshairalpha:"999",cl_crosshairusealpha:"1"}},
  {id:"archive-ex6tenz",name:"Ex6TenZ",published:"2010-08-31",values:{sensitivity:"2.800000",m_filter:"0",cl_crosshaircolor:"0",cl_dynamiccrosshair:"1",cl_crosshairscale:"1200",cl_crosshairalpha:"200",cl_crosshairusealpha:"1"}},
  {id:"archive-nbk",name:"NBK",published:"2010-08-31",values:{sensitivity:"3.2",zoom_sensitivity_ratio:"0.7",m_filter:"0",cl_crosshaircolor:"4",cl_dynamiccrosshair:"0",cl_crosshairscale:"1000",cl_crosshairalpha:"200",cl_crosshairusealpha:"1"}},
];
const css:ProPlayer[]=cssRecords.map(({values,...player})=>({...player,image:"",team:"",source:"Gamingcfg",url:`https://www.gamingcfg.com/config/${player.name}`,edition:"Counter-Strike: Source",snapshot:snapshot(values,"Console settings")}));
const creators:ProPlayer[]=[
  {id:"archive-tgd-mw2",name:"TheGamingDefinition (TGD)",image:"",team:"",source:"YouTube · TheGamingDefinition",url:"https://www.youtube.com/watch?v=k-1ZBlovhqc",edition:"Call of Duty: Modern Warfare II (2022)",published:"2023-03-27",snapshot:snapshot({DPI:"1800",Sensitivity:"4.8","ADS mode":"Relative","Monitor distance coefficient":"1.78"},"Mouse settings")},
  {id:"archive-nate-mw",name:"NateGibson",image:"",team:"",source:"YouTube · NateGibson",url:"https://www.youtube.com/watch?v=6L2kXnOxg2o",edition:"Call of Duty: Modern Warfare (2019) / Warzone (2020)",published:"2020-08-14",snapshot:snapshot({DPI:"800",Sensitivity:"8","Windows sensitivity":"6",FOV:"110"},"Mouse & display settings")},
  {id:"archive-nate-bo2",name:"NateGibson",image:"",team:"",source:"YouTube · NateGibson",url:"https://www.youtube.com/watch?v=tFKe_nPB2ec",edition:"Call of Duty: Black Ops II",published:"2018-08-31",snapshot:snapshot({DPI:"800",Sensitivity:"2.40","Windows sensitivity":"6",FOV:"90"},"Mouse & display settings")},
];
export function archivedProPlayers(game:ProConfigGame,gameName=""):ProPlayer[]{
  if(game==="css")return css;
  if(game!=="cod"&&game!=="callofdutywarzone")return [];
  // A generic CoD hub may show dated editions, but a specific game must never
  // silently receive Warzone or a different generation's settings.
  const key=gameName.toLowerCase().replace(/[™®]/g,"").trim();
  if(game==="callofdutywarzone")return creators.filter(p=>p.id==="archive-nate-mw");
  if(key==="call of duty"||!key)return creators;
  if(/black ops (?:ii|2)(?:\b|$)/i.test(key))return creators.filter(p=>p.id==="archive-nate-bo2");
  if(/modern warfare (?:ii|2)\b/i.test(key)&&(/2022/.test(key)||/\bii\b/i.test(key)))return creators.filter(p=>p.id==="archive-tgd-mw2");
  if(/^call of duty:? modern warfare(?: \(2019\))?$/i.test(key))return creators.filter(p=>p.id==="archive-nate-mw");
  return [];
}
