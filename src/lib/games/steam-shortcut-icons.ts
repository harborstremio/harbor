import { invoke } from "@tauri-apps/api/core";
import type { SteamShortcut } from "./steam-shortcuts";

type Request = {key:string;scope:string;root:string|null;accountId:number;appId:number|null;id:string;version:string;resolve:(value:string|undefined)=>void};
const cache=new Map<string,Promise<string|undefined>>(),queue:Request[]=[];
let scheduled=false,running=0;
const capacity=192;
// Visible rows share batches; one large shortcut file is parsed once per batch.
async function drain() {
  scheduled=false;
  while(running<2&&queue.length){
    const first=queue.shift()!,batch=[first];
    for(let index=0;index<queue.length&&batch.length<24;){
      if(queue[index].scope===first.scope)batch.push(queue.splice(index,1)[0]);else index++;
    }
    running++;
    void invoke<Record<string,string>>("games_steam_shortcut_icons",{root:first.root,accountId:first.accountId,requests:batch.map(item=>({appId:item.appId,...(item.appId===null?{shortcutId:item.id}:{}),key:item.version}))})
      .then(values=>{for(const item of batch){const value=values[item.id];item.resolve(typeof value==="string"&&value.startsWith("data:image/png;base64,")&&value.length<90_000?value:undefined);}},()=>{for(const item of batch){cache.delete(item.key);item.resolve(undefined);}})
      .finally(()=>{running--;void drain();});
  }
}
export function loadSteamShortcutIcon(profile:string,root:string|null,game:SteamShortcut) {
  if(!game.iconKey)return Promise.resolve(undefined);
  const scope=JSON.stringify([profile,root,game.accountId]),key=JSON.stringify([scope,game.id,game.iconKey]);
  const existing=cache.get(key);
  if(existing){cache.delete(key);cache.set(key,existing);return existing;}
  const value=new Promise<string|undefined>(resolve=>queue.push({key,scope,root,accountId:game.accountId,appId:game.appId,id:game.id,version:game.iconKey!,resolve}));
  cache.set(key,value);
  while(cache.size>capacity)cache.delete(cache.keys().next().value!);
  if(!scheduled){scheduled=true;setTimeout(()=>void drain(),0);}
  return value;
}
