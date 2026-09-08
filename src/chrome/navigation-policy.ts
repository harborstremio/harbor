export type NavigationCustomization = {
  order: string[];
  hidden: string[];
  renamed: Record<string, string>;
};

export type NavigationItem = {
  id: string;
  view: string;
  label: string;
  hideKey?: "anime" | "liveTv" | "manga";
  parentalKey?: string;
  pinGated?: boolean;
};

export type NavigationPolicy = {
  kid: boolean;
  showPlaylistsTab: boolean;
  hideContent: Partial<Record<"anime" | "liveTv" | "manga", boolean>>;
  locked: boolean;
  hiddenTabs: Record<string, boolean>;
};

export const PRIMARY_NAV_IDS = new Set([
  "home",
  "discover",
  "catalogs",
  "movies",
  "shows",
  "kids",
  "anime",
  "live",
  "vod",
]);

export function customizeNavigation<T extends NavigationItem>(
  items: T[],
  config: NavigationCustomization,
): T[] {
  const shown = items
    .filter((item) => !config.hidden.includes(item.id))
    .map((item) => (config.renamed[item.id] ? { ...item, label: config.renamed[item.id] } : item));
  if (!config.order.length) return shown;
  const byId = new Map(shown.map((item) => [item.id, item]));
  const ordered = config.order.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const inOrder = new Set(config.order);
  return ordered.concat(shown.filter((item) => !inOrder.has(item.id)));
}

export function visibleNavigation<T extends NavigationItem>(
  items: T[],
  policy: NavigationPolicy,
): T[] {
  return items.filter((item) => {
    if (policy.kid) return item.view === "kids";
    if (item.view === "kids") return false;
    if (item.view === "vod" && !policy.showPlaylistsTab) return false;
    if (item.hideKey && policy.hideContent[item.hideKey]) return false;
    if (policy.locked && item.parentalKey && policy.hiddenTabs[item.parentalKey]) return false;
    return true;
  });
}

export function resolveSidebarNavigation<T extends NavigationItem>(
  items: T[],
  config: NavigationCustomization,
  policy: NavigationPolicy,
) {
  const visible = visibleNavigation(customizeNavigation(items, config), policy);
  const grouped = visible
    .filter((item) => PRIMARY_NAV_IDS.has(item.id))
    .concat(visible.filter((item) => !PRIMARY_NAV_IDS.has(item.id)));
  return grouped.map((item) => ({
    item,
    primary: PRIMARY_NAV_IDS.has(item.id),
    gated: !!item.pinGated && policy.locked,
  }));
}
