import type { CustomGame } from "./custom-library";
import type { SteamInstall } from "./installed";
import { launcherGameSummary, type LauncherGame } from "./launchers";

export type SimsCustomLaunch = { executable: string; arguments: string[] };
export type SimsInstallation = { key: string; path: string; sources: ("steam" | "ea" | "custom")[]; custom: SimsCustomLaunch[] };

// This only identifies a candidate. The native pack reader validates the folder
// and its files after selection; a launcher record is not pack-file evidence.
function windowsFolder(value: string): string | undefined {
  if (!value || value.length > 4096) return;
  const path = value.replaceAll("/", "\\").replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "").replace(/\\+$/, "");
  const drive = /^[a-z]:\\/i.test(path), unc = /^\\\\[^\\]+\\[^\\]+\\/.test(path);
  if (!drive && !unc) return;
  const parts = path.slice(drive ? 3 : 2).split("\\");
  if (parts.some(part => !part || part === "." || part === ".." || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part))) return;
  return path;
}

export const simsInstallationKey = (path: string) => windowsFolder(path)?.toLowerCase();

/** Reuse Harbor's existing scans; never scan drives or join games by title. */
export function simsInstallations(steam: SteamInstall[], launchers: LauncherGame[], custom: CustomGame[]): SimsInstallation[] {
  const entries = new Map<string, SimsInstallation>();
  const add = (value: string, source: SimsInstallation["sources"][number]) => {
    const path = windowsFolder(value);
    if (!path) return;
    const key = path.toLowerCase(), previous = entries.get(key);
    if (previous) { if (!previous.sources.includes(source)) previous.sources.push(source); }
    else entries.set(key, { key, path, sources: [source], custom: [] });
  };
  for (const game of steam) {
    if (game.appId === 1222670 && game.state === "installed" && (!game.update || game.update === "none")) add(game.installPath, "steam");
  }
  for (const game of launchers) {
    if (game.launcher === "ea" && game.state === "installed" && launcherGameSummary(game).igdbId === 3212) add(game.installPath, "ea");
  }
  for (const game of custom) {
    const linked = game.linked;
    if (game.hidden || game.config.mode !== "native" || !linked || (linked.steamId ? linked.steamId !== 1222670 : linked.igdbId !== 3212)) continue;
    const executable = windowsFolder(game.config.executable);
    const root = executable?.match(/^(.*)\\Game\\Bin\\(?:TS4_x64|TS4_DX9_x64|TS4_x64_fpb)\.exe$/i)?.[1];
    if (root) {
      add(root, "custom");
      entries.get(simsInstallationKey(root) ?? "")?.custom.push({ executable: game.config.executable, arguments: [...game.config.arguments] });
    }
  }
  return [...entries.values()];
}
