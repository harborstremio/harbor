import { readGuideSource } from "./guides-fetch";
import { GuideSourceRateLimit } from "./guide-source-status";
import { parseProPortraitSearch, portraitFromProfile, proPortraitId, proPortraitImage } from "./pro-portrait-data";
import type { ProPlayer } from "./pro-configs";

const key="harbor.games.pro-portraits.v2",cache=new Map<string,{image:string;until:number}>();
let restored=false;
function restore(){
  if(restored)return;restored=true;
  try{const entries:unknown=JSON.parse(localStorage.getItem(key)??"[]");if(Array.isArray(entries))for(const row of entries.slice(0,256)){
    if(Array.isArray(row)&&/^[\w-]{1,80}$/.test(row[0])&&Number.isFinite(row[1]?.until)&&row[1].until>Date.now()&&row[1].until<=Date.now()+86_400_000&&(!row[1].image||proPortraitImage(row[1].image)))cache.set(row[0],row[1]);
  }}catch{/* Portrait caching is optional. */}
}
export function cachedProPortrait(id:string):string|undefined {
  restore();const held=cache.get(id);return held&&held.until>Date.now()?held.image:undefined;
}
export function rememberProPortrait(id:string,image:string){
  if(!/^[\w-]{1,80}$/.test(id)||(image&&!proPortraitImage(image)))return;
  restore();cache.delete(id);cache.set(id,{image,until:Date.now()+(image?86_400_000:1_800_000)});
  while(cache.size>256)cache.delete(cache.keys().next().value!);
  try{localStorage.setItem(key,JSON.stringify([...cache]));}catch{/* Storage may be full or disabled. */}
}
export async function loadProPortrait(player:ProPlayer,signal:AbortSignal,rejected:readonly string[]=[]):Promise<string>{
  if(proPortraitId(player.url)!==player.id)return "";
  signal.throwIfAborted();const held=cachedProPortrait(player.id);if(held!==undefined&&!rejected.includes(held))return held;
  let image="";
  // Profile portraits are 220px; search thumbnails can be only 50px. Keep the
  // API as a real fallback rather than enlarging a tiny thumbnail by default.
  try{
    image=await readGuideSource(player.url,signal,html=>portraitFromProfile(new DOMParser().parseFromString(html,"text/html"),player.id));
  }catch(error){signal.throwIfAborted();if(error instanceof GuideSourceRateLimit)throw error;}
  if(!image||rejected.includes(image)){
    const query=new URLSearchParams({q:player.name.slice(0,80),limit:"20"});
    image=await readGuideSource(`https://prosettings.net/wp-json/pro/v2/search?${query}`,signal,body=>parseProPortraitSearch(JSON.parse(body),player.id));
  }
  signal.throwIfAborted();if(rejected.includes(image))image="";rememberProPortrait(player.id,image);return image;
}
