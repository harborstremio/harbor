import { invoke } from "@tauri-apps/api/core";
import { saveErrorKey, type SaveSnapshot } from "./saves";
import type { SimsPackReport, SimsPackSelection } from "./sims-packs";

export type SimsStamp = { name: string; bytes: number; hash: string };
export type SimsProgress = { profile: string; operationId: string; phase: "waiting" | "downloading" | "reviewing" | "checking" | "copying" | "publishing" | "done"; file: string | null; bytes: number; totalBytes: number; canCancel: boolean };
export type SimsFile = { path: string; bytes: number; kind: "package" | "script" | "settings"; scriptTooDeep: boolean };
export type SimsFolder = { path: string; gameVersion: string; modsEnabled: boolean | null; scriptsEnabled: boolean | null; resourceReady: boolean; files: SimsFile[]; partial: boolean; saveRecovery: boolean };
export type SimsCreatorSource = { provider: "mccc" | "lot51" | "mts"; project?: string; requiredCore?: string; version: string; gamePatch: string; archiveHash: string };
export const simsCreatorName = (source: SimsCreatorSource) => source.provider === "mts" ? "Mod The Sims" : source.provider === "lot51" ? "Lot 51" : "Deaderpool";
export type SimsCreatorItem = { title: string; creator: string; page: string | null; project: string | null; included: boolean | null };
export type SimsCreatorContent = { listed: boolean; partial: boolean; items: SimsCreatorItem[]; notes?: { partial: boolean; items: SimsCreatorItem[] } };
export type SimsMtsMetrics = { downloads?: number | null; favorites?: number | null; comments?: number | null; thanks?: number | null; views?: number | null; rounded?: Partial<Record<"downloads" | "favorites" | "comments" | "thanks" | "views", string>> };
export type SimsMtsDetail = { metrics?: SimsMtsMetrics; game?: 2 | 3 | 4; body?: string; gallery?: string[]; project: string; title: string; creator: string; description: string; image: string; page: string; packs: string[]; files: { version: string; name: string; supported: boolean }[]; content?: SimsCreatorContent };
export const simsMtsDetail = (profile: string, page: string, operationId: string) => invoke<SimsMtsDetail>("games_sims_mts_detail", { profile, page, operationId });
export type SimsMtsQuery = { game?: 2 | 3 | 4; category: number; sort: number; query: string; page: number };
export type SimsMtsProject = { metrics?: SimsMtsMetrics; updated?: string; picked?: boolean; game?: 2 | 3 | 4; id: string; title: string; creator: string; image: string; page: string; description: string; category: string };
export type SimsMtsPage = { query: SimsMtsQuery; projects: SimsMtsProject[]; next: boolean; total: number | null; url: string; observedAt: number; stale: boolean };
export const simsMtsBrowse = (profile: string, query: SimsMtsQuery, operationId: string, refresh = false) => invoke<SimsMtsPage>("games_sims_mts_browse", { profile, query: query.game === 4 ? { ...query, game: undefined } : query, operationId, refresh });
export type SimsLot51Project = { slug: string; title: string; subtitle: string; version: string; icon: string; image: string; page: string };
export type SimsLot51Catalog = { projects: SimsLot51Project[]; observedAt: number; cached: boolean };
export type SimsLot51Detail = { project: SimsLot51Project; description: string; packs: string[]; requiredCore: string | null; changelog: string };
export const simsLot51Catalog = (refresh = false) => invoke<SimsLot51Catalog>("games_sims_lot51_catalog", { refresh });
export const simsLot51Detail = (project: string) => invoke<SimsLot51Detail>("games_sims_lot51_detail", { project });
export type SimsCreatorRelease = { version: string; gamePatch: string; changelog: string };
export type SimsCreatorCatalog = { releases: SimsCreatorRelease[]; observedAt: number };
export type SimsGroup = { source?: SimsCreatorSource; id: string; title: string; enabled: boolean; files: SimsStamp[]; installedAt: number; gameVersion: string };
export type SimsBackup = { id: string; group: SimsGroup; createdAt: number };
export type SimsTroubleshooting = { id: string; round: number; phase: "baseline" | "test" | "suspect" | "inconclusive"; selected: { id: string; title: string; enabled: boolean }[]; testing: string[]; remaining: number; fixedEnabled: number; versionChanged: boolean };
export type SimsTrayItem = { id: string; title: string; category: "lot" | "room" | "household"; files: SimsStamp[]; installed: boolean; installedAt: number; ccGroup: string | null; source?: SimsCreatorSource };
export type SimsWorkspace = { tray?: { items: SimsTrayItem[] }; folder: SimsFolder; state: { root: string; revision: string; groups: SimsGroup[]; backups: SimsBackup[] }; recoveryNeeded: boolean; keptFiles?: { id: string; title: string; path: string; createdAt: number }[]; saveBackup?: SaveSnapshot | null; troubleshooting?: SimsTroubleshooting | null };
export type SimsAction = { kind: "trayImport"; title: string } | { kind: "trayRemove" | "trayRestore"; id: string } | { kind: "startTest"; groups: string[]; backupFolder: string | null } | { kind: "answerTest"; id: string; round: number; present: boolean } | { kind: "restoreTest"; id: string } | { kind: "install" | "adopt"; title: string } | { kind: "update" | "enable" | "disable" | "remove"; id: string } | { kind: "restore"; backup: string } | { kind: "applySet"; id: string; backupFolder: string | null };
export type SimsReview = { information?: SimsMetadataReport | null; source?: SimsCreatorSource | null; token: string; action: SimsAction; title: string; folder: string; gameVersion: string; files: SimsStamp[]; skipped: string[]; bytes: number; expiresAt: number; changes: { id: string; title: string; enabled: boolean; fileCount: number; bytes: number }[]; backupFolder: string | null; sourceFolder: string | null; destinationFolder: string | null; preview: string | null };
export type SimsModSet = { id: string; title: string; members: { id: string; title: string; enabled: boolean }[]; updatedAt: number };
export type SimsSetEdit = { revision: string; previous: SimsModSet | null; title: string; members: { id: string; enabled: boolean }[] };
export const simsSets = (profile: string, path: string) => invoke<SimsModSet[]>("games_sims_sets", { profile, path });
export const simsSetSave = (profile: string, path: string, edit: SimsSetEdit) => invoke<SimsModSet[]>("games_sims_set_save", { profile, path, edit });
export const simsSetRemove = (profile: string, path: string, previous: SimsModSet) => invoke<SimsModSet[]>("games_sims_set_remove", { profile, path, previous });
export type SimsInspection = { resources: number; category: string; thumbnail: string | null };
export type SimsMetadataTarget = { kind: "group"; id: string } | { kind: "file"; file: string };
export type SimsManifest = { name: string; description: string | null; version: string | null; creators: string[]; url: string | null; requiredPacks: string[]; incompatiblePacks: string[]; requirements: { name: string; version: string | null; creators: string[]; url: string | null; features: string[]; conditional: boolean }[] };
export type SimsMetadataReport = { files: { file: string; manifests: SimsManifest[] }[]; checkedFiles: number; partial: boolean };
export const simsMetadata = (profile: string, path: string, target: SimsMetadataTarget, operationId: string) => invoke<SimsMetadataReport>("games_sims_metadata", { profile, path, target, operationId });
export type SimsDependencies = { requirements: { file: string; modName: string; name: string; version: string | null; url: string | null; status: "found" | "missing" | "unchecked" | "notRequired" | "alternative"; matchedFiles: string[] }[]; checkedFiles: number; manifestFiles: number; partial: boolean; checkedAt: number; packs?: SimsPackReport | null; packError?: string | null };
export const simsDependencies = (profile: string, path: string, operationId: string, installation: SimsPackSelection | null = null) => invoke<SimsDependencies>("games_sims_dependencies", { profile, path, operationId, installation });
export type SimsDuplicates = { matches: { bytes: number; copies: { path: string; groupId: string | null; groupTitle: string | null }[] }[]; checkedFiles: number; skippedFiles: number; partial: boolean; checkedAt: number };
export const simsDuplicates = (profile: string, path: string, operationId: string) => invoke<SimsDuplicates>("games_sims_duplicates", { profile, path, operationId });
export const isSims4 = (game: { steamId?: number; igdbId?: number }) => game.steamId === 1222670 || game.igdbId === 3212;
export const simsDisplayPath = (path: string) => path.startsWith("\\\\?\\UNC\\") ? `\\\\${path.slice(8)}` : path.startsWith("\\\\?\\") ? path.slice(4) : path;
const folderKey = (profile: string) => `harbor.games.sims.folder:${profile}`;
export function readSimsFolder(profile: string) { try { const value = localStorage.getItem(folderKey(profile)); return value && value.length <= 4096 ? value : ""; } catch { return ""; } }
export function rememberSimsFolder(profile: string, path: string) { try { localStorage.setItem(folderKey(profile), path); } catch { /* The current workspace remains usable without persistence. */ } }
export const simsFolders = () => invoke<SimsFolder[]>("games_sims_folders");
export const simsWorkspace = (path: string) => invoke<SimsWorkspace>("games_sims_workspace", { path });
export const simsCreatorCatalog = (refresh = false) => invoke<SimsCreatorCatalog>("games_sims_catalog", { refresh });
export const simsCreatorReview = (profile: string, path: string, request: { version: string; target?: string; provider?: "lot51" | "mts"; project?: string }, operationId: string) => request.provider === "lot51" || request.provider === "mts"
  ? invoke<SimsReview>(request.provider === "mts" ? "games_sims_mts_review" : "games_sims_lot51_review", { profile, path, request: { project: request.project, version: request.version, target: request.target }, operationId })
  : invoke<SimsReview>("games_sims_creator_review", { profile, path, request: { version: request.version, target: request.target }, operationId });
