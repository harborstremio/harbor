import { parseImportedArtwork } from "./imported-artwork";
import type { GameSummary } from "./types";

export type EmulatorKind = "mgba" | "dolphin" | "ppsspp" | "retroarch";
export type Emulator = { kind: EmulatorKind; path: string; corePath?: string | null };
export type LocalGame = { path: string; name: string; sizeBytes: number; system: number; format: string; available: boolean; issue?: string | null; discs: number; linked?: GameSummary };
export type RomScan = { root: string; games: LocalGame[]; skipped: number; limited: boolean };
export type RomFolder = RomScan & { id: string; system: number; scannedAt: number; unavailable?: boolean; files?: string[] };
export type RunningGame = { path: string; pid: number; startedAt: number; system: number };
export type EmulationStore = { version: 1; folders: RomFolder[]; profiles: Record<number, Emulator>; lastPlayed: Record<string, number>; matches: Record<string, GameSummary> };
export const EMULATION_SYSTEMS = [
  { id:24, name:"Game Boy Advance", short:"GBA", device:"/games/platforms/gba.png", extensions:"GBA", emulators:["mgba","retroarch"] },
  { id:33, name:"Game Boy", short:"GB", extensions:"GB", emulators:["mgba","retroarch"] },
  { id:22, name:"Game Boy Color", short:"GBC", extensions:"GBC · GB", emulators:["mgba","retroarch"] },
  { id:18, name:"Nintendo Entertainment System", short:"NES", extensions:"NES · FDS", emulators:["retroarch"] },
  { id:19, name:"Super Nintendo", short:"SNES", device:"/games/platforms/snes.jpg", extensions:"SFC · SMC", emulators:["retroarch"] },
  { id:4, name:"Nintendo 64", short:"N64", device:"/games/platforms/n64.jpg", extensions:"N64 · Z64 · V64", emulators:["retroarch"] },
  { id:21, name:"Nintendo GameCube", short:"GameCube", device:"/games/platforms/gamecube.jpg", extensions:"ISO · GCM · RVZ · GCZ · CISO", emulators:["dolphin","retroarch"] },
  { id:5, name:"Nintendo Wii", short:"Wii", extensions:"ISO · WBFS · RVZ · GCZ · CISO", emulators:["dolphin","retroarch"] },
  { id:20, name:"Nintendo DS", short:"DS", extensions:"NDS", emulators:["retroarch"] },
  { id:7, name:"PlayStation", short:"PS1", device:"/games/platforms/playstation.png", extensions:"CUE · CHD · PBP · M3U", emulators:["retroarch"] },
  { id:38, name:"PlayStation Portable", short:"PSP", extensions:"ISO · CSO · PBP", emulators:["ppsspp","retroarch"] },
  { id:29, name:"Sega Mega Drive / Genesis", short:"Mega Drive", extensions:"GEN · MD · SMD", emulators:["retroarch"] },
  { id:64, name:"Sega Master System", short:"Master System", extensions:"SMS", emulators:["retroarch"] },
  { id:35, name:"Sega Game Gear", short:"Game Gear", extensions:"GG", emulators:["retroarch"] },
  { id:32, name:"Sega Saturn", short:"Saturn", extensions:"CUE · CHD · PBP · M3U", emulators:["retroarch"] },
  { id:23, name:"Sega Dreamcast", short:"Dreamcast", extensions:"CDI · GDI · CHD · M3U", emulators:["retroarch"] },
] as const;
export const EMULATORS: Record<EmulatorKind, { name: string; url: string }> = {
  mgba: { name:"mGBA", url:"https://mgba.io/downloads.html" },
  dolphin: { name:"Dolphin", url:"https://dolphin-emu.org/download/" },
  ppsspp: { name:"PPSSPP", url:"https://www.ppsspp.org/download/" },
  retroarch: { name:"RetroArch", url:"https://www.retroarch.com/?page=platforms" },
};
export const EMPTY_EMULATION = (): EmulationStore => ({ version:1, folders:[], profiles:{}, lastPlayed:{}, matches:{} });
export const emulationKey = (profileId: string) => `harbor.games.emulation.v1:${encodeURIComponent(profileId)}`;
export const folderKey = (root: string, system: number) => `${system}:${/^[a-z]:|^\\\\/i.test(root) ? root.toLowerCase().replaceAll("\\", "/") : root}`;
const path = (value: unknown): value is string => typeof value === "string" && value.length < 4096 && /^(?:[a-z]:[\\/]|[\\/])/i.test(value) && !value.includes("\0");
export function parseEmulation(raw: unknown): EmulationStore {
  const result = EMPTY_EMULATION();
  if (!raw || typeof raw !== "object" || (raw as EmulationStore).version !== 1) return result;
  const data = raw as Partial<EmulationStore>;
  let count = 0;
  for (const folder of Array.isArray(data.folders) ? data.folders.slice(0,32) : []) {
    if (!folder || !path(folder.root) || !EMULATION_SYSTEMS.some(s => s.id === folder.system)) continue;
    const games: LocalGame[] = [];
    for (const game of Array.isArray(folder.games) ? folder.games.slice(0,5000) : []) {
      if (count >= 12_000) break;
      if (!game || !path(game.path) || typeof game.name !== "string" || game.name.length > 500 || !Number.isFinite(game.sizeBytes) || game.sizeBytes < 0) continue;
      count++; games.push({ path:game.path, name:game.name, sizeBytes:game.sizeBytes, system:folder.system, format:typeof game.format === "string" ? game.format.slice(0,8) : "", available:!!game.available, issue:typeof game.issue === "string" ? game.issue.slice(0,64) : null, discs:Math.max(1,Math.min(100,Number(game.discs)||1)) });
    }
    const files = Array.isArray(folder.files) ? folder.files.filter(path).slice(0,5000) : undefined;
    result.folders.push({ id:folderKey(folder.root,folder.system), root:folder.root, system:folder.system, games: files ? games.filter(game=>files.some(file=>folderKey(file,folder.system)===folderKey(game.path,folder.system))) : games, ...(files ? {files} : {}), scannedAt:Number(folder.scannedAt)||0, skipped:Number(folder.skipped)||0, limited:!!folder.limited, unavailable:!!folder.unavailable });
  }
  for (const [id, profile] of Object.entries(data.profiles ?? {})) {
    const system = EMULATION_SYSTEMS.find(s => s.id === Number(id));
    if (!system || !profile || !(profile.kind in EMULATORS) || !(system.emulators as readonly string[]).includes(profile.kind) || !path(profile.path)) continue;
    result.profiles[Number(id)] = { kind:profile.kind, path:profile.path, ...(path(profile.corePath) ? { corePath:profile.corePath } : {}) };
  }
  for (const [key, value] of Object.entries(data.lastPlayed ?? {}).slice(0,12_000)) if (path(key) && Number.isFinite(value) && value > 0) result.lastPlayed[key] = value;
  for (const [key,value] of Object.entries(data.matches ?? {}).slice(0,12_000)) {
    const match=parseLocalMatch(value);
    if (key.length < 4200 && match) result.matches[key]=match;
  }
  return result;
}
export function readEmulation(profileId: string): EmulationStore {
  try { const raw = localStorage.getItem(emulationKey(profileId)); return raw && raw.length <= 16_000_000 ? parseEmulation(JSON.parse(raw)) : EMPTY_EMULATION(); } catch { return EMPTY_EMULATION(); }
}
export function writeEmulation(profileId: string, value: EmulationStore) {
  if (value.folders.length > 32 || value.folders.reduce((count, folder) => count + folder.games.length, 0) > 12_000) throw new Error("emulation_library_limit");
  const encoded = JSON.stringify(value);
  if (encoded.length > 16_000_000) throw new Error("emulation_library_limit");
  localStorage.setItem(emulationKey(profileId), encoded);
}
/** A patched output adds one file; refreshing it must not import neighbouring ROMs. */
export function withLocalOutput(store: EmulationStore, game: LocalGame & {root:string}, metadata?: GameSummary): EmulationStore {
  if (!path(game.path) || !path(game.root) || !EMULATION_SYSTEMS.some(s=>s.id===game.system) || folderKey(game.path.replace(/[\\/][^\\/]+$/,""),game.system)!==folderKey(game.root,game.system)) throw new Error("emulation_match_invalid");
  const id=folderKey(game.root,game.system), existing=store.folders.find(folder=>folder.id===id), key=folderKey(game.path,game.system);
  const folder: RomFolder={...(existing??{root:game.root,system:game.system,skipped:0,limited:false,files:[]}),id,scannedAt:Date.now(),unavailable:false,games:[...(existing?.games??[]).filter(value=>folderKey(value.path,value.system)!==key),game]};
  if(folder.files)folder.files=[...new Map([...folder.files,game.path].map(file=>[folderKey(file,game.system),file])).values()];
  const match=metadata&&parseLocalMatch(metadata);
  return {...store,folders:[...store.folders.filter(value=>value.id!==id),folder],matches:match?{...store.matches,[key]:match}:store.matches};
}
export function localGames(store: EmulationStore, query = "", system = 0) {
  const needle = query.trim().toLocaleLowerCase();
  const result=new Map<string,LocalGame & {root:string;folderId:string}>();
  for(const folder of store.folders)for(const game of folder.games){
    const linked=store.matches?.[folderKey(game.path,game.system)];
    if((system&&game.system!==system)||(needle&&!`${game.name} ${linked?.name??""}`.toLocaleLowerCase().includes(needle)))continue;
    const key=`${game.system}:${game.path}`,current=result.get(key);
    const value={...game,linked,available:game.available&&!folder.unavailable,root:folder.root,folderId:folder.id};
    if(!current||(!current.available&&value.available))result.set(key,value);
  }
  return [...result.values()];
}
export function emulationError(error: unknown) {
  const code = String(error);
  const value = error instanceof Error ? error.message : code;
  return /^emulation_[a-z_]+$/.test(value) ? `games.emulation.${value}` : "games.emulation.failed";
}

