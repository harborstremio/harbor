import type { GameSummary } from "./types";

export const OSRS_API = "https://prices.runescape.wiki/api/v2/osrs";
export const OSRS_RANGES = ["6h", "24h", "7d", "30d", "6m", "1y"] as const;
export type OsrsRange = typeof OSRS_RANGES[number];
const rangeSeconds: Record<OsrsRange, number> = { "6h": 21600, "24h": 86400, "7d": 604800, "30d": 2592000, "6m": 15552000, "1y": 31536000 };
export type OsrsItem = { id: number; name: string; examine: string; members: boolean; limit: number | null; alchemy: number | null; icon: string };
export type OsrsTrade = { price: number; at: number };
export type OsrsLatest = { high: OsrsTrade | null; low: OsrsTrade | null };
export type OsrsPoint = { at: number; high: number | null; low: number | null; highVolume: number; lowVolume: number };
export type OsrsHistory = { start: number; end: number; step: number; points: OsrsPoint[] };
const record = (v: unknown): Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 200) => typeof v === "string" && v.length <= max ? v.trim() : "";
const integer = (v: unknown, min = 0): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= min;
const price = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= Number.MAX_SAFE_INTEGER;
const time = (v: unknown, now: number): number | null => integer(v) && v >= Date.UTC(2013, 0, 1) / 1000 && v * 1000 <= now + 300_000 ? v * 1000 : null;
export const isOsrs = (game: Pick<GameSummary, "steamId" | "igdbId">) => game.steamId === 1343370 || (!game.steamId && game.igdbId === 79824);
export function osrsItemId(id: number) { if (!integer(id, 1) || id > 1_000_000) throw Error("Invalid item identity"); return id; }
export function parseOsrsItems(raw: unknown): OsrsItem[] {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20_000) throw Error("Invalid item mapping");
  const seen = new Set<number>();
  return raw.map(value => {
    const v = record(value), id = osrsItemId(v.id as number), name = text(v.name), icon = text(v.icon);
    if (seen.has(id) || !name || typeof v.members !== "boolean" || !icon || /[\\/\x00-\x1f]/.test(icon) || !/\.png$/i.test(icon)) throw Error("Invalid mapped item");
    seen.add(id);
    return { id, name, examine: text(v.examine, 2000), members: v.members, limit: integer(v.limit, 1) ? v.limit : null, alchemy: integer(v.highalch) ? v.highalch : null, icon: `https://oldschool.runescape.wiki/images/${encodeURIComponent(icon.replaceAll(" ", "_"))}` };
  });
}
export function parseOsrsLatest(raw: unknown, id: number, now = Date.now()): OsrsLatest {
  const root = record(raw), data = record(root.data), keys = Object.keys(data);
  if (!root.data || typeof root.data !== "object" || Array.isArray(root.data) || keys.some(key => key !== String(osrsItemId(id)))) throw Error("Wrong item prices");
  if (!keys.length) return { high: null, low: null };
  const v = record(data[id]);
  const trade = (side: "high" | "low") => {
    if (v[side] === null && v[`${side}Time`] === null) return null;
    const at = time(v[`${side}Time`], now);
    if (!price(v[side]) || !integer(v[side], 1) || !at) throw Error("Invalid observed trade");
    return { price: v[side] as number, at };
  };
  return { high: trade("high"), low: trade("low") };
}
export function osrsHistoryUrl(id: number, range: OsrsRange) {
  if (!OSRS_RANGES.includes(range)) throw Error("Invalid history range");
  return `${OSRS_API}/timeseries?${new URLSearchParams({ id: String(osrsItemId(id)), lookback: range })}`;
}
export function parseOsrsHistory(raw: unknown, id: number, now = Date.now(), range?: OsrsRange): OsrsHistory {
  const v = record(raw), start = time(v.startTimestamp, now), end = time(v.endTimestamp, now);
  if (v.itemId !== osrsItemId(id) || !start || !end || start >= end || end - start > 370 * 86_400_000 || !integer(v.timestep, 1) || v.timestep > 86_400 || !Array.isArray(v.data) || v.data.length > 2000) throw Error("Invalid price history");
  if (range && end - start !== rangeSeconds[range] * 1000) throw Error("Wrong history period");
  const step = v.timestep * 1000, seen = new Set<number>();
  const points = v.data.map(raw => {
    const row = record(raw), at = time(row.timestamp, now);
    if (!at || at < start || at >= end || (at - start) % step !== 0 || seen.has(at) || !integer(row.highPriceVolume) || !integer(row.lowPriceVolume)) throw Error("Invalid history interval");
    seen.add(at);
    const average = (value: unknown, volume: number) => {
      if (value === null && volume === 0) return null;
      if (!price(value) || volume === 0) throw Error("Invalid average price");
      return value;
    };
    return { at, high: average(row.avgHighPrice, row.highPriceVolume), low: average(row.avgLowPrice, row.lowPriceVolume), highVolume: row.highPriceVolume, lowVolume: row.lowPriceVolume };
  }).sort((a, b) => a.at - b.at);
  return { start, end, step, points };
}
/** Missing intervals and null-sided averages break lines rather than implying continuous trades. */
export function osrsChartPaths(history: OsrsHistory, side: "high" | "low", width: number, height: number) {
  const values = history.points.flatMap(p => [p.high, p.low]).filter((p): p is number => p !== null);
  if (!values.length) return [];
  const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max(1, (hi - lo) * .1), paths: string[] = [];
  let path = "", previous: number | null = null;
  for (const p of history.points) {
    const value = p[side];
    if (value === null || (previous !== null && p.at - previous !== history.step)) { if (path) paths.push(path); path = ""; }
    if (value !== null) { const x = (p.at - history.start) / (history.end - history.start) * width, y = height - (value - lo + pad) / (hi - lo + pad * 2) * height; path += `${path ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`; }
    previous = value === null ? null : p.at;
  }
  if (path) paths.push(path);
  return paths.map(path => path.includes("L") ? path : `${path}l0,0`);
}
