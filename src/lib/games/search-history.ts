export type RecentGameSearch = { query: string; ai: boolean };
const key = (profile: string) => `harbor.games.search-history.v1:${encodeURIComponent(profile)}`;
export function readGameSearchHistory(profile: string): RecentGameSearch[] {
  try {
    const input: unknown = JSON.parse(localStorage.getItem(key(profile)) || "[]");
    if (!Array.isArray(input)) return [];
    return input.flatMap(item => item && typeof item.query === "string" && item.query.trim().length >= 2 ? [{ query: item.query.trim().slice(0, 500), ai: item.ai === true }] : []).slice(0, 8);
  } catch { return []; }
}
export function saveGameSearchHistory(profile: string, items: RecentGameSearch[]) {
  try { localStorage.setItem(key(profile), JSON.stringify(items.slice(0, 8))); } catch { /* Session history remains usable when storage is unavailable. */ }
}
export function rememberGameSearch(items: RecentGameSearch[], entry: RecentGameSearch): RecentGameSearch[] {
  const query = entry.query.trim().slice(0, entry.ai ? 500 : 180);
  if (query.length < 2) return items;
  return [{ query, ai: entry.ai }, ...items.filter(item => item.query.toLocaleLowerCase() !== query.toLocaleLowerCase())].slice(0, 8);
}
