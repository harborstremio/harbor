export type WowCatalogAddon = {
  id: number; categoryId: number | null; title: string; author: string; version: string;
  updatedAt: number | null; downloads: number | null; monthlyDownloads: number | null;
  gameVersions: string[]; url: string;
};
export type WowAddonCategory = { id: number; title: string; icon: string; parents: number[] };
export type WowAddonList = { addons: WowCatalogAddon[]; partial: boolean };
export type WowAddonCategories = { categories: WowAddonCategory[]; partial: boolean };
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, limit: number) => typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, limit) : "";
const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
function id(value: unknown): number | null {
  const number = typeof value === "string" && /^[1-9]\d{0,9}$/.test(value) ? Number(value) : value;
  return typeof number === "number" && Number.isSafeInteger(number) && number > 0 && number <= 0xffffffff ? number : null;
}
function rows(value: unknown, limit: number): unknown[] {
  if (!Array.isArray(value) || value.length > limit) throw Error("Invalid addon catalog");
  return value;
}
export function parseWowAddonList(raw: unknown): WowAddonList {
  const records = rows(raw, 20_000), addons: WowCatalogAddon[] = [], seen = new Set<number>(); let partial = false;
  for (const record of records) {
    const item = object(record), key = id(item.id), title = text(item.title, 180);
    if (!key || !title || seen.has(key)) { partial = true; continue; }
    seen.add(key);
    const updatedAt = count(item.lastUpdate);
    addons.push({ id: key, categoryId: id(item.categoryId), title, author: text(item.author, 180), version: text(item.version, 100),
      updatedAt: updatedAt && updatedAt <= 8.64e15 ? updatedAt : null, downloads: count(item.downloads), monthlyDownloads: count(item.downloadsMonthly),
      gameVersions: Array.isArray(item.gameVersions) ? [...new Set(item.gameVersions.filter((version): version is string => typeof version === "string" && /^\d{1,2}\.\d{1,2}(?:\.\d{1,2}(?:\.\d{1,7})?)?$/.test(version)))].slice(0, 40) : [],
      // Construct this from the verified identity; provider page/ZIP URLs never become arbitrary links.
      url: `https://www.wowinterface.com/downloads/info${key}.html` });
  }
  if (records.length && !addons.length) throw Error("Invalid addon catalog");
  return { addons, partial };
}
export function parseWowAddonCategories(raw: unknown): WowAddonCategories {
  const records = rows(raw, 500), categories: WowAddonCategory[] = [], seen = new Set<number>(); let partial = false;
  for (const record of records) {
    const item = object(record), key = id(item.id), title = text(item.title, 100);
    if (!key || !title || seen.has(key)) { partial = true; continue; }
    seen.add(key); let icon = "";
    try {
      const url = new URL(typeof item.iconUrl === "string" ? item.iconUrl : "");
      if (url.protocol === "https:" && url.hostname === "cdn-wow.mmoui.com" && !url.port && !url.username && !url.password && !url.search && !url.hash && /^\/images\/icons\/m\d+\.(?:png|jpe?g|webp)$/i.test(url.pathname)) icon = url.href;
    } catch { /* A category name remains useful without its source image. */ }
    const parents = Array.isArray(item.parentIds) ? [...new Set(item.parentIds.map(id).filter((parent): parent is number => parent !== null && parent !== key))].slice(0, 40) : [];
    categories.push({ id: key, title, icon, parents });
  }
  if (records.length && !categories.length) throw Error("Invalid addon categories");
  return { categories, partial };
}
const normalized = (value: string) => value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().trim();
const names = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
export function selectWowAddonCatalog(addons: WowCatalogAddon[], categories: WowAddonCategory[], query: string, category: number | null, sort: "popular" | "updated" | "name", page = 0, size = 24) {
  const needle = normalized(query.slice(0, 160)), words = needle.split(/\s+/).filter(Boolean), accepted = new Set<number>();
  if (category !== null) {
    accepted.add(category);
    // Parent chains are provider metadata, including multi-parent categories. A
    // visited set makes malformed cycles finite without inventing relationships.
    for (let changed = true; changed;) {
      changed = false;
      for (const item of categories) if (!accepted.has(item.id) && item.parents.some(parent => accepted.has(parent))) { accepted.add(item.id); changed = true; }
    }
  }
  const matches: { addon: WowCatalogAddon; rank: number }[] = [];
  for (const addon of addons) {
    if (category !== null && (addon.categoryId === null || !accepted.has(addon.categoryId))) continue;
    const title = needle ? normalized(addon.title) : "";
    const searchable = needle ? `${title} ${normalized(addon.author)}` : "";
    if (words.some(word => !searchable.includes(word))) continue;
    matches.push({ addon, rank: !needle ? 0 : title === needle ? 2 : title.startsWith(needle) ? 1 : 0 });
  }
  matches.sort((a, b) => b.rank - a.rank || (sort === "popular" ? (b.addon.monthlyDownloads ?? -1) - (a.addon.monthlyDownloads ?? -1) : sort === "updated" ? (b.addon.updatedAt ?? -1) - (a.addon.updatedAt ?? -1) : 0) || names.compare(a.addon.title, b.addon.title) || a.addon.id - b.addon.id);
  const take = Number.isSafeInteger(size) ? Math.max(1, Math.min(size, 60)) : 24;
  const lastPage = Math.max(0, Math.ceil(matches.length / take) - 1), selectedPage = Number.isSafeInteger(page) ? Math.max(0, Math.min(page, lastPage)) : 0;
  return { addons: matches.slice(selectedPage * take, (selectedPage + 1) * take).map(match => match.addon), total: matches.length, page: selectedPage, hasNext: selectedPage < lastPage };
}