export function parseLocalMatch(value: unknown): GameSummary | null {
  if (!value || typeof value !== "object") return null;
  const game=value as Partial<GameSummary>;
  if (!Number.isSafeInteger(game.igdbId) || game.igdbId! <= 0 || typeof game.name !== "string" || !game.name.trim()) return null;
  const image=(url:unknown):string => typeof url === "string" && /^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_[a-z0-9_]+\/[a-zA-Z0-9_-]+\.jpg$/.test(url) ? url : "";
  let importedArtwork;
  try { importedArtwork=parseImportedArtwork(game.importedArtwork,game.igdbId); } catch { return null; }
  // Local console copies retain their IGDB identity, even if the title also has a PC port.
  return {...(importedArtwork?{importedArtwork}:{}),id:`igdb:${game.igdbId}`,igdbId:game.igdbId,name:game.name.trim().slice(0,500),capsule:image(game.capsule),portrait:image(game.portrait)||undefined,platforms:Array.isArray(game.platforms)?game.platforms.filter((v):v is string=>typeof v==="string").slice(0,30):[]};
}
export function localSearchName(name:string) {
  return name.replace(/\.(?:gba|gbc?|nes|sfc|smc|nds|iso|chd|cue|m3u|rvz|gcm|cso|pbp|z64|n64|v64|gen|md|smd|sms|gg|cdi|gdi)$/i,"").replace(/\s*\((?:USA|Europe|Japan|World|En(?:,[A-Za-z]{2})*|Rev[^)]*)\)/gi,"").replace(/\s*\[[^\]]*\]/g,"").replace(/_/g," ").replace(/\s+/g," ").trim().slice(0,160);
}
