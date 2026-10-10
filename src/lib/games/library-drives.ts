import type { UnifiedLibraryGame } from "./unified-library";

export type LibraryDrive = { id: string; label: string };

/** A location from the recorded Windows path, not a claim about disk availability. */
export function pathDrive(value: string | null | undefined): LibraryDrive | undefined {
  if (!value || /[\x00-\x1f]/.test(value)) return;
  let path = value.trim();
  if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
  path = path.replaceAll("/", "\\");
  if (/^\\\\\?\\UNC\\/i.test(path)) path = `\\\\${path.slice(8)}`;
  else if (/^\\\\\?\\[a-z]:\\/i.test(path)) path = path.slice(4);
  const letter = /^([a-z]):\\/i.exec(path)?.[1];
  if (letter) return { id: `${letter.toUpperCase()}:`, label: `${letter.toUpperCase()}:\\` };
  const share = /^\\\\([^\\]+)\\([^\\]+)(?:\\|$)/.exec(path);
  if (!share || [share[1], share[2]].some(part => /^[.?]+$/.test(part) || /[":<>|*?]/.test(part))) return;
  const root = `\\\\${share[1]}\\${share[2]}`;
  return { id: root.toLocaleLowerCase("en-US"), label: root };
}

export function installationDrive(game: UnifiedLibraryGame): LibraryDrive | undefined {
  const item = game.quick;
  if (!item) return;
  if (item.source === "steam" || item.source === "launcher") return pathDrive(item.install.installPath);
  if (item.source === "retro") return pathDrive(item.local.path);
  if (item.source === "custom") return pathDrive(item.custom.config.executable);
  if (item.source === "shortcut") return pathDrive(item.shortcut.startDirectory) ?? pathDrive(item.shortcut.executable);
}

export function libraryDrives(games: UnifiedLibraryGame[], selected = "all"): LibraryDrive[] {
  const drives = new Map<string, LibraryDrive>();
  for (const game of games) { const drive = installationDrive(game); if (drive && !drives.has(drive.id)) drives.set(drive.id, drive); }
  // Keep a selected disconnected/removed drive available so filters never silently broaden.
  const held = pathDrive(selected.endsWith(":") ? `${selected}\\` : selected);
  if (held && !drives.has(held.id)) drives.set(held.id, held);
  return [...drives.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function matchesLibraryDrive(game: UnifiedLibraryGame, selected = "all") {
  if (selected === "all") return true;
  const drive = installationDrive(game);
  return selected === "unassigned" ? !drive : drive?.id === selected;
}
