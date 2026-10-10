import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { emitTo } from '@tauri-apps/api/event';
import { focusRetroPopout, RETRO_DOCK, RETRO_WINDOW, validRetroGame } from '@/lib/games/retro-window';
import type { GameSummary } from "@/lib/games/types";
import { osClass } from "@/lib/platform";
import { importUnmatchedRom } from "@/lib/games/library-metadata-import";
import { romPlayerMode, type EmbeddedGame } from '@/lib/games/embedded-emulation';
import { emulationError, folderKey, parseLocalMatch, readEmulation, writeEmulation, withLocalOutput, type Emulator, type EmulationStore, type LocalGame, type RomScan, type RunningGame } from "@/lib/games/emulation";

export function useEmulationLibrary(profileId: string, active: boolean) {
  const available = isTauri() && ["windows","linux","macos"].includes(osClass());
  const [stored,setStored] = useState(() => ({profileId,data:readEmulation(profileId)}));
  const data=stored.profileId===profileId?stored.data:readEmulation(profileId);
  const [busy,setBusy] = useState("");
  const [error,setError] = useState("");
  const [running,setRunning] = useState<RunningGame[]>([]);
  const [session, setSession] = useState<EmbeddedGame | null>(null);
  const sessionRef = useRef(session); sessionRef.current = session;
  useEffect(() => {
    if (!available) return;
    let current = true;
    const pending = listen<EmbeddedGame>(RETRO_DOCK, event => {
      const game = event.payload;
      if (!validRetroGame(game)) return;
      const accepted = current && game.profile === profileId && !sessionRef.current;
      if (accepted) { sessionRef.current = game; setSession(game); }
      void emitTo(RETRO_WINDOW, 'games-retro:docked', { id: game.sessionId, accepted });
    });
    return () => { current = false; void pending.then(stop => stop()); };
  }, [available, profileId]);
  useEffect(() => { sessionRef.current = null; setSession(null); }, [profileId]);
  const ended=useRef(new Set<number>());
  const [detected,setDetected] = useState<Emulator[]>([]);
  const [searched,setSearched] = useState(false);
  const held = useRef(data); held.current = data;
  const alive = useRef(true), lock = useRef(false), initialized = useRef(false);
  const owner=useRef(profileId);owner.current=profileId;
  const operation=useRef(0);
  const valid=()=>alive.current&&owner.current===profileId;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(()=>{operation.current++;lock.current=false;initialized.current=false;setBusy("");setError("");},[profileId]);
  const commit = (next: EmulationStore) => { if(!valid())return;writeEmulation(profileId,next); held.current=next; setStored({profileId,data:next}); };
  const work = async (key: string, run: () => Promise<void>) => {
    if (lock.current || !available) return;
    const id=++operation.current;lock.current=true;setBusy(key);setError("");
    try { await run(); } catch(error) { if(valid())setError(emulationError(error)); }
    finally { if(operation.current===id){lock.current=false;if(valid())setBusy("");} }
  };
  const refresh = () => work("scan",async()=>{
    const folders = [];
    for (const folder of held.current.folders) {
      try { const scan = await invoke<RomScan>("games_scan_roms",{root:folder.root,system:folder.system}); folders.push({...folder,...scan,games:folder.files?scan.games.filter(game=>folder.files!.some(file=>folderKey(file,folder.system)===folderKey(game.path,folder.system))):scan.games,scannedAt:Date.now(),unavailable:false}); }
      catch { folders.push({...folder,unavailable:true}); }
    }
    if(valid())commit({...held.current,folders});
  });
  useEffect(() => {
    if (!available || !active || initialized.current) return;
    initialized.current=true; void refresh();
  },[active,available,profileId]);
  useEffect(() => {
    if(!available)return;
    let current=true;
    void invoke<RunningGame[]>("games_emulation_running").then(value=>{if(current)setRunning(value.filter(v=>!ended.current.has(v.pid)));},()=>{});
    const subscription=listen<{path:string;pid:number;seconds:number;success:boolean}>("games:emulator-exited",event=>{if(current){ended.current.add(event.payload.pid);if(ended.current.size>1024)ended.current.delete(ended.current.values().next().value!);setRunning(values=>values.filter(v=>v.pid!==event.payload.pid));if(!event.payload.success&&event.payload.seconds<10&&held.current.folders.some(folder=>folder.games.some(game=>game.path===event.payload.path)))setError("games.emulation.emulation_exited_early");}}).catch(()=>()=>{});
    return()=>{current=false;void subscription.then(stop=>stop());};
  },[available]);
  const discover = () => work("detect",async()=>{const found=await invoke<Emulator[]>("games_find_emulators");if(valid()){setDetected(found);setSearched(true);}});
  const addFolder = (system:number) => work("import",async()=>{
    const {open}=await import("@tauri-apps/plugin-dialog");const root=await open({directory:true,multiple:false});if(typeof root!=="string"||!valid())return;
    const scan=await invoke<RomScan>("games_scan_roms",{root,system});if(!valid())return;
    const id=folderKey(scan.root,system);commit({...held.current,folders:[...held.current.folders.filter(f=>f.id!==id),{...scan,id,system,scannedAt:Date.now()}]});
  });
  const configure = (system:number,emulator:Emulator) => work("configure",async()=>{
    const checked=await invoke<Emulator>("games_validate_emulator",{emulator});if(valid())commit({...held.current,profiles:{...held.current.profiles,[system]:checked}});
  });
  const chooseApp = (system:number,kind:Emulator["kind"],corePath?:string|null) => work("configure",async()=>{
    const {open}=await import("@tauri-apps/plugin-dialog");const path=await open({multiple:false,directory:false,...(osClass()==="windows"?{filters:[{name:"Emulator",extensions:["exe"]}]}:osClass()==="macos"?{filters:[{name:"Application",extensions:["app"]}]}:{})});if(typeof path!=="string"||!valid())return;
    const checked=await invoke<Emulator>("games_validate_emulator",{emulator:{kind,path,corePath}});if(valid())commit({...held.current,profiles:{...held.current.profiles,[system]:checked}});
  });
  const chooseCore = (system:number) => work("configure",async()=>{
    const emulator=held.current.profiles[system];if(!emulator||emulator.kind!=="retroarch")return;
    const {open}=await import("@tauri-apps/plugin-dialog");const path=await open({multiple:false,filters:[{name:"Libretro core",extensions:[osClass()==="windows"?"dll":osClass()==="macos"?"dylib":"so"]}]});if(typeof path!=="string"||!valid())return;
    const checked=await invoke<Emulator>("games_validate_emulator",{emulator:{...emulator,corePath:path}});if(valid())commit({...held.current,profiles:{...held.current.profiles,[system]:checked}});
  });
  const removeFolder = (id:string) => {try{commit({...held.current,folders:held.current.folders.filter(f=>f.id!==id)});}catch(error){setError(emulationError(error));}};
  const matchGame = (game:LocalGame,metadata:GameSummary|null) => {
    try {
      const matches={...held.current.matches},key=folderKey(game.path,game.system);
      if(metadata){const parsed=parseLocalMatch(metadata);if(!parsed)throw Error("emulation_match_invalid");matches[key]=parsed;}else delete matches[key];
      commit({...held.current,matches});return true;
    }catch(error){setError(emulationError(error));return false;}
  };
  const matchMissing = (game:LocalGame,metadata:GameSummary,signal:AbortSignal) => {
    if (!valid() || lock.current || signal.aborted) return false;
    try { commit(importUnmatchedRom(readEmulation(profileId),game.path,game.system,game.name,metadata)); return true; }
    catch { return false; }
  };
  const launchExternal = (game:LocalGame & {root:string}) => work(game.path,async()=>{
    const emulator=held.current.profiles[game.system];if(!emulator)throw "emulation_not_configured";
    await invoke<RunningGame>("games_launch_emulated",{emulator,gamePath:game.path,root:game.root,system:game.system});
    const current=await invoke<RunningGame[]>("games_emulation_running");
    if(valid()){setRunning(current.filter(v=>!ended.current.has(v.pid)));commit({...held.current,lastPlayed:{...held.current.lastPlayed,[game.path]:Date.now()}});}
  });
  const launch = async (game: LocalGame & { root: string }) => {
    if (available && romPlayerMode(game, held.current.profiles[game.system]) === 'embedded') {
      if (await focusRetroPopout().catch(() => false)) return;
      if (valid() && !sessionRef.current && !lock.current) { const next = { ...game, sessionId: crypto.randomUUID(), profile: profileId }; sessionRef.current = next; setSession(next); }
      return Promise.resolve();
    }
    return launchExternal(game);
  };
  const sessionStarted = () => { if (session && session.profile === profileId) { try { commit({ ...held.current, lastPlayed: { ...held.current.lastPlayed, [session.path]: Date.now() } }); } catch { setError('games.emulation.failed'); } } };
  const closeSession = () => { sessionRef.current = null; setSession(null); };
  const addOutput = (game: LocalGame & {root:string}, metadata?: GameSummary) => {
    if(!available||!valid())return false;
    try { commit(withLocalOutput(held.current,game,metadata));return true; } catch(error) {setError(emulationError(error));return false;}
  };
  return {available,data,busy,error,running,session,sessionStarted,closeSession,launchExternal,detected,searched,refresh,discover,addFolder,addOutput,configure,chooseApp,chooseCore,removeFolder,matchGame,matchMissing,launch,dismissError:()=>setError("")};
}
export type EmulationLibrary = ReturnType<typeof useEmulationLibrary>;
