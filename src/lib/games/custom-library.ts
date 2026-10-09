import { parseImportedArtwork } from "./imported-artwork";
import { parseHydraOrigin, type HydraOrigin } from './hydra-import-records';
import type { GameSummary } from "./types";
export type LaunchConfig = { executable: string; workingDirectory: string | null; arguments: string[]; mode: "native" | "wine" | "proton"; runner: string | null; prefix: string | null; steamDirectory: string | null };
export type CustomPlaytimeCorrection = { totalSeconds: number; measuredSeconds: number; changedAt: number };
export type CustomGame = { id: string; name: string; config: LaunchConfig; linked: GameSummary | null; artwork: string | null; pinned: boolean; hidden: boolean; addedAt: number; lastPlayed: number; measuredSeconds: number; playtimeCorrection?: CustomPlaytimeCorrection; hydra?: HydraOrigin; launchPending?: boolean };
export type CustomSession = { id: string; gameId: string; startedAt: number; endedAt: number; seconds: number; success: boolean; code: number | null };
export type CustomLibrary = { version: 1; games: CustomGame[]; sessions: CustomSession[] };
export type CustomProcess = { profile: string; id: string; sessionId: string; path: string; pid: number; startedAt: number };
export type CustomExit = { profile: string; id: string; sessionId: string; pid: number; seconds: number; startedAt: number; success: boolean; code: number | null; endedAt: number };
export const emptyCustomLibrary = (): CustomLibrary => ({ version: 1, games: [], sessions: [] });
export const emptyLaunchConfig = (): LaunchConfig => ({ executable: "", workingDirectory: null, arguments: [], mode: "native", runner: null, prefix: null, steamDirectory: null });
/** Adding a game is library activity, without implying a play session. */
export function customActivityAt(game: CustomGame, now = Date.now()) {
  const valid = (value: number) => Number.isFinite(value) && value > 0 && value <= now ? value : 0;
  return Math.max(valid(game.addedAt), valid(game.lastPlayed));
}
export function matchingCustomGames(games: CustomGame[], game: GameSummary) {
  if(game.id.startsWith("custom:"))return games.filter(item=>!item.hidden&&`custom:${item.id}`===game.id);
  return games.filter(item => !item.hidden && !(item.launchPending && !item.hydra?.original.executable) && item.linked && (item.linked.id === game.id || (game.steamId && item.linked.steamId === game.steamId) || (game.igdbId && item.linked.igdbId === game.igdbId && !(item.linked.steamId && game.steamId && item.linked.steamId !== game.steamId))));
}
export const customLibraryKey = (profile: string) => `harbor.games.custom.v1:${encodeURIComponent(profile)}`;
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const path = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 4096 && /^(?:[a-z]:[\\/]|[\\/])/i.test(value) && !value.includes("\0");
const number = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const image = (value: unknown): value is string => typeof value === "string" && (/^https:\/\/images\.igdb\.com\/igdb\/image\/upload\/t_[a-z0-9_]+\/[a-zA-Z0-9_-]+\.jpg$/.test(value) || /^https:\/\/(?:shared\.(?:akamai|fastly)\.steamstatic\.com|cdn\.(?:akamai|fastly)\.steamstatic\.com)\/[^?#\s]+$/.test(value));
export function customLinkedGame(value: unknown): GameSummary | null {
  if (!value || typeof value !== "object") return null;
  const game = value as GameSummary;
  if (typeof game.name !== "string" || !game.name.trim()) return null;
  const steamId = number(game.steamId) && game.steamId > 0 ? game.steamId : undefined;
  const igdbId = number(game.igdbId) && game.igdbId > 0 ? game.igdbId : undefined;
  if (!steamId && !igdbId) return null;
  let importedArtwork;
  try { importedArtwork=parseImportedArtwork(game.importedArtwork,igdbId); } catch { return null; }
  // A reviewed IGDB edition stays selected even when its record also links to Steam.
  const selectedEdition=igdbId&&game.id===`igdb:${igdbId}`;
  return { ...(importedArtwork?{importedArtwork}:{}), id: selectedEdition ? `igdb:${igdbId}` : steamId ? `steam:${steamId}` : `igdb:${igdbId}`, igdbId, steamId, name: game.name.trim().slice(0, 500), capsule: image(game.capsule) ? game.capsule : "", portrait: image(game.portrait) ? game.portrait : undefined, platforms: Array.isArray(game.platforms) ? game.platforms.filter(v => typeof v === "string").slice(0, 30) : [] };
}
export function validateLaunchConfig(value: unknown): LaunchConfig {
  const v = value as LaunchConfig;
  if (!v || !path(v.executable) || !["native", "wine", "proton"].includes(v.mode) || !Array.isArray(v.arguments) || v.arguments.length > 128 || v.arguments.some(v => typeof v !== "string" || v.length > 2048 || v.includes("\0")) || v.arguments.join("").length > 16384 || [v.workingDirectory, v.runner, v.prefix, v.steamDirectory].some(v => v !== null && !path(v))) throw Error("launch_config");
  return { executable: v.executable, workingDirectory: v.workingDirectory, arguments: [...v.arguments], mode: v.mode, runner: v.runner, prefix: v.prefix, steamDirectory: v.steamDirectory };
}
export function parseCustomLibrary(raw: string | null): CustomLibrary {
  if (raw === null) return emptyCustomLibrary();
  if (raw.length > 5 * 1024 * 1024) throw Error("launch_limit");
  let store: CustomLibrary; try { store = JSON.parse(raw); } catch { throw Error("launch_store"); }
  if (!store || store.version !== 1 || !Array.isArray(store.games) || store.games.length > 1000 || !Array.isArray(store.sessions) || store.sessions.length > 1000) throw Error("launch_store");
  const ids = new Set<string>(), sessions = new Set<string>();
  const games = store.games.map(v => {
    if (!v || !uuid(v.id) || ids.has(v.id) || typeof v.name !== "string" || !v.name.trim() || v.name.length > 160 || typeof v.pinned !== "boolean" || typeof v.hidden !== "boolean" || ![v.addedAt, v.lastPlayed, v.measuredSeconds].every(number) || (v.artwork !== null && !path(v.artwork))) throw Error("launch_store");
    if (v.playtimeCorrection !== undefined) {
      const correction = v.playtimeCorrection;
      if (!correction || ![correction.totalSeconds, correction.measuredSeconds, correction.changedAt].every(number) || correction.totalSeconds > 3_600_000_000 || correction.measuredSeconds > v.measuredSeconds || !number(customPlaytime(v))) throw Error("launch_store");
    }
    ids.add(v.id); const linked = customLinkedGame(v.linked); if (v.linked !== null && !linked) throw Error("launch_store");
    const hydra=v.hydra===undefined?undefined:parseHydraOrigin(v.hydra);
    if(v.launchPending!==undefined&&(v.launchPending!==true||!hydra))throw Error('launch_store');
    const config=v.launchPending?emptyLaunchConfig():validateLaunchConfig(v.config);
    if(v.launchPending&&(!v.config||v.config.executable!==''||v.config.mode!=='native'||!Array.isArray(v.config.arguments)||v.config.arguments.length||[v.config.workingDirectory,v.config.runner,v.config.prefix,v.config.steamDirectory].some(value=>value!==null)))throw Error('launch_store');
    return { ...v, config, linked, ...(hydra?{hydra}:{}) };
  });
  const history = store.sessions.map(s => {
    if (!s || !uuid(s.id) || sessions.has(s.id) || !ids.has(s.gameId) || ![s.startedAt, s.endedAt, s.seconds].every(number) || s.endedAt < s.startedAt || typeof s.success !== "boolean" || (s.code !== null && !Number.isSafeInteger(s.code))) throw Error("launch_store");
    sessions.add(s.id); return { ...s };
  });
  return { version: 1, games, sessions: history };
}
export function upsertCustomGame(store: CustomLibrary, game: CustomGame): CustomLibrary {
  const next = { ...store, games: [game, ...store.games.filter(item => item.id !== game.id)] };
  return parseCustomLibrary(JSON.stringify(next));
}
export function saveCustomConfiguration(store: CustomLibrary, game: CustomGame): CustomLibrary {
  const previous = store.games.find(item => item.id === game.id);
  const next={ ...game, lastPlayed: previous?.lastPlayed ?? game.lastPlayed, measuredSeconds: previous?.measuredSeconds ?? game.measuredSeconds, playtimeCorrection: previous?.playtimeCorrection, ...(previous?.hydra?{hydra:previous.hydra}:{}) };
  delete next.launchPending;
  return upsertCustomGame(store,next);
}
export function removeCustomGame(store: CustomLibrary, id: string): CustomLibrary { return { ...store, games: store.games.filter(game => game.id !== id), sessions: store.sessions.filter(session => session.gameId !== id) }; }
/** Keep measured sessions intact. A correction changes the displayed total from this observation onward. */
export function customPlaytime(game: CustomGame) {
  return game.playtimeCorrection ? game.playtimeCorrection.totalSeconds + (game.measuredSeconds - game.playtimeCorrection.measuredSeconds) : game.measuredSeconds + importedCustomPlaytime(game);
}
export function importedCustomPlaytime(game:CustomGame) {return Math.floor((game.hydra?.original.playtimeMs??game.hydra?.original.steamPlaytimeMs??0)/1000);}
export function correctCustomPlaytime(store: CustomLibrary, id: string, seconds: number | null, at = Date.now()): CustomLibrary {
  const game = store.games.find(item => item.id === id);
  if (!game) throw Error("launch_removed");
  if (!number(at) || seconds !== null && (!number(seconds) || seconds > 3_600_000_000)) throw Error("launch_playtime");
  const next = { ...game };
  if (seconds === null) delete next.playtimeCorrection;
  else next.playtimeCorrection = { totalSeconds: seconds, measuredSeconds: game.measuredSeconds, changedAt: at };
  return upsertCustomGame(store, next);
}
export function updateCustomGames(store: CustomLibrary, ids: string[], patch: { pinned?: boolean; hidden?: boolean }): CustomLibrary {
  const selected = new Set(ids);
  if (!selected.size || selected.size > 1000 || [...selected].some(id => !store.games.some(game => game.id === id))) throw Error("launch_removed");
  // Read and commit once; concurrent play history and per-game configuration are preserved.
  return parseCustomLibrary(JSON.stringify({ ...store, games: store.games.map(game => selected.has(game.id) ? { ...game, ...patch } : game) }));
}
export function recordCustomExit(store: CustomLibrary, event: CustomExit, startedAt: number): CustomLibrary {
  if (store.sessions.some(session => session.id === event.sessionId) || !store.games.some(game => game.id === event.id)) return store;
  return { ...store, games: store.games.map(game => game.id === event.id ? { ...game, measuredSeconds: game.measuredSeconds + event.seconds, lastPlayed: Math.max(startedAt, game.lastPlayed) } : game), sessions: [{ id: event.sessionId, gameId: event.id, startedAt, endedAt: event.endedAt, seconds: event.seconds, success: event.success, code: event.code }, ...store.sessions].slice(0, 1000) };
}
export function customGameSummary(game: CustomGame): GameSummary { return game.linked ?? { id: `local:${game.id}`, name: game.name, capsule: "", platforms: [] }; }
export function customGameName(executable: string) { return executable.replace(/[\\/]+$/, "").split(/[\\/]/).pop()?.replace(/\.(?:exe|app|appimage)$/i, "").replace(/[_-]/g, " ").slice(0, 160) || ""; }
export function launchArguments(value: string) { const args = value.split(/\r?\n/).filter(line => line.length > 0); if (args.length > 128 || args.some(line => line.length > 2048 || line.includes("\0")) || args.join("").length > 16384) throw Error("launch_arguments"); return args; }
export function filterCustomGames(store: CustomLibrary, query: string, visibility: string, sort: string) {
  const needle = query.trim().toLocaleLowerCase(), now = Date.now();
  return store.games.filter(game => (visibility === "hidden" ? game.hidden : !game.hidden) && `${game.name} ${game.linked?.name ?? ""}`.toLocaleLowerCase().includes(needle)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || (sort === "recent" ? customActivityAt(b, now) - customActivityAt(a, now) : sort === "added" ? b.addedAt - a.addedAt : 0) || a.name.localeCompare(b.name));
}
export const readCustomLibrary = (profile: string) => parseCustomLibrary(localStorage.getItem(customLibraryKey(profile)));
const writes = new Map<string, Promise<unknown>>();
export function changeCustomLibrary(profile: string, change: (store: CustomLibrary) => CustomLibrary): Promise<CustomLibrary> {
  const key = customLibraryKey(profile), commit = () => { const value = change(readCustomLibrary(profile)), raw = JSON.stringify(value); if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024) throw Error("launch_limit"); const checked = parseCustomLibrary(raw); try { localStorage.setItem(key, raw); } catch { throw Error("launch_store_write"); } return checked; };
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(key, commit) : commit());
  writes.set(key, pending); void pending.finally(() => { if (writes.get(key) === pending) writes.delete(key); }).catch(() => {}); return pending;
}
export const customLaunchError = (error: unknown) => { const code = error instanceof Error ? error.message : String(error); return /^launch_[a-z_]+$/.test(code) ? `games.custom.${code}` : "games.custom.launch_failed"; };
