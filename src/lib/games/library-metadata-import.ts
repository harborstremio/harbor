import type { UnifiedLibraryGame } from "./unified-library";
import type { LibraryPreferences } from "./library-preferences";
import { localSearchName, folderKey, localGames, parseLocalMatch, type EmulationStore } from "./emulation";
import { customLinkedGame, upsertCustomGame, type CustomLibrary } from "./custom-library";
import { launcherCatalogLookup } from "./launcher-catalog";
import type { MetadataImportTarget } from "./automatic-metadata";
import type { GameSummary } from "./types";

export function libraryMetadataTarget(item: UnifiedLibraryGame, preferences: LibraryPreferences, desktopPlatform?: number): MetadataImportTarget {
  const quick = item.quick, game = item.game;
  const name = item.originalName ?? item.name;
  const external = game?.steamId ? { source: 1, uid: String(game.steamId) } : game ? launcherCatalogLookup(game.id, game.catalogSteamId) : undefined;
  // An owned store game can target another OS. Its app identity is stronger than
  // the current computer's OS; ROM systems and explicit executables are local evidence.
  const executable = quick?.source === "custom" ? quick.custom.config.executable : "";
  const platform = quick?.source === "retro" ? quick.local.system : external ? undefined : /\.exe$/i.test(executable) ? 6 : /\.app\/?$/i.test(executable) ? 14 : desktopPlatform;
  const year = game?.releaseTimestamp ? new Date(game.releaseTimestamp * 1000).getUTCFullYear() : undefined;
  return { id: item.id, matched: !!preferences.entries[item.id]?.metadata || !!(quick?.source === "custom" && quick.custom.linked) || !!(quick?.source === "retro" && quick.local.linked),
    request: { name: quick?.source === "retro" ? localSearchName(name) : name, platforms: platform ? [platform] : [], ...(year ? { year } : {}), ...(game?.igdbId ? { igdbId: game.igdbId } : {}), ...(external ? { external } : {}) } };
}
/** Check inside the existing custom-library write lock, then preserve all launch data. */
export function importUnmatchedCustom(store: CustomLibrary, id: string, name: string, metadata: GameSummary) {
  const game = store.games.find(game => game.id === id), linked = customLinkedGame(metadata);
  if (!game || game.name !== name || game.linked || !linked) throw Error("metadata_import_conflict");
  return upsertCustomGame(store, { ...game, linked });
}
/** Use a freshly read store; removed ROMs and concurrent matches cannot be resurrected. */
export function importUnmatchedRom(store: EmulationStore, path: string, system: number, name: string, metadata: GameSummary) {
  const key = folderKey(path, system), game = localGames(store).find(game => folderKey(game.path, game.system) === key), linked = parseLocalMatch(metadata);
  if (!game || game.name !== name || game.linked || !linked) throw Error("metadata_import_conflict");
  return { ...store, matches: { ...store.matches, [key]: linked } };
}
