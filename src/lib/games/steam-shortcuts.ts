export type SteamShortcut = {
  id: string; accountId: number; appId: number | null; runGameId: string | null; name: string;
  executable: string; startDirectory: string; launchOptions: string; hidden: boolean;
  lastPlayed: number; tags: string[]; state: "ready" | "missing" | "account" | "local";
  artwork: { capsule?: string; portrait?: string; hero?: string; icon?: string };
  iconKey?: string | null;
};
export type SteamShortcutScan = { steamFound: boolean; activeAccountId: number | null; accounts: number[]; games: SteamShortcut[]; warnings: string[]; directLaunch?: boolean };
export type SteamShortcutSettings = { root: string | null; accountId: number | null };
export const steamShortcutKey = (profile: string) => `harbor.games.steam-shortcuts.v1:${encodeURIComponent(profile)}`;
export function isSteamShortcutId(value: string) {
  const found = /^steam-shortcut:([1-9]\d{0,9}):([1-9]\d{0,9}|local-[0-9a-f]{22})$/.exec(value);
  return !!found && Number(found[1]) <= 0xffff_ffff && (found[2].startsWith("local-") || Number(found[2]) >= 0x8000_0000 && Number(found[2]) <= 0xffff_ffff);
}
export function readSteamShortcutSettings(profile: string): SteamShortcutSettings {
  try {
    const value = JSON.parse(localStorage.getItem(steamShortcutKey(profile)) || "null");
    if (value && (value.root === null || typeof value.root === "string" && value.root.length <= 4096 && /^(?:[a-z]:[\\/]|[\\/])/i.test(value.root) && !/[\x00-\x1f]/.test(value.root))
      && (value.accountId === null || Number.isInteger(value.accountId) && value.accountId > 0 && value.accountId <= 0xffff_ffff)) return {root:value.root,accountId:value.accountId};
  } catch { /* A missing/corrupt preference uses Steam's own install location. */ }
  return {root:null,accountId:null};
}
export function selectedShortcutAccount(scan: SteamShortcutScan | null, settings: SteamShortcutSettings): number | null {
  // Keep an explicit account selected even if a later scan fails or its file disappears.
  return settings.accountId ?? (scan?.activeAccountId && scan.accounts.includes(scan.activeAccountId) ? scan.activeAccountId : scan?.accounts[0]) ?? null;
}
export function steamShortcutGames(scan: SteamShortcutScan | null, settings: SteamShortcutSettings): SteamShortcut[] {
  const selected = selectedShortcutAccount(scan, settings);
  return scan?.games.filter(game => game.accountId === selected) ?? [];
}
export const shortcutError = (value: unknown) => {
  const code = value instanceof Error ? value.message : String(value);
  return `games.shortcuts.${["shortcut_location","shortcut_account","shortcut_missing","shortcut_executable","shortcut_launch","shortcut_changed","shortcut_options","shortcut_identity"].includes(code) ? code : "shortcut_read"}`;
};
