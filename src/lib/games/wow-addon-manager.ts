import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export type WowManagedAddon = { id: number; title: string; version: string; folders: string[]; files: number; bytes: number };
export type WowAddonWorkspace = { id: string; clientVersion: string; revision: string | null; addons: WowManagedAddon[]; backups: { token: string; createdAt: number; addon: WowManagedAddon }[]; recoveryPending: boolean; canAdopt?: boolean };
export type WowAddonRequest = { action: "install" | "remove" | "adopt"; addonId: number } | { action: "restore"; backup: string };
export type WowAddonReview = { token: string; id: string; addonId: number; title: string; clientVersion: string; fromVersion: string | null; version: string | null; restore: boolean; adopt?: boolean; folders: { name: string; action: "add" | "replace" | "remove" | "keep" }[]; files: number; bytes: number; backupBytes: number; dependencies: string[]; expiresAt: number };
export const loadWowAddonWorkspace = (id: string) => invoke<WowAddonWorkspace>("games_wow_addon_workspace", { id });
export const reviewWowAddon = (profile: string, id: string, request: WowAddonRequest, operationId: string) => invoke<WowAddonReview>("games_wow_addon_review", { profile, id, request, operationId });
export const applyWowAddon = (profile: string, token: string, operationId: string) => invoke<WowAddonWorkspace>("games_wow_addon_apply", { profile, token, operationId });
export const recoverWowAddons = (profile: string, id: string, operationId: string) => invoke<WowAddonWorkspace>("games_wow_addon_recover", { profile, id, operationId });
export const discardWowAddon = (profile: string, token: string) => invoke<void>("games_wow_addon_discard", { profile, token }).catch(() => {});
export const cancelWowAddon = (profile: string, operationId: string) => invoke<void>("games_wow_addon_cancel", { profile, operationId }).catch(() => {});
export const onWowAddonProgress = (profile: string, callback: (operationId: string, phase: string) => void) => listen<{ profile: string; operationId: string; phase: string }>("games:wow-addon-progress", ({ payload }) => { if (payload.profile === profile) callback(payload.operationId, payload.phase); }).catch(() => () => {});

export function wowAddonError(reason: unknown): string {
  const code = String(reason);
  const match = code.match(/wow_addons_([a-z_]+)/)?.[1];
  if (match === "cancelled") return "games.wow.manager.cancelled";
  if (["running", "game_busy", "process"].includes(match ?? "")) return "games.wow.manager.errorRunning";
  if (["incompatible", "edition", "version"].includes(match ?? "")) return "games.wow.manager.errorCompatibility";
  if (match === "identity" || match === "collision") return "games.wow.manager.errorIdentity";
  if (match === "unmanaged") return "games.wow.manager.errorUnmanaged";
  if (["changed", "linked", "record", "recovery"].includes(match ?? "")) return "games.wow.manager.errorChanged";
  if (match === "dependency") return "games.wow.manager.errorDependency";
  if (["expired", "review"].includes(match ?? "")) return "games.wow.manager.errorExpired";
  if (match === "platform" || /not found|not a function|__TAURI|undefined/i.test(code)) return "games.wow.manager.errorDesktop";
  return "games.wow.manager.error";
}
