import type { GameSummary } from "./types";

export const XIV_API = "https://v2.xivapi.com/api";
export const XIV_MARKET = "https://universalis.app/api/v2";
export const XIV_SCHEMA = "exdschema@2:rev:e773c41a90aed788cf4c1c48469fa85618ef01fb";
export const XIV_FIELDS = "Name,Icon,Description,IsUntradable,ItemSearchCategory.Name";
export type XivItem = { id: number; name: string; description: string; icon: string; category: string };
export type XivSearch = { items: XivItem[]; next?: string; version: string; partial: boolean };
export type XivCenter = { name: string; region: string; worlds: { id: number; name: string }[] };
export type XivListing = { price: number; quantity: number; total: number; tax: number | null; hq: boolean; world: number; at: number };
export type XivSale = Omit<XivListing, "tax">;
export type XivMarket = { item: number; listings: XivListing[]; sales: XivSale[]; at: number | null; partial: boolean };
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown, max = 200) => typeof v === "string" && v.length <= max ? v.trim() : "";
const positive = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0 && v <= 0x7fff_ffff;
const timestamp = (v: unknown, now: number) => typeof v === "number" && Number.isSafeInteger(v) && v >= Date.UTC(2013, 0, 1) && v <= now + 5 * 60_000 ? v : null;
export function isFfxiv(game: Pick<GameSummary, "steamId" | "igdbId">) { return game.steamId === 39210 || (!game.steamId && game.igdbId === 386); }
export function xivLanguage(language: string) { return ["en", "de", "fr", "ja"].includes(language) ? language : "en"; }
export function xivSearchUrl(query: string, language: string, cursor?: string, version?: string): string {
  if (query.length > 80 || (cursor && !/^[a-f\d-]{36}$/i.test(cursor)) || (version && !/^[a-f\d]{16}$/i.test(version))) throw Error("Invalid item search");
  const params = new URLSearchParams({ sheets: "Item", fields: XIV_FIELDS, language: xivLanguage(language), schema: XIV_SCHEMA, limit: "20" });
  if (cursor) params.set("cursor", cursor);
  else params.set("query", query.trim() ? `+Name~${JSON.stringify(query.trim())} +IsUntradable=false +ItemSearchCategory>0` : "+ItemSearchCategory=58 +IsUntradable=false");
  if (version) params.set("version", version);
  return `${XIV_API}/search?${params}`;
}
export function parseXivSearch(raw: unknown, expectedVersion?: string): XivSearch {
  const v = record(raw), version = str(v.version), next = str(v.next);
  if (!Array.isArray(v.results) || v.results.length > 20 || v.schema !== XIV_SCHEMA || !/^[a-f\d]{16}$/i.test(version) || (expectedVersion && version !== expectedVersion) || (next && !/^[a-f\d-]{36}$/i.test(next))) throw Error("Invalid item catalog");
  const items: XivItem[] = [], seen = new Set<number>(); let partial = false;
  for (const row of v.results) {
    const item = record(row), fields = record(item.fields), icon = record(fields.Icon), category = record(fields.ItemSearchCategory), path = str(icon.path_hr1) || str(icon.path);
    if (item.sheet !== "Item" || !positive(item.row_id) || seen.has(item.row_id) || !str(fields.Name) || fields.IsUntradable !== false || !positive(category.row_id)) { partial = true; continue; }
    seen.add(item.row_id);
    items.push({ id: item.row_id, name: str(fields.Name), description: str(fields.Description, 5000), category: str(record(category.fields).Name), icon: /^ui\/icon\/\d{6}\/\d{6}(?:_hr1)?\.tex$/.test(path) ? `${XIV_API}/asset?${new URLSearchParams({ path, format: "png", version })}` : "" });
  }
  if (v.results.length && !items.length) throw Error("No valid items");
  return { items, next: next || undefined, version, partial };
}
export function parseXivCenters(centers: unknown, worlds: unknown): XivCenter[] {
  if (!Array.isArray(centers) || centers.length > 64 || !Array.isArray(worlds) || worlds.length > 512) throw Error("Invalid world directory");
  const names = new Map<number, string>();
  for (const raw of worlds) { const w = record(raw); if (!positive(w.id) || !str(w.name) || names.has(w.id)) throw Error("Invalid world"); names.set(w.id, str(w.name)); }
  const seen = new Set<string>();
  const result = centers.map(raw => {
    const dc = record(raw), name = str(dc.name, 80), region = str(dc.region, 80);
    if (!name || !region || seen.has(name) || !Array.isArray(dc.worlds) || dc.worlds.length > 64 || new Set(dc.worlds).size !== dc.worlds.length || dc.worlds.some(id => !positive(id) || !names.has(id))) throw Error("Invalid data center");
    seen.add(name); return { name, region, worlds: dc.worlds.map(id => ({ id: id as number, name: names.get(id as number)! })) };
  });
  if (!result.length) throw Error("No data centers");
  return result;
}
export function xivMarketUrl(center: XivCenter, item: number, world: number | null, quality: string) {
  if (!positive(item) || !center.name || !["all", "hq", "nq"].includes(quality) || (world !== null && !center.worlds.some(row => row.id === world))) throw Error("Invalid market selection");
  const fields = "itemID,dcName,worldID,lastUploadTime,listings.pricePerUnit,listings.quantity,listings.total,listings.tax,listings.hq,listings.worldID,listings.lastReviewTime,recentHistory.pricePerUnit,recentHistory.quantity,recentHistory.total,recentHistory.hq,recentHistory.worldID,recentHistory.timestamp";
  const params = new URLSearchParams({ listings: "20", entries: "10", fields });
  if (quality !== "all") params.set("hq", String(quality === "hq"));
  return `${XIV_MARKET}/${encodeURIComponent(world === null ? center.name : String(world))}/${item}?${params}`;
}
export function parseXivMarket(raw: unknown, center: XivCenter, item: number, world: number | null, quality: string, now = Date.now()): XivMarket {
  const v = record(raw);
  if (v.itemID !== item || (world === null ? v.dcName !== center.name : v.worldID !== world) || !Array.isArray(v.listings) || v.listings.length > 20 || !Array.isArray(v.recentHistory) || v.recentHistory.length > 10) throw Error("Wrong market identity");
  let partial = false;
  const row = (raw: unknown, sale: boolean) => {
    const r = record(raw), id = r.worldID ?? world, at = timestamp(typeof r[sale ? "timestamp" : "lastReviewTime"] === "number" ? Number(r[sale ? "timestamp" : "lastReviewTime"]) * 1000 : null, now);
    if (!positive(id) || !center.worlds.some(w => w.id === id) || (world !== null && id !== world) || !positive(r.pricePerUnit) || !positive(r.quantity) || !positive(r.total) || r.pricePerUnit * r.quantity !== r.total || typeof r.hq !== "boolean" || (quality !== "all" && r.hq !== (quality === "hq")) || !at) { partial = true; return null; }
    return { price: r.pricePerUnit, quantity: r.quantity, total: r.total, tax: typeof r.tax === "number" && Number.isSafeInteger(r.tax) && r.tax >= 0 ? r.tax : null, hq: r.hq, world: id, at };
  };
  const listings = v.listings.map(r => row(r, false)).filter((r): r is XivListing => r !== null).sort((a, b) => a.price - b.price);
  const sales = v.recentHistory.map(r => row(r, true)).filter((r): r is XivListing => r !== null).sort((a, b) => b.at - a.at);
  if ((v.listings.length && !listings.length) || (v.recentHistory.length && !sales.length)) throw Error("Market rows invalid");
  return { item, listings, sales, at: timestamp(v.lastUploadTime, now), partial };
}
