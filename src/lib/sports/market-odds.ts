import type { SportsGame } from "./espn-types";
export type MarketOdds = {
  question: string;
  url: string;
  outcomes: { name: string; probability: number }[];
};
const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const array = (value: unknown): unknown[] => {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
export function parseMarketOdds(raw: any, game: SportsGame): MarketOdds[] {
  if (!game.home.name || !game.away.name || !game.startMs) return [];
  const home = normalize(game.home.name),
    away = normalize(game.away.name);
  const output: MarketOdds[] = [];
  for (const event of Array.isArray(raw.events) ? raw.events : []) {
    for (const market of Array.isArray(event.markets) ? event.markets : []) {
      if (market.closed || market.active === false || market.sportsMarketType !== "moneyline")
        continue;
      const title = ` ${normalize(`${event.title || ""} ${market.question || ""}`)} `;
      if (!title.includes(` ${home} `) || !title.includes(` ${away} `)) continue;
      // Market creation and settlement dates are not the fixture's start time.
      const start = Date.parse(market.gameStartTime || event.startTime || "");
      if (!Number.isFinite(start) || Math.abs(start - game.startMs) > 6 * 3600000) continue;
      const names = array(market.outcomes),
        prices = array(market.outcomePrices);
      if (
        names.length < 2 ||
        names.length > 3 ||
        names.length !== prices.length ||
        !names.every((name) => typeof name === "string")
      )
        continue;
      if (
        !prices.every(
          (price) =>
            price !== "" &&
            price !== null &&
            Number.isFinite(Number(price)) &&
            Number(price) >= 0 &&
            Number(price) <= 1,
        )
      )
        continue;
      const sum = prices.reduce<number>((total, price) => total + Number(price), 0);
      if (sum < 0.85 || sum > 1.15) continue;
      const slug = String(market.slug || "");
      if (!/^[a-z0-9-]+$/i.test(slug)) continue;
      output.push({
        question: String(market.question || event.title),
        url: `https://polymarket.com/event/${encodeURIComponent(event.slug || slug)}`,
        outcomes: names.map((name, i) => ({
          name: String(name),
          probability: Number(prices[i]),
        })),
      });
      if (output.length === 3) return output;
    }
  }
  return output;
}
