import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import { osClass } from "@/lib/platform";
import { useSteamShortcutLaunch } from "./use-steam-shortcut-launch";
import { useSteamShortcutActivity } from "./use-steam-shortcut-activity";
import type { ShortcutActivityEvent } from "@/lib/games/steam-shortcut-activity";
import { readSteamShortcutSettings, selectedShortcutAccount, shortcutError, steamShortcutGames, steamShortcutKey, type SteamShortcut, type SteamShortcutScan, type SteamShortcutSettings } from "@/lib/games/steam-shortcuts";

export function useSteamShortcuts(profile: string, active: boolean) {
  const activity=useSteamShortcutActivity(profile),journal=activity.store;
  const available = isTauri() && ["windows","macos","linux"].includes(osClass());
  const [state,setState] = useState(() => ({profile,settings:readSteamShortcutSettings(profile),scan:null as SteamShortcutScan|null}));
  const [loading,setLoading] = useState(false),[error,setError] = useState(""),[launching,setLaunching] = useState<string|null>(null),[launched,setLaunched] = useState<string|null>(null);
  const generation=useRef(0), configuration=useRef(0), lock=useRef(false), launchLock=useRef(false), live=useRef(true), last=useRef(0);
  const identity=useRef(profile); identity.current=profile;
  useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;};},[]);
  useEffect(()=>{configuration.current++;generation.current++;lock.current=false;last.current=0;setState({profile,settings:readSteamShortcutSettings(profile),scan:null});setError("");setLoading(false);setLaunching(null);setLaunched(null);},[profile]);
  const settings=state.profile===profile?state.settings:readSteamShortcutSettings(profile), scan=state.profile===profile?state.scan:null;
  const context=JSON.stringify([profile,settings.root,settings.accountId]),currentContext=useRef(context);currentContext.current=context;
  const games=useMemo(()=>steamShortcutGames(scan,settings),[scan,settings.root,settings.accountId]);
  const direct=useSteamShortcutLaunch(profile,settings.root,context,available&&scan?.directLaunch===true,active,games,journal);
  const refresh=useCallback(async()=>{
    if(!available||lock.current||!live.current||currentContext.current!==context)return;
    lock.current=true;const request=++generation.current;last.current=Date.now();setLoading(true);setError("");
    const started=Date.now();journal.record({kind:"scanStart",root:settings.root,accountId:settings.accountId??undefined});
    try {
      const value=await invoke<SteamShortcutScan>("games_scan_steam_shortcuts",{root:settings.root});
      value.games=value.games.map(game=>({...game,artwork:Object.fromEntries(Object.entries(game.artwork??{}).flatMap(([key,path])=>typeof path==="string"&&path?[[key,convertFileSrc(path)]]:[]))}));
      if(live.current&&request===generation.current&&identity.current===profile){
        setState({profile,settings,scan:value});
        const entries:ShortcutActivityEvent[]=[];
        if(journal.getSnapshot().detailed){
          const counts=new Map<number,number>();for(const game of value.games)counts.set(game.accountId,(counts.get(game.accountId)??0)+1);
          for(const accountId of value.accounts)entries.push({kind:"account",root:settings.root,accountId,count:counts.get(accountId)??0});
        }
        entries.push({kind:"scan",root:settings.root,count:value.games.length,accounts:value.accounts.length,elapsed:Math.max(0,Date.now()-started),warnings:value.warnings});
        journal.recordMany(entries);
      }
    } catch(value){if(live.current&&request===generation.current&&identity.current===profile){setError(shortcutError(value));journal.record({kind:"scanError",root:settings.root,code:shortcutError(value)});}}
    finally{if(request===generation.current){lock.current=false;if(live.current)setLoading(false);}}
  },[available,profile,settings.root,settings.accountId,journal]);
  useEffect(()=>{
    if(!active||!available)return;
    const check=()=>{if(!document.hidden&&Date.now()-last.current>=2000)void refresh();};
    check();const timer=setInterval(check,30000);window.addEventListener("focus",check);document.addEventListener("visibilitychange",check);
    return()=>{clearInterval(timer);window.removeEventListener("focus",check);document.removeEventListener("visibilitychange",check);};
  },[active,available,refresh]);
  const configure=(next:SteamShortcutSettings)=>{
    if(identity.current!==profile)return false;
    try{localStorage.setItem(steamShortcutKey(profile),JSON.stringify(next));}
    catch{setError("games.shortcuts.storeError");return false;}
    currentContext.current=JSON.stringify([profile,next.root,next.accountId]);
    configuration.current++;generation.current++;lock.current=false;last.current=0;setError("");setLaunching(null);setLaunched(null);setState(current=>({profile,settings:next,scan:current.profile===profile&&next.root===current.settings.root?current.scan:null}));
    journal.record({kind:"settings",root:next.root,accountId:next.accountId??undefined});return true;
  };
  const launch=async(game:SteamShortcut)=>{
    if(!available||game.appId===null||launchLock.current||direct.launching||direct.running.some(process=>process.id===game.id)||game.state!=="ready"||identity.current!==profile||currentContext.current!==context||!games.some(item=>item.id===game.id&&item.state==="ready"))return;
    const revision=configuration.current;
    const current=()=>live.current&&identity.current===profile&&revision===configuration.current;
    launchLock.current=true;setLaunching(game.id);setLaunched(null);setError("");direct.dismissError();
    try{await invoke("games_launch_steam_shortcut",{root:settings.root,accountId:game.accountId,appId:game.appId});if(current()){setLaunched(game.id);journal.record({kind:"steam",root:settings.root,accountId:game.accountId,name:game.name});}}
    catch(value){if(current()){setError(shortcutError(value));journal.record({kind:"error",root:settings.root,accountId:game.accountId,name:game.name,code:shortcutError(value)});}}
    finally{launchLock.current=false;if(current())setLaunching(null);}
  };
  useEffect(()=>{if(!launched)return;const timer=setTimeout(()=>setLaunched(null),5000);return()=>clearTimeout(timer);},[launched]);
  return {profile,available,settings,scan,activity,accountId:selectedShortcutAccount(scan,settings),games,loading,error:error||direct.error,launching:launching??direct.launching,launched,refresh,configure,launch,
    directAvailable:direct.available,directLaunching:direct.launching,running:direct.running,launchDirect:(game:SteamShortcut)=>{if(live.current&&!launchLock.current&&identity.current===profile&&currentContext.current===context){setError("");setLaunched(null);void direct.launch(game);}},dismissError:()=>{setError("");direct.dismissError();}};
}
export type SteamShortcutsLibrary=ReturnType<typeof useSteamShortcuts>;
