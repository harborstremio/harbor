export const GW2_STEAM_ID = 1284210;
export const GW2_VAULT_TTL = 15 * 60_000;
export const GW2_LOGO = "https://guildwars2.staticwars.com/wp-content/themes/guildwars2.com-live/img/gw2-logotype.723cc563.svg";
// Original currency63 artwork, verified against ArenaNet /v2/currencies on2026-10-01.
export const GW2_ACCLAIM_ICON = "https://render.guildwars2.com/file/1856A01E331452E4C14E4C9CF4F818E3FAEF9B79/3124964.png";
export const GW2_VAULT_GUIDE = "https://help.guildwars2.com/hc/en-us/articles/19617357502867-Secrets-of-the-Obscure-Wizard-s-Vault";
export type Gw2Category = "Featured" | "Normal" | "Legacy";
export type Gw2Season = { key: string; title: string; start: number; end: number; listings: number[] };
export type Gw2Listing = { id: number; itemId: number; count: number; category: Gw2Category; cost: number };
export type Gw2Item = { id: number; name: string; description: string; icon: string; chatLink: string };
export type Gw2Reward = Gw2Listing & { item: Gw2Item | null };
export type Gw2Vault = { season: Gw2Season; rewards: Gw2Reward[]; partial: boolean; at: number; language: string };
export type Gw2Plan = { selected: { id: number; itemId: number }[]; budget: number | null };
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const integer = (value: unknown, min = 1, max = 1_000_000) => typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
const text = (value: unknown, max: number) => typeof value === "string" ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, max) : "";
export function gw2Language(language: string) { const code = language.toLowerCase().split(/[-_]/)[0]; return ["de", "es", "fr"].includes(code) ? code : "en"; }
export function gw2Image(value: unknown) {
  return typeof value === "string" && /^https:\/\/render\.guildwars2\.com\/file\/[a-f0-9]{40}\/\d+\.(?:png|jpg)$/i.test(value) ? value : "";
}
export function parseGw2Season(raw: unknown): Gw2Season {
  const value = object(raw), title = text(value.title, 160);
  const start = typeof value.start === "string" ? Date.parse(value.start) : NaN, end = typeof value.end === "string" ? Date.parse(value.end) : NaN;
  if (!title || !Number.isFinite(start) || !Number.isFinite(end) || start <= 0 || end <= start || !Array.isArray(value.listings) || value.listings.length > 1000 || !value.listings.every(id => integer(id))) throw Error("Invalid Wizard's Vault season");
  const listings = [...new Set(value.listings as number[])];
  return { key: `${start}:${end}:${title}`, title, start, end, listings };
}
export function parseGw2Listings(raw: unknown): Gw2Listing[] {
  if (!Array.isArray(raw) || raw.length > 1000) throw Error("Invalid Wizard's Vault listings");
  const seen = new Set<number>();
  return raw.map(entry => {
    const value = object(entry);
    if (!integer(value.id) || !integer(value.item_id) || !integer(value.item_count) || !integer(value.cost, 0) || !["Featured", "Normal", "Legacy"].includes(String(value.type)) || seen.has(value.id as number)) throw Error("Invalid Wizard's Vault offer");
    seen.add(value.id as number);
    return { id: value.id as number, itemId: value.item_id as number, count: value.item_count as number, cost: value.cost as number, category: value.type as Gw2Category };
  });
}
function description(value: unknown) {
  // Item descriptions use simple game markup. Render text only, never HTML.
  return text(value, 10_000).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, entity => ({"&nbsp;":" ","&amp;":"&","&lt;":"<","&gt;":">","&quot;":'"',"&apos;":"'"})[entity] ?? entity).slice(0, 4000);
}
export function parseGw2Items(raw: unknown): Gw2Item[] {
  if (!Array.isArray(raw) || raw.length > 200) throw Error("Invalid Guild Wars2 items");
  const seen = new Set<number>();
  return raw.flatMap(entry => {
    const value = object(entry), name = text(value.name, 240);
    if (!integer(value.id) || !name || seen.has(value.id as number)) return [];
    seen.add(value.id as number);
    return [{ id: value.id as number, name, description: description(value.description || object(value.details).description), icon: gw2Image(value.icon), chatLink: typeof value.chat_link === "string" && /^\[&[A-Za-z0-9+/=]{4,120}\]$/.test(value.chat_link) ? value.chat_link : "" }];
  });
}
export function joinGw2Rewards(season: Gw2Season, listings: Gw2Listing[], items: Gw2Item[]): Gw2Reward[] {
  const offers = new Map(listings.map(value => [value.id, value])), itemMap = new Map(items.map(value => [value.id, value]));
  if (season.listings.some(id => !offers.has(id))) throw Error("Incomplete Wizard's Vault offers");
  return season.listings.map(id => { const listing = offers.get(id)!; return { ...listing, item: itemMap.get(listing.itemId) ?? null }; });
}
export function gw2Budget(raw: string): number | null {
  if (!/^\d{1,7}$/.test(raw)) return null;
  const value = Number(raw); return integer(value, 0) ? value : null;
}
export function readGw2Plan(raw: string | null, season: Gw2Season): Gw2Plan {
  const empty = { selected: [], budget: null };
  if (!raw || raw.length > 100_000) return empty;
  try {
    const value = object(JSON.parse(raw));
    if (value.version !== 1 || value.season !== season.key || !Array.isArray(value.selected) || value.selected.length > 1000) return empty;
    const seen = new Set<number>(), selected = value.selected.flatMap(entry => {
      const row = object(entry);
      if (!integer(row.id) || !integer(row.itemId) || seen.has(row.id as number)) return [];
      seen.add(row.id as number); return [{ id: row.id as number, itemId: row.itemId as number }];
    });
    return { selected, budget: integer(value.budget, 0) ? value.budget as number : null };
  } catch { return empty; }
}
export function gw2Selected(plan: Gw2Plan, rewards: Gw2Reward[]) {
  // Listing IDs are reusable across rotations. Match the item too; two offers
  // for one item stay distinct. Each selected offer means one purchase/bundle.
  return rewards.filter(reward => plan.selected.some(row => row.id === reward.id && row.itemId === reward.itemId));
}
export function gw2Total(rewards: Gw2Reward[]) { return rewards.reduce((sum, reward) => sum + reward.cost, 0); }
