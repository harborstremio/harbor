import type { PublicGameAchievement } from "./detail-extras-data";
import type { SteamAchievements } from "./steam-account";

export type AchievementListItem = PublicGameAchievement & {
  key: string; unlocked?: boolean; unlockedAt?: number; hidden?: boolean;
};

/** Unknown progress stays unknown; only Steam's explicit ownership refusal implies locked previews. */
export function achievementPreviewRows(highlights: readonly { name: string; icon: string }[], personal: SteamAchievements | null, notOwned = false): AchievementListItem[] {
  const rows = achievementProgressRows(highlights.map(item => ({ ...item, description: "" })), personal);
  return rows.slice(0, 4).map(item => !personal && notOwned ? { ...item, unlocked: false } : item);
}

/** Personal schema owns earned/locked state. Global percentages are optional artwork-identity joins. */
export function achievementProgressRows(publicItems: readonly PublicGameAchievement[], personal: SteamAchievements | null): AchievementListItem[] {
  if (!personal) return publicItems.map((item, index) => ({ ...item, key: `public:${index}` }));
  const artKey = (url: string) => {
    try { return new URL(url).pathname.match(/\/apps\/\d+\/[^/]+$/)?.[0] ?? ""; } catch { return ""; }
  };
  const publicArt = new Map<string, PublicGameAchievement[]>(), personalArt = new Map<string, number>();
  for (const item of publicItems) {
    const key = artKey(item.icon);
    if (key) publicArt.set(key, [...(publicArt.get(key) ?? []), item]);
  }
  for (const item of personal.items) {
    const key = artKey(item.icon);
    if (key) personalArt.set(key, (personalArt.get(key) ?? 0) + 1);
  }
  return personal.items.map(item => {
    const key = artKey(item.icon), matches = publicArt.get(key);
    const percent = matches?.length === 1 && personalArt.get(key) === 1 ? matches[0].percent : undefined;
    return { key: item.id, name: item.name || item.id, description: item.description,
      icon: item.unlocked ? item.icon : item.lockedIcon || item.icon,
      unlocked: item.unlocked, unlockedAt: item.unlockedAt, hidden: item.hidden, percent };
  });
}
