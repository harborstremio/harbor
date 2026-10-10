import { filterQuickLibrary, quickGameActivityAt, type QuickFilters, type QuickGame } from "./quick-library";
import { LAUNCHER_NAMES } from "./launchers";

export type SidebarPreferences = {
  filters: Omit<QuickFilters, "query" | "sort"> & { sort: QuickFilters["sort"] | "custom" };
  pinned: string[];
  hidden: string[];
  order: string[];
  grouping: "source" | "none";
  collapsedGroups: string[];
};
export const sidebarPreferenceKey = (profile: string) => `harbor.games.sidebar.v1:${encodeURIComponent(profile)}`;
export const defaultSidebarPreferences = (): SidebarPreferences => ({
  filters: { group: "all", source: "all", ready: false, sort: "recent" }, pinned: [], hidden: [], order: [], grouping: "source", collapsedGroups: [],
});
export function parseSidebarPreferences(raw: string | null): SidebarPreferences {
  const result = defaultSidebarPreferences();
  if (!raw || raw.length > 2 * 1024 * 1024) return result;
  try {
    const value = JSON.parse(raw);
    const f = value?.filters;
    if (f && typeof f === "object") {
      if (["all", "favorites", "recent"].includes(f.group)) result.filters.group = f.group;
      if (["all", "steam", "shortcut", "launcher", "custom", "retro", "saved"].includes(f.source)) result.filters.source = f.source;
      if (["recent", "name", "custom"].includes(f.sort)) result.filters.sort = f.sort;
      if (typeof f.ready === "boolean") result.filters.ready = f.ready;
    }
    result.grouping = value?.grouping === "none" || result.filters.sort === "custom" && value?.grouping === undefined ? "none" : "source";
    for (const key of ["pinned", "hidden", "order", "collapsedGroups"] as const) {
      if (Array.isArray(value?.[key])) result[key] = [...new Set<string>(value[key].filter((id: unknown) => typeof id === "string" && id.length > 0 && id.length <= 9000 && !/[\x00-\x1f]/.test(id)))].slice(0, 5000);
    }
  } catch { /* Invalid preferences never prevent the library from opening. */ }
  return result;
}

export function sidebarSections(games: QuickGame[], preferences: SidebarPreferences, editing = false, now = Date.now()) {
  const pinned = new Set(preferences.pinned);
  const grouped = preferences.grouping === "source" && !editing;
  // A small, current set: local additions count without pretending they were played.
  const recentGames = grouped ? games.filter(game => !pinned.has(game.id) && quickGameActivityAt(game, now) > 0 && quickGameActivityAt(game, now) >= now - 30 * 86400_000)
    .sort((a, b) => quickGameActivityAt(b, now) - quickGameActivityAt(a, now) || a.name.localeCompare(b.name)).slice(0, 6) : [];
  const recent = new Set(recentGames.map(game => game.id));
  const sections = new Map<string, { id: string; label: string; translated: boolean; games: QuickGame[] }>();
  for (const game of games) {
    const pin = pinned.has(game.id);
    const id = pin ? "pinned" : recent.has(game.id) ? "recent" : !grouped ? "all" : game.source === "launcher" ? `launcher:${game.install.launcher}` : game.source;
    const literal = id === "steam" ? "Steam" : id.startsWith("launcher:") && game.source === "launcher" ? LAUNCHER_NAMES[game.install.launcher] : null;
    const label = literal ?? (id === "pinned" ? "games.sidebar.pinned" : id === "recent" ? "games.dock.recent" : id === "all" ? "games.sidebar.allGames" : `games.dock.${game.source}`);
    if (!sections.has(id)) sections.set(id, { id, label, translated: !literal, games: [] });
    sections.get(id)!.games.push(game);
  }
  const recentSection = sections.get("recent");
  if (recentSection) recentSection.games = recentGames;
  // Explicit pins lead; source groups keep their chosen sort below recent activity.
  const order = ["pinned", "recent", "all", "steam", "shortcut", "launcher", "custom", "retro", "saved"];
  return [...sections.values()].sort((a, b) => order.indexOf(a.id.split(":")[0]) - order.indexOf(b.id.split(":")[0]) || a.id.localeCompare(b.id));
}

export function sidebarGames(games: QuickGame[], preferences: SidebarPreferences, query: string, editing = false) {
  const { filters, pinned, hidden, order } = preferences;
  const filtered = filterQuickLibrary(games, {
    ...filters, query, sort: filters.sort === "name" ? "name" : "recent",
    ...(editing ? { group: "all", source: "all", ready: false } as const : {}),
  }).filter(game => editing || !hidden.includes(game.id));
  const pins = new Map(pinned.map((id, index) => [id, index]));
  const ranks = new Map(order.map((id, index) => [id, index]));
  return filtered.sort((a, b) => {
    const ap = pins.get(a.id), bp = pins.get(b.id);
    if (ap !== undefined || bp !== undefined) return (ap ?? Infinity) - (bp ?? Infinity);
    if (filters.sort === "custom") return (ranks.get(a.id) ?? Infinity) - (ranks.get(b.id) ?? Infinity) || 0;
    return 0;
  });
}

/** Only move within the same section; preserve entries absent from the current scan/filter. */
export function moveSidebarGame(preferences: SidebarPreferences, games: QuickGame[], id: string, target: string): SidebarPreferences {
  if (id === target || !games.some(game => game.id === id) || !games.some(game => game.id === target)) return preferences;
  const isPinned = preferences.pinned.includes(id);
  if (isPinned !== preferences.pinned.includes(target)) return preferences;
  const key = isPinned ? "pinned" : "order";
  const visible = sidebarGames(games, preferences, "", true).filter(game => preferences.pinned.includes(game.id) === isPinned).map(game => game.id);
  const ids = [...new Set(isPinned || preferences.filters.sort === "custom" ? [...preferences[key], ...visible] : [...visible, ...preferences[key]])];
  const from = ids.indexOf(id), to = ids.indexOf(target);
  ids.splice(from, 1); ids.splice(to, 0, id);
  return { ...preferences, [key]: ids, ...(!isPinned && { grouping: "none" as const }), filters: { ...preferences.filters, ...(!isPinned && { sort: "custom" as const }) } };
}
