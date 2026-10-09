import type { GameSummary } from "./types";
import type { SteamInstall } from "./installed";

export type SteamOwnedGame = { appId: number; name: string; minutes: number; recentMinutes: number; lastPlayed: number };
export type SteamAccountSnapshot = { steamId: string; name: string; avatar: string; games: SteamOwnedGame[]; libraryVisible: boolean; updatedAt: number };
export type SteamAccountStatus = { connected: boolean; remembered: boolean; snapshot: SteamAccountSnapshot | null };
export type SteamAchievement = { id: string; name: string; description: string; icon: string; lockedIcon: string; hidden: boolean; unlocked: boolean; unlockedAt: number };
export type SteamAchievements = { steamId: string; appId: number; items: SteamAchievement[]; updatedAt: number };

export function steamOwnedSummary(game: SteamOwnedGame): GameSummary {
  return { id: `steam:${game.appId}`, steamId: game.appId, name: game.name, capsule: `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`, platforms: [] };
}
export type OwnedInstallation = "all" | "installed" | "updating" | "uninstalled";
export type OwnedActivity = "all" | "unplayed" | "recent" | "returning";
export type OwnedSort = "recent" | "name" | "time" | "leastTime";
export type OwnedLibraryFilters = { query: string; installation: OwnedInstallation; activity: OwnedActivity; sort: OwnedSort };

export function filterSteamOwned(games: SteamOwnedGame[], installs: SteamInstall[] | null, filters: OwnedLibraryFilters, now = Date.now() / 1000): SteamOwnedGame[] {
  const detected = new Map(installs?.map(game => [game.appId, game.state]));
  const needle = filters.query.trim().toLocaleLowerCase();
  const cutoff = now - 90 * 24 * 60 * 60;
  return games.filter(game => {
    if (needle && !game.name.toLocaleLowerCase().includes(needle)) return false;
    if (filters.installation !== "all") {
      // A failed scan is unknown, not evidence that every owned game is uninstalled.
      if (installs === null) return false;
      const state = detected.get(game.appId);
      if (filters.installation === "uninstalled" ? !!state && state !== "missing" : state !== filters.installation) return false;
    }
    return filters.activity === "unplayed" ? game.minutes === 0
      : filters.activity === "recent" ? game.recentMinutes > 0
      : filters.activity === "returning" ? game.minutes > 0 && game.lastPlayed > 0 && game.lastPlayed <= cutoff
      : true;
  }).sort((a, b) => (filters.sort === "recent" ? b.lastPlayed - a.lastPlayed
    : filters.sort === "time" ? b.minutes - a.minutes
    : filters.sort === "leastTime" ? a.minutes - b.minutes : 0) || a.name.localeCompare(b.name) || a.appId - b.appId);
}

/** Choose from the entire filtered pool, avoiding an immediate repeat when possible. */
export function pickSteamOwnedGame(games: SteamOwnedGame[], previous?: number, random = Math.random()): SteamOwnedGame | null {
  const unique = [...new Map(games.map(game => [game.appId, game])).values()];
  const candidates = unique.length > 1 ? unique.filter(game => game.appId !== previous) : unique;
  if (!candidates.length) return null;
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor((Number.isFinite(random) ? random : 0) * candidates.length)));
  return candidates[index];
}
export function steamAccountError(value: unknown): string {
  const code = typeof value === "string" ? value : "";
  return `games.account.${["steam_account_profile", "steam_account_store", "steam_account_limit", "steam_account_id", "steam_account_key", "steam_account_network", "steam_account_rate", "steam_account_response", "steam_account_busy", "steam_account_disconnected", "steam_achievements_private", "steam_account_no_client", "steam_account_install", "steam_account_not_owned"].includes(code) ? code : "steam_account_network"}`;
}
