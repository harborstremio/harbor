export type SaveFolders = { version: 1; source: string; vault: string };
export type SaveSnapshot = { id: string; gameName: string; label: string; createdAt: number; sourcePath: string; kind: "manual" | "beforeRestore"; fileCount: number; bytes: number };
export type SaveProgress = { profile: string; operationId: string; phase: "scanning" | "copying" | "verifying" | "restoring"; files: number; totalFiles: number; bytes: number; totalBytes: number };
export type SaveRestorePlan = { token: string; snapshot: SaveSnapshot; target: string; changes: { path: string; status: "add" | "replace" | "remove"; directory: boolean; currentBytes: number | null; snapshotBytes: number | null }[]; unchanged: number; added: number; replaced: number; removed: number };
export type SaveRestoreReceipt = { status: "restored" | "rolledBack" | "recoveryNeeded" | "notRestored" | "keptCurrent"; target: string; recoverySnapshotId: string | null; recoveryFolder: string | null; files: number; bytes: number };
export type SaveRestoreChange = SaveRestorePlan["changes"][number];
export type SaveChangeFilter = "all" | SaveRestoreChange["status"];

export function filterSaveChanges(changes: readonly SaveRestoreChange[], query: string, filter: SaveChangeFilter) {
  const search = query.trim().normalize("NFC").toLocaleLowerCase().replace(/\\/g, "/");
  return changes.filter(change => (filter === "all" || change.status === filter)
    && change.path.normalize("NFC").toLocaleLowerCase().replace(/\\/g, "/").includes(search));
}

// Missing files and empty files are different. Directory entries have no byte sizes.
export function saveChangeSide(change: SaveRestoreChange, side: "current" | "snapshot"):
  { kind: "absent" | "folder" | "unknown" } | { kind: "file"; bytes: number } {
  if ((side === "current" && change.status === "add") || (side === "snapshot" && change.status === "remove")) return { kind: "absent" };
  if (change.directory) return { kind: "folder" };
  const bytes = side === "current" ? change.currentBytes : change.snapshotBytes;
  return bytes !== null && Number.isSafeInteger(bytes) && bytes >= 0 ? { kind: "file", bytes } : { kind: "unknown" };
}
export const saveDisplayPath = (path: string) => path.replace(/^\\\\\?\\UNC\\/, "\\\\").replace(/^\\\\\?\\/, "");
export const saveFoldersKey = (profile: string, game: string) => `harbor.games.save-folders.v1.${encodeURIComponent(profile)}.${encodeURIComponent(game)}`;
export function parseSaveFolders(raw: string | null): SaveFolders {
  if (!raw) return { version: 1, source: "", vault: "" };
  try {
    if (raw.length > 20000) throw Error();
    const value = JSON.parse(raw);
    if (value?.version !== 1 || [value.source, value.vault].some(path => typeof path !== "string" || path.length > 4096 || path.includes("\0"))) throw Error();
    return { version: 1, source: value.source, vault: value.vault };
  } catch { throw Error("save_config"); }
}
export const readSaveFolders = (profile: string, game: string) => parseSaveFolders(localStorage.getItem(saveFoldersKey(profile, game)));
export function writeSaveFolders(profile: string, game: string, folders: SaveFolders) {
  const value = JSON.stringify(parseSaveFolders(JSON.stringify(folders)));
  try { localStorage.setItem(saveFoldersKey(profile, game), value); } catch { throw Error("save_config_write"); }
}
const errors = new Set(["save_recovery", "save_recovery_scope", "save_folder", "save_links", "save_record", "save_read", "save_write", "save_name", "save_changed", "save_canceled", "save_empty", "save_busy", "save_limit", "save_nested", "save_integrity", "save_expired", "save_space", "save_config", "save_config_write"]);
export const saveErrorKey = (error: unknown) => {
  const code = error instanceof Error ? error.message : String(error);
  return `games.backups.${errors.has(code) ? code : "failed"}`;
};
