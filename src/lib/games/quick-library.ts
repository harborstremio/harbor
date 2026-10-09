import { embeddedCore } from "./embedded-emulation";
import { customActivityAt, type CustomGame } from "./custom-library";
import { customLaunchHealth, type CustomLaunchHealthMap } from "./custom-launch-health";
import { localGames, type EmulationStore } from "./emulation";
import { installedSummary, type SteamInstall } from "./installed";
import { romPreferenceId, type LibraryPreferences } from "./library-preferences";
import type { GameSummary } from "./types";
import type { SteamShortcut } from "./steam-shortcuts";
import { canLaunchGame, launcherGameSummary, type LauncherGame, type LauncherScan } from "./launchers";
import { libraryTitle } from "./library-titles";
import { libraryMetadataPresentation } from "./library-metadata";

export type QuickGame = { id: string; name: string; originalName?: string; art?: string; game?: GameSummary; favorite: boolean; lastPlayed: number; ready: boolean } & (
  { source: "steam"; install: SteamInstall } | { source: "shortcut"; shortcut: SteamShortcut } | { source: "custom"; custom: CustomGame } |
  { source: "retro"; local: ReturnType<typeof localGames>[number] } | { source: "saved" } | { source: "launcher"; install: LauncherGame }
);
export function quickLibrary(installed: SteamInstall[], custom: CustomGame[], retro: EmulationStore, saved: GameSummary[], preferences: LibraryPreferences, launchers?: LauncherScan | null, options: { includeHidden?: boolean; customHealth?: CustomLaunchHealthMap; shortcuts?: SteamShortcut[] } = {}): QuickGame[] {
  const items: QuickGame[] = [];
  const savedIds = new Set(saved.map(game => game.id));
  const seen = new Set<string>();
  const preference = (id: string) => preferences.entries[id];
  for (const shortcut of options.shortcuts ?? []) {
    if (seen.has(shortcut.id)) continue;
    seen.add(shortcut.id);
    if (options.includeHidden || !preference(shortcut.id)?.hidden) items.push({id:shortcut.id,name:shortcut.name,art:shortcut.artwork.capsule || shortcut.artwork.portrait || shortcut.artwork.icon,favorite:!!preference(shortcut.id)?.pinned,lastPlayed:shortcut.lastPlayed*1000,ready:shortcut.state==="ready",source:"shortcut",shortcut});
  }
  for (const install of installed) {
    const game = installedSummary(install); seen.add(game.id);
    if (options.includeHidden || !preference(game.id)?.hidden) items.push({ id: game.id, name: game.name, art: game.capsule, game, favorite: !!preference(game.id)?.pinned, lastPlayed: install.lastPlayed * 1000, ready: install.state === "installed", source: "steam", install });
  }
  for (const install of launchers?.games ?? []) {
    const game = launcherGameSummary(install); seen.add(game.id);
    if (game.igdbId) seen.add(`igdb:${game.igdbId}`);
    if (options.includeHidden || !preference(game.id)?.hidden) items.push({ id: game.id, name: game.name, art: game.portrait || game.capsule, game, favorite: !!preference(game.id)?.pinned, lastPlayed: install.activity?.lastPlayed ?? 0, ready: canLaunchGame(install, launchers!), source: "launcher", install });
  }
  for (const game of custom) {
    if (game.linked) seen.add(game.linked.id);
    if (options.includeHidden || !game.hidden) items.push({ id: `custom:${game.id}`, name: game.name, art: game.linked?.capsule, game: game.linked ?? undefined, favorite: game.pinned, lastPlayed: game.lastPlayed, ready: customLaunchHealth(game, options.customHealth)?.state === "ready", source: "custom", custom: game });
  }
  for (const local of localGames(retro)) {
    const id = romPreferenceId(local.system, local.path);
    if (local.linked) seen.add(local.linked.id);
    if (options.includeHidden || !preference(id)?.hidden) items.push({ id, name: local.linked?.name ?? local.name, art: local.linked?.capsule, game: local.linked, favorite: !!preference(id)?.pinned, lastPlayed: retro.lastPlayed[local.path] ?? 0, ready: local.available && (!!embeddedCore(local.system) && local.format.toUpperCase() !== "FDS" || !!retro.profiles[local.system]), source: "retro", local });
  }
  for (const game of saved) if (!seen.has(game.id) && (options.includeHidden || !preference(game.id)?.hidden)) items.push({ id: game.id, name: game.name, art: game.capsule, game, favorite: !!preference(game.id)?.pinned, lastPlayed: 0, ready: false, source: "saved" });
  return items.map(item => {
    const name = libraryTitle(item.id,item.name,preferences.entries[item.id],preferences.titleRules);
    const match=preferences.entries[item.id]?.metadata;
    const identity=match&&["custom","retro","shortcut"].includes(item.source)?{id:item.id,name:item.name,capsule:"",platforms:[]}:item.game;
    const game = match && identity ? libraryMetadataPresentation(identity,match,item.id) : item.game;
    const favorite = item.favorite || savedIds.has(item.id) || !!game && (savedIds.has(game.id) || item.source === "launcher" && !!game.igdbId && savedIds.has(`igdb:${game.igdbId}`));
    return {...item,name,favorite,...(name!==item.name?{originalName:item.name}:{}),...(match&&game?{game,art:match.portrait||match.capsule}: {})};
  });
}

/** Keep existing library hearts and catalog favorites together without migrating profile data. */
export function libraryFavoriteGames(saved: GameSummary[], library: QuickGame[]): GameSummary[] {
  const games = new Map(saved.map(game => [game.id, game]));
  for (const item of library) if (item.favorite && item.game && !games.has(item.game.id) && !(item.source === "launcher" && item.game.igdbId && games.has(`igdb:${item.game.igdbId}`))) games.set(item.game.id, item.game);
  return [...games.values()];
}
/** A launcher's explicit catalog alias can be saved before its local installation is discovered. */
export function libraryFavoriteKeys(game: GameSummary, library: QuickGame[]): Set<string> {
  const ids = new Set([game.id]);
  for (const item of library) if (item.source === "launcher" && item.game?.igdbId && (item.id === game.id || `igdb:${item.game.igdbId}` === game.id)) {
    ids.add(item.game.id); ids.add(`igdb:${item.game.igdbId}`);
  }
  return ids;
}
export type QuickFilters = { query: string; group: "all" | "favorites" | "recent"; source: "all" | QuickGame["source"]; ready: boolean; sort: "recent" | "name" };
export function quickGameActivityAt(game: QuickGame, now = Date.now()) {
  return game.source === "custom" ? customActivityAt(game.custom, now) : Number.isFinite(game.lastPlayed) && game.lastPlayed > 0 && game.lastPlayed <= now ? game.lastPlayed : 0;
}
export function filterQuickLibrary(games: QuickGame[], filters: QuickFilters) {
  const query = filters.query.trim().toLocaleLowerCase(), now = Date.now();
  const activity = (game: QuickGame) => quickGameActivityAt(game, now);
  return games.filter(game => (!query || `${game.name} ${game.originalName??""}`.toLocaleLowerCase().includes(query)) && (filters.group !== "favorites" || game.favorite) && (filters.group !== "recent" || activity(game) > 0) && (filters.source === "all" || game.source === filters.source) && (!filters.ready || game.ready))
    .sort((a, b) => filters.sort === "name" ? a.name.localeCompare(b.name) : Number(b.favorite) - Number(a.favorite) || activity(b) - activity(a) || a.name.localeCompare(b.name));
}