export const simsReview = (profile: string, path: string, action: SimsAction, sources: string[], operationId: string) => invoke<SimsReview>("games_sims_review", { profile, path, action, sources, operationId });
export const simsApply = (profile: string, token: string, operationId?: string) => invoke<SimsWorkspace>("games_sims_apply", { profile, token, operationId });
export const simsCancel = (profile: string, operationId: string) => invoke<boolean>("games_sims_cancel", { profile, operationId });
export const simsKeptFolder = (path: string, id: string) => invoke<string>("games_sims_kept_folder", { path, id });
export const simsRecover = (path: string) => invoke<SimsWorkspace>("games_sims_recover", { path });
export const simsDiscard = (profile: string, token: string) => invoke<void>("games_sims_discard", { profile, token }).catch(() => {});
const errors: Record<string, string> = {
  sims_packs_folder: "packsFolderError",
  sims_creator_dependency: "lotDependencyError", sims_lot51_target: "lotTargetError",
  sims_mts_page: "mtsPageError", sims_mts_zip: "mtsZip", sims_mts_browse: "mtsQueryError",
  sims_creator_network: "creatorNetwork", sims_creator_format: "creatorNetwork", sims_creator_changed: "creatorChanged", sims_creator_patch: "creatorPatch", sims_creator_target: "creatorTarget", sims_creator_existing: "creatorExistingError",
  sims_tray_format: "trayFormat", sims_tray_set: "traySet", sims_tray_exists: "trayExists",
  sims_test_active: "testActive",
  sims_adopt_folder: "adoptFolder", sims_adopt_managed: "adoptManaged", sims_adopt_scan: "adoptScan",
  sims_set_missing: "setMissing", sims_set_unchanged: "setUnchanged", sims_set_scan: "setScan",
  sims_folder: "folderError", sims_path: "folderError", sims_link: "folderError", sims_platform: "desktop",
  sims_read: "readError", sims_format: "formatError", sims_script: "formatError", sims_archive: "formatError", sims_archive_layout: "layoutError",
  sims_running: "running", sims_process: "running", sims_recovery: "recovery", sims_title: "nameError", sims_duplicate: "duplicate",
  sims_record: "recordError", sims_profile: "reviewError", sims_request: "reviewError",
};
export function simsError(error: unknown) {
  const value = error instanceof Error ? error.message : String(error);
  if (value.startsWith("save_")) return saveErrorKey(value);
  if (value === "sims_save_recovery") return "games.backups.save_recovery";
  if (errors[value]) return `games.sims.${errors[value]}`;
  if (["sims_canceled", "sims_write", "sims_changed", "sims_exists", "sims_missing", "sims_busy", "sims_limit", "sims_expired", "sims_space"].includes(value)) return `games.mods.error.${value.slice(5)}`;
  return "games.sims.desktop";
}

// Reading a thumbnail can decompress package resources. Bound work even for a
// large local gallery and skip requests whose cards have left the page.
let inspecting = 0;
const queue: (() => void)[] = [];
export function simsInspect(path: string, file: string, signal: AbortSignal): Promise<SimsInspection> {
  return queuedInspection("games_sims_inspect", { path, file }, signal);
}
export function simsTrayPreview(path: string, id: string, signal: AbortSignal): Promise<string | null> {
  return queuedInspection("games_sims_tray_preview", { path, id }, signal);
}
function queuedInspection<T>(command: string, args: Record<string, string>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const run = () => {
      if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); queue.shift()?.(); return; }
      inspecting++;
      void invoke<T>(command, args).then(resolve, reject).finally(() => { inspecting--; queue.shift()?.(); });
    };
    if (inspecting < 2) run(); else queue.push(run);
  });
}
