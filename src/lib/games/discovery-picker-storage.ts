import { discoveryDefaults, DISCOVERY_MODES, type DiscoveryOptions, type LibraryObservation } from "./discovery-picker";
import { customLinkedGame } from "./custom-library";
import type { GameSummary } from "./types";

export type DiscoveryPreferences={options:DiscoveryOptions;favorites:GameSummary[];observation:LibraryObservation|null};
const key=(profile:string)=>`harbor.games.discovery-picker.v1:${encodeURIComponent(profile)}`;
export const discoveryPreferences=():DiscoveryPreferences=>({options:discoveryDefaults(),favorites:[],observation:null});

export function readDiscoveryPreferences(profile:string):DiscoveryPreferences {
  const fallback=discoveryPreferences();
  try{
    const text=localStorage.getItem(key(profile));if(!text||text.length>2*1024*1024)return fallback;
    const raw=JSON.parse(text);if(raw?.version!==1)return fallback;
    const source=raw.options??{},options={...fallback.options};
    options.tags=Array.isArray(source.tags)?[...new Set<number>(source.tags.filter((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>0))].slice(0,30):[];
    options.modes=DISCOVERY_MODES.filter(([id])=>Array.isArray(source.modes)&&source.modes.includes(id)).map(([id])=>id);
    for(const [field,values]of Object.entries({platform:["all","win","mac","linux"],price:["all","free","offers"],scope:["new","library","any"],direction:["balanced","acclaimed","hidden","recent"]}))if(values.includes(source[field]))Object.assign(options,{[field]:source[field]});
    options.controller=source.controller===true;options.history=source.history!==false;
    options.excluded=Array.isArray(source.excluded)?[...new Set<number>(source.excluded.filter((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>0))].slice(-500):[];
    const favorites:GameSummary[]=Array.isArray(raw.favorites)?raw.favorites.slice(0,5).map(customLinkedGame).filter((game:GameSummary|null):game is GameSummary=>!!game):[];
    const o=raw.observation;
    const observation:LibraryObservation|null=o&&typeof o.account==="string"&&/^\d{17}$/.test(o.account)&&Array.isArray(o.ids)&&Array.isArray(o.added)?{
      account:o.account,ids:o.ids.filter((id:unknown)=>Number.isSafeInteger(id)&&Number(id)>0).slice(0,50000),added:o.added.filter((entry:any)=>entry&&Number.isSafeInteger(entry.id)&&entry.id>0&&Number.isFinite(entry.at)&&entry.at>0).slice(0,50)
    }:null;
    return {options,favorites,observation};
  }catch{return fallback;}
}
export function writeDiscoveryPreferences(profile:string,preferences:DiscoveryPreferences):void {
  localStorage.setItem(key(profile),JSON.stringify({version:1,...preferences}));
}
