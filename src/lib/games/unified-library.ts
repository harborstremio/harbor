import { quickLibrary, type QuickGame } from "./quick-library";
import { steamOwnedSummary, type SteamAccountSnapshot, type SteamOwnedGame } from "./steam-account";
import type { SteamInstall } from "./installed";
import type { CustomGame } from "./custom-library";
import { customLaunchHealth, type CustomLaunchHealthMap } from "./custom-launch-health";
import type { EmulationStore } from "./emulation";
import { LAUNCHER_NAMES, type GameLauncher, type LauncherScan } from "./launchers";
import type { LibraryPreferences, LibraryVisibility } from "./library-preferences";
import type { GameSummary } from "./types";
import type { SteamShortcut } from "./steam-shortcuts";
import type { LibrarySelectionChange } from "./library-selection";
import { compareLibraryPlaytime, libraryPlaytime, matchesLibraryPlaytime, type LibraryPlaytimeFilter } from "./library-playtime";
import { matchesLibraryStatus, type LibraryPlayStatus, type LibraryStatusFilter } from "./library-status";
import { matchesLibraryDrive } from "./library-drives";
import type { ImportedSteamGame } from "./steam-imports";
import { libraryTitle } from "./library-titles";
import { libraryMetadataPresentation } from "./library-metadata";
import { libraryShuffleRank } from "./library-shuffle";

export type UnifiedSource = "steam" | "shortcut" | "custom" | "retro" | GameLauncher;
export const UNIFIED_SOURCES: readonly UnifiedSource[] = ["steam", "shortcut", ...Object.keys(LAUNCHER_NAMES) as GameLauncher[], "custom", "retro"];
export type UnifiedState = "ready" | "client" | "notInstalled" | "updating" | "unavailable" | "setup" | "unknown";
export type UnifiedLibraryGame = {
  id: string; name: string; originalName?: string; game?: GameSummary; source: UnifiedSource;
  quick?: QuickGame; owned?: SteamOwnedGame; favorite: boolean; hidden: boolean;
  lastPlayed: number; addedAt?: number; state: UnifiedState; playStatus?: LibraryPlayStatus; imported?: ImportedSteamGame;
};
export type UnifiedLibraryInput = {
  installed: SteamInstall[]; steamKnown: boolean; steamComplete?: boolean; account?: SteamAccountSnapshot | null;
  custom: CustomGame[]; customHealth?: CustomLaunchHealthMap; retro: EmulationStore; launchers?: LauncherScan | null;
  launchersKnown: boolean; preferences: LibraryPreferences;
  shortcuts?: SteamShortcut[];
  steamImports?: ImportedSteamGame[];
};

/** Preserve installation/edition identities. Only the same Steam app merges with account ownership. */
export function unifiedLibrary(input: UnifiedLibraryInput, now = Date.now()): UnifiedLibraryGame[] {
  const timestamp = (value: number) => Number.isFinite(value) && value > 0 && value <= now ? value : 0;
  const items = quickLibrary(input.installed, input.custom, input.retro, [], input.preferences, input.launchers, {includeHidden:true,customHealth:input.customHealth,shortcuts:input.shortcuts}).map((quick): UnifiedLibraryGame => {
    let state: UnifiedState = quick.ready ? "ready" : "setup";
    if (quick.source === "shortcut") state = quick.shortcut.state === "missing" ? "unavailable" : quick.ready ? "ready" : "setup";
    if (quick.source === "custom") { const health = customLaunchHealth(quick.custom, input.customHealth); state = quick.custom.launchPending&&!quick.custom.hydra?.original.executable ? "notInstalled" : health?.state === "ready" ? "ready" : health?.state === "attention" ? "setup" : "unknown"; }
    if (quick.source === "steam") state = !input.steamKnown ? "unknown" : quick.install.state === "missing" ? "unavailable" : quick.install.state === "updating" ? "updating" : "ready";
    if (quick.source === "retro" && !quick.local.available) state = "unavailable";
    if (quick.source === "launcher") state = !input.launchersKnown || quick.install.state === "unknown" ? "unknown" : quick.install.state === "notInstalled" ? "notInstalled" : quick.install.state === "missing" ? "unavailable" : quick.ready ? quick.install.launchMode === "client" ? "client" : "ready" : "setup";
    return {id:quick.id,name:quick.name,game:quick.game,quick,source:quick.source === "launcher" ? quick.install.launcher : quick.source as UnifiedSource,
      favorite:quick.favorite,hidden:quick.source === "custom" ? quick.custom.hidden : !!input.preferences.entries[quick.id]?.hidden,lastPlayed:timestamp(quick.lastPlayed),addedAt:quick.source === "custom" ? timestamp(quick.custom.addedAt) : undefined,state};
  });
  const installed = new Map(items.filter(item=>item.source === "steam").map(item=>[item.id,item]));
  if (input.account?.libraryVisible) for (const owned of input.account.games) {
    const summary = steamOwnedSummary(owned), existing = installed.get(summary.id);
    const lastPlayed = owned.minutes > 0 ? timestamp(owned.lastPlayed * 1000) : 0;
    if (existing) { existing.owned=owned; existing.lastPlayed=Math.max(existing.lastPlayed,lastPlayed); continue; }
    const entry: UnifiedLibraryGame = {id:summary.id,name:summary.name,game:summary,source:"steam",owned,favorite:!!input.preferences.entries[summary.id]?.pinned,
      hidden:!!input.preferences.entries[summary.id]?.hidden,lastPlayed,state:input.steamKnown && input.steamComplete !== false ? "notInstalled" : "unknown"};
    items.push(entry); installed.set(entry.id,entry);
  }
  for (const imported of input.steamImports ?? []) {
    const existing = installed.get(imported.game.id);
    if (existing) { existing.imported = imported; continue; }
    const entry: UnifiedLibraryGame = { id: imported.game.id, name: imported.game.name, game: imported.game, source: "steam", imported,
      favorite: !!input.preferences.entries[imported.game.id]?.pinned, hidden: !!input.preferences.entries[imported.game.id]?.hidden,
      lastPlayed: 0, addedAt: timestamp(imported.addedAt), state: input.steamKnown && input.steamComplete !== false ? "notInstalled" : "unknown" };
    items.push(entry); installed.set(entry.id, entry);
  }
  return items.map(item=>{
    const original = item.quick?.originalName ?? item.name;
    const name = libraryTitle(item.id,original,input.preferences.entries[item.id],input.preferences.titleRules);
    return {...item,name,...(item.game?{game:libraryMetadataPresentation(item.game,input.preferences.entries[item.id]?.metadata,item.id)}:{}),...(name !== original ? {originalName:original} : {}),playStatus:input.preferences.entries[item.id]?.playStatus??"unset"};
  });
}

