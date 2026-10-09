import type { AudienceGame } from "./audience-charts";
import { parseSteamArtwork, parseSteamStoreItems } from "./steam-data";

export const DECK_AUDIENCE_URL = "https://store.steampowered.com/charts/steamdecktopplayed";
export const DECK_AUDIENCE_TTL = 15 * 60_000;
export type DeckAudience = { games: AudienceGame[]; start: number; end: number };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

/** Read Valve's serialized chart query, never execute remote scripts or embed page markup. */
export function parseDeckAudience(raw: unknown): DeckAudience {
  if (typeof raw !== "string" || raw.length > 3_000_000) throw new Error("Invalid Steam Deck chart");
  const contextMatch = raw.match(/window\.SSR\.renderContext\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/s);
  const loaderMatch = raw.match(/window\.SSR\.loaderData\s*=\s*(\[.*?\]);/s);
  if (!contextMatch || !loaderMatch) throw new Error("Missing Steam Deck chart data");
  const context = record(JSON.parse(JSON.parse(contextMatch[1])));
  const queries = list(record(JSON.parse(String(context.queryData))).queries).map(record);
  const loaders = list(JSON.parse(loaderMatch[1])).map(value => record(typeof value === "string" ? JSON.parse(value) : value));
  const period = loaders.find(row => row.ePeriod === 1 && typeof row.rtRangeStart === "number" && typeof row.rtRangeEnd === "number");
  const chart = queries.find(row => { const key = list(row.queryKey); return key[0] === "ChartsMostPlayedOnDeck" && key[1] === 1; });
  const ranks = list(record(record(chart?.state).data).rgRanks).slice(0, 100).map(record);
  if (!period || !ranks.length || Number(period.rtRangeStart) >= Number(period.rtRangeEnd)) throw new Error("Missing Steam Deck chart period");
  const ids = ranks.map(row => Number(record(row.itemKey).appid)).filter(id => Number.isSafeInteger(id) && id > 0);
  const items = ids.map(appid => {
    const parts = new Map(queries.filter(row => list(row.queryKey)[0] === "StoreItem" && list(row.queryKey)[1] === `app_${appid}`)
      .map(row => [list(row.queryKey)[2], record(record(row.state).data)]));
    return { ...parts.get("default_info"), appid, assets: parts.get("include_assets"), platforms: parts.get("include_platforms") };
  });
  const data = { response: { store_items: items } };
  const games = parseSteamStoreItems(data, [...new Set(ids)]).map(game => ({ ...game,
    chartRank: Number(ranks.find(row => record(row.itemKey).appid === game.steamId)?.nRank),
    hero: parseSteamArtwork(data, game.steamId!).libraryHero,
  })).filter(game => Number.isSafeInteger(game.chartRank) && game.chartRank > 0);
  if (!games.length) throw new Error("Empty Steam Deck chart");
  return { games, start: Number(period.rtRangeStart), end: Number(period.rtRangeEnd) };
}
