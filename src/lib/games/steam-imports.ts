import { STEAM_IMPORT_LIMIT, steamImportSummary, validSteamImportId } from "./steam-import";
import type { GameSummary } from "./types";

export type ImportedSteamGame = { game: GameSummary; addedAt: number; origin: "store" | "profile" | "manual" };
export type SteamImports = { version: 1; games: ImportedSteamGame[]; excluded?: number[] };
export type SteamImportExclusionChange = { add: number[]; remove: number[] };
export const emptySteamImports = (): SteamImports => ({ version: 1, games: [] });
export const steamImportsKey = (profile: string) => `harbor.games.steam-imports.v1:${encodeURIComponent(profile)}`;
export const STEAM_IMPORTS_CHANGED = "harbor:steam-imports-changed";
const MAX_BYTES = 4 * 1024 * 1024;

export function parseSteamImports(raw: string | null): SteamImports {
  if (raw === null) return emptySteamImports();
  if (raw.length > MAX_BYTES) throw Error("steam_import_limit");
  let value: SteamImports; try { value = JSON.parse(raw); } catch { throw Error("steam_import_read"); }
  if (value?.version !== 1 || !Array.isArray(value.games)) throw Error("steam_import_read");
  if (value.games.length > STEAM_IMPORT_LIMIT) throw Error("steam_import_limit");
  const excluded = value.excluded ?? [];
  if (!Array.isArray(excluded) || excluded.some(id => !validSteamImportId(id)) || new Set(excluded).size !== excluded.length) throw Error("steam_import_read");
  if (excluded.length > STEAM_IMPORT_LIMIT) throw Error("steam_import_limit");
  const ids = new Set<number>();
  const games = value.games.map(item => {
    const game = item?.game;
    if (!game || !validSteamImportId(game.steamId!) || game.id !== `steam:${game.steamId}` || ids.has(game.steamId!) || typeof game.name !== "string" || typeof game.capsule !== "string" || !Array.isArray(game.platforms) || !["store", "profile", "manual"].includes(item.origin) || !Number.isSafeInteger(item.addedAt) || item.addedAt <= 0) throw Error("steam_import_read");
    ids.add(game.steamId!);
    return { game: steamImportSummary(game.steamId!, game.name, game.capsule, game.platforms), addedAt: item.addedAt, origin: item.origin };
  });
  return { version: 1, games, ...(excluded.length ? { excluded: [...excluded].sort((a,b) => a-b) } : {}) };
}
export const readSteamImports = (profile: string) => parseSteamImports(localStorage.getItem(steamImportsKey(profile)));
const writes = new Map<string, Promise<unknown>>();
export function changeSteamImports(profile: string, add: ImportedSteamGame[], remove: number[] = [], signal?: AbortSignal, exclusions?: SteamImportExclusionChange): Promise<{ data: SteamImports; added: number }> {
  const key = steamImportsKey(profile);
  const commit = () => {
    signal?.throwIfAborted();
    const current = readSteamImports(profile), additions = parseSteamImports(JSON.stringify({ version: 1, games: add })).games;
    if (remove.some(id => !validSteamImportId(id))) throw Error("steam_import_record");
    const excluded = new Set(current.excluded ?? []);
    if (exclusions) {
      if (exclusions.add.length > STEAM_IMPORT_LIMIT || exclusions.remove.length > STEAM_IMPORT_LIMIT || [...exclusions.add,...exclusions.remove].some(id => !validSteamImportId(id))) throw Error("steam_import_record");
      for (const id of exclusions.remove) excluded.delete(id);
      for (const id of exclusions.add) excluded.add(id);
    }
    const games = current.games.filter(item => !remove.includes(item.game.steamId!)), ids = new Set(games.map(item => item.game.steamId)); let added = 0;
    for (const item of additions) if (!ids.has(item.game.steamId) && !excluded.has(item.game.steamId!)) { games.push(item); ids.add(item.game.steamId); added++; }
    const data = parseSteamImports(JSON.stringify({ version: 1, games, ...(excluded.size ? {excluded:[...excluded]} : {}) })), raw = JSON.stringify(data);
    if (new TextEncoder().encode(raw).length > MAX_BYTES) throw Error("steam_import_limit");
    signal?.throwIfAborted(); localStorage.setItem(key, raw);
    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STEAM_IMPORTS_CHANGED, { detail: profile }));
    return { data, added };
  };
  const pending = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(() => typeof navigator !== "undefined" && navigator.locks ? navigator.locks.request(key, { signal }, commit) : commit());
  writes.set(key, pending); void pending.finally(() => { if (writes.get(key) === pending) writes.delete(key); }).catch(() => {}); return pending;
}