export type UnifiedLibraryFilters = { query:string; source:"all"|UnifiedSource; availability:"all"|"ready"|"notInstalled"|"attention"; visibility:LibraryVisibility; playtime?:LibraryPlaytimeFilter; playStatus?:LibraryStatusFilter; drive?:string; shuffleSeed?:number; sort:"recent"|"name"|"leastTime"|"mostTime"|"shuffle" };
export const unifiedLibraryDefaults = (): UnifiedLibraryFilters => ({query:"",source:"all",availability:"all",visibility:"visible",playtime:"all",playStatus:"all",drive:"all",sort:"recent"});
export const normalizeLibraryQuery = (value:string) => value.trim().normalize("NFKD").replace(/\p{M}/gu,"").toLocaleLowerCase();
export function filterUnifiedLibrary(games: UnifiedLibraryGame[], filters: UnifiedLibraryFilters) {
  const query = normalizeLibraryQuery(filters.query);
  const times = new Map(games.map(game => [game.id, libraryPlaytime(game)]));
  const ranks = filters.sort === "shuffle" ? new Map(games.map(game => [game.id, libraryShuffleRank(game.id, filters.shuffleSeed ?? 0)])) : null;
  return games.filter(game => (filters.visibility === "hidden" ? game.hidden : !game.hidden && (filters.visibility !== "pinned" || game.favorite))
    && (filters.source === "all" || filters.source === game.source)
    && (filters.availability === "all" || (filters.availability === "attention" ? ["updating","unavailable","setup","unknown"].includes(game.state) : game.state === filters.availability))
    && matchesLibraryPlaytime(times.get(game.id), filters.playtime)
    && matchesLibraryStatus(game.playStatus, filters.playStatus)
    && matchesLibraryDrive(game, filters.drive)
    && (!query || normalizeLibraryQuery(`${game.name} ${game.originalName??""} ${game.game?.name??""}`).includes(query)))
    .sort((a,b)=>ranks ? ranks.get(a.id)! - ranks.get(b.id)! || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0) : (filters.sort === "leastTime" || filters.sort === "mostTime" ? compareLibraryPlaytime(times.get(a.id),times.get(b.id),filters.sort === "mostTime") : 0)
      || Number(b.favorite)-Number(a.favorite) || (filters.sort === "recent" ? Math.max(b.lastPlayed,b.addedAt??0)-Math.max(a.lastPlayed,a.addedAt??0) : 0) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
export function pickUnifiedGame(games: UnifiedLibraryGame[], previous?:string, random=Math.random): UnifiedLibraryGame | undefined {
  const eligible = games.filter(game=>!!game.game || !!game.quick), pool = eligible.length > 1 ? eligible.filter(game=>game.id !== previous) : eligible;
  return pool[Math.max(0,Math.min(pool.length-1,Math.floor(random()*pool.length)))];
}

/** Each existing profile store commits independently; report exact successes for a safe retry. */
export async function changeUnifiedLibrarySelection(games: UnifiedLibraryGame[], ids: string[], patch: LibrarySelectionChange, stores: {
  preferences: (ids: string[], patch: LibrarySelectionChange) => Promise<boolean>;
  custom: (ids: string[], patch: LibrarySelectionChange) => Promise<boolean>;
}): Promise<{ completed: string[] }> {
  const byId = new Map(games.map(game => [game.id, game]));
  const selected: UnifiedLibraryGame[] = [];
  // A removed installation must not turn a partial selection into an apparent full success.
  for (const id of new Set(ids)) { const game = byId.get(id); if (!game) return { completed: [] }; selected.push(game); }
  const custom = selected.filter(game => game.quick?.source === "custom");
  const preferences = selected.filter(game => game.quick?.source !== "custom");
  const groups = [
    { games: preferences, write: () => stores.preferences(preferences.map(game => game.id), patch) },
    { games: custom, write: () => stores.custom(custom.flatMap(game => game.quick?.source === "custom" ? [game.quick.custom.id] : []), patch) },
  ];
  const completed: string[] = [];
  for (const group of groups) {
    if (!group.games.length) continue;
    try { if (await group.write()) completed.push(...group.games.map(game => game.id)); }
    catch { /* Leave this store's games selected; the caller reports the incomplete write. */ }
  }
  return { completed };
}
