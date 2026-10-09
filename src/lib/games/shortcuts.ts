export type GameShortcutTarget = "desktop" | "startMenu";
export type GameShortcuts = { desktop: string | null; startMenu: string | null };

export function shortcutError(reason: unknown) {
  const code = String(reason);
  return `games.setupShortcuts.${code === "shortcut_exists" ? "exists" : code.startsWith("launch_") ? "missing" : code === "shortcut_platform" ? "unsupported" : "error"}`;
}
