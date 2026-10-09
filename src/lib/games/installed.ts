import type { GameSummary } from "./types";

export const STEAM_UPDATE_STATES = ["none", "queued", "downloading", "paused", "validating", "repair", "uninstalling"] as const;
export type SteamUpdateState = typeof STEAM_UPDATE_STATES[number];

export type SteamInstall = {
  appId: number;
  name: string;
  installPath: string;
  libraryPath: string;
  sizeBytes: number;
  lastPlayed: number;
  state: "installed" | "updating" | "missing";
  update?: SteamUpdateState;
  bytesToDownload?: number;
  bytesDownloaded?: number;
  artwork?: { capsule?: string; portrait?: string; libraryHero?: string; logo?: string };
};
export type SteamLibraryScan = {
  steamFound: boolean;
  libraries: { path: string; available: boolean; appCount: number }[];
  games: SteamInstall[];
  warnings: string[];
};
export type LibrarySort = "recent" | "name" | "size";

export function installedSummary(game: SteamInstall): GameSummary {
  return { id: `steam:${game.appId}`, steamId: game.appId, name: game.name, capsule: game.artwork?.capsule || `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${game.appId}/header.jpg`, ...(game.artwork?.portrait ? { portrait: game.artwork.portrait } : {}), platforms: [] };
}

export function filterInstalled(games: SteamInstall[], query: string, state: string, library: string, sort: LibrarySort): SteamInstall[] {
  const needle = query.trim().toLocaleLowerCase();
  return games.filter(game => (!needle || game.name.toLocaleLowerCase().includes(needle)) && (state === "all" || game.state === state) && (library === "all" || game.libraryPath === library))
    .sort((a, b) => (sort === "recent" ? b.lastPlayed - a.lastPlayed : sort === "size" ? b.sizeBytes - a.sizeBytes : 0) || a.name.localeCompare(b.name));
}

export function libraryName(path: string): string {
  return path.replace(/^\\\\\?\\/, "").replace(/[\\/]+$/, "");
}

export function gameSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const unit = bytes >= 1024 ** 3 ? "GB" : "MB";
  return `${new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(bytes / (unit === "GB" ? 1024 ** 3 : 1024 ** 2))} ${unit}`;
}
