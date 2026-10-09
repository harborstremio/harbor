import type { LocalAchievement } from "./local-achievements";

export const MAX_ACHIEVEMENT_CHANGES = 2000;
export type AchievementDraft = Record<string, boolean>;
export type AchievementEdit = "unlock" | "relock" | "invert";
export function editAchievementDraft(items: readonly LocalAchievement[], draft: AchievementDraft, mode: AchievementEdit): AchievementDraft {
  const next = { ...draft };
  for (const item of items) {
    if (!item.editable) continue;
    const current = Object.hasOwn(next, item.id) ? next[item.id] : item.unlocked;
    const value = mode === "invert" ? !current : mode === "unlock";
    if (value === item.unlocked) delete next[item.id];
    else next[item.id] = value;
  }
  if (Object.keys(next).length > MAX_ACHIEVEMENT_CHANGES) throw Error("achievement_invalid_changes");
  return next;
}

const accepted = new Set<string>();
export const achievementNoticeKey = (profile: string) => `harbor.games.achievement-notice.v1:${encodeURIComponent(profile)}`;
export function hasAchievementNotice(profile: string): boolean {
  if (accepted.has(profile)) return true;
  try { return localStorage.getItem(achievementNoticeKey(profile)) === "accepted"; } catch { return false; }
}
export function acceptAchievementNotice(profile: string): void {
  accepted.add(profile);
  if (accepted.size > 50) accepted.delete(accepted.values().next().value!);
  try { localStorage.setItem(achievementNoticeKey(profile), "accepted"); } catch { /* Keep consent for this session when storage is unavailable. */ }
}
