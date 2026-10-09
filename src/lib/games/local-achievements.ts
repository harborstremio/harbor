import { invoke, isTauri } from "@tauri-apps/api/core";
import { osClass } from "@/lib/platform";

export type LocalAchievement = {
  id: string; name: string; description: string; icon: string; lockedIcon: string;
  hidden: boolean; unlocked: boolean; unlockedAt: number; editable: boolean;
};
export type LocalAchievementSnapshot = { appId: number; steamId: string; updatedAt: number; items: LocalAchievement[] };
export type LocalAchievementReview = { token: string; expiresIn: number; snapshot: LocalAchievementSnapshot };
export type LocalAchievementChange = { id: string; unlocked: boolean };
export type LocalAchievementApplied = {
  snapshot: LocalAchievementSnapshot | null;
  results: { id: string; requested: boolean; actual: boolean | null; verified: boolean }[];
  confirmed: boolean; error: string | null;
};
export function localAchievementsAvailable() { return isTauri() && osClass() === "windows"; }
let pendingRead: Promise<void> = Promise.resolve();
export function readLocalAchievements(profile: string, appId: number, signal?: AbortSignal) {
  // The native reader has a single gate. Opening Manage during a sidebar read
  // should wait for it, rather than fail immediately with achievement_busy.
  const read = pendingRead.then(() => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    return invoke<LocalAchievementReview>("games_read_local_achievements", { profile, appId });
  });
  pendingRead = read.then(() => {}, () => {});
  return read;
}
export function applyLocalAchievements(profile: string, token: string, changes: LocalAchievementChange[]) {
  return invoke<LocalAchievementApplied>("games_apply_local_achievements", { profile, token, changes });
}
export function discardLocalAchievements(profile: string, token: string) {
  return invoke<void>("games_discard_local_achievements", { profile, token });
}
const ERROR_GROUP: Record<string, string> = {
  achievement_no_client: "noClient", achievement_client_load: "clientLoad", achievement_client_version: "clientVersion",
  achievement_client_offline: "offline", achievement_account_changed: "accountChanged", achievement_not_owned: "notOwned",
  achievement_stats_timeout: "timeout", achievement_stats_unavailable: "unavailable", achievement_client_rejected: "rejected",
  achievement_apply_uncertain: "uncertain", achievement_unsupported_platform: "platform", achievement_invalid_changes: "invalid",
  achievement_unknown: "stale", achievement_protected: "protected", achievement_unchanged: "stale", achievement_state_changed: "stale",
  achievement_plan_expired: "expired", achievement_busy: "busy",
};
export function localAchievementError(error: unknown) {
  return `games.achievementManager.error.${typeof error === "string" ? ERROR_GROUP[error] ?? "unavailable" : "unavailable"}`;
}
