import { parseAtlasSummary } from "./igdb-data";
import type { AudienceGame } from "./audience-charts";
import type { GameSummary } from "./types";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const clean = (name: string) => name.replace(/[™®©]/g, "").replace(/\s*(?:[-–]\s*Xbox|(?:for )?Xbox (?:One|Series X\s*\|\s*S))\)?$/i, "").replace(/\s*\($/, "").trim();
const normalized = (name: string) => clean(name).replace(/^EA SPORTS\s+/i, "").normalize("NFKD").replace(/\p{M}/gu, "").toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const quoted = (value: string) => `"${value.replace(/["\\\x00-\x1f]/g, " ").slice(0, 160)}"`;
const titleCase = (name: string) => name.replace(/\b[A-Z]{4,}\b/g, word => word[0] + word.slice(1).toLowerCase());
const productId = (game: AudienceGame) => /^xbox:([A-Z0-9]{12})$/.exec(game.id)?.[1];

export function xboxIdentityQuery(games: AudienceGame[]): string {
  const ids = games.map(productId).filter((id): id is string => !!id);
  if (!ids.length) throw new Error("Missing Xbox product identities");
  const names = [...new Set(games.flatMap(game => {
    const name = clean(game.name), unbranded = name.replace(/^EA SPORTS\s+/i, "");
    return [name, titleCase(name), unbranded, titleCase(unbranded)];
  }))];
  // Equality lookups stay bounded; many OR-ed case-insensitive scans exceed the provider timeout.
  return `fields name,game_type,platforms.name,external_games.external_game_source,external_games.uid,alternative_names.name; where external_games.uid = (${ids.map(quoted).join(",")}) | name = (${names.map(quoted).join(",")}); limit 100;`;
}

/** Join by an actual Microsoft product ID first; only accept unambiguous exact Xbox titles otherwise. */
export function matchXboxGames(games: AudienceGame[], rows: unknown[]): AudienceGame[] {
  return games.map(game => {
    const uid = productId(game);
    const exact = rows.filter(value => list(record(value).external_games).some(value => {
      const external = record(value), source = external.external_game_source;
      return external.uid === uid && [11, 54].includes(Number(typeof source === "object" ? record(source).id : source));
    }));
    const name = normalized(game.name);
    // These products are multi-title launchers. They must never match the older namesake game.
    const aggregate = ["call of duty", "battlefield"].includes(name);
    const platform = /Xbox Series/i.test(game.name) ? "Xbox Series X|S" : /Xbox One/i.test(game.name) ? "Xbox One" : undefined;
    const byTitle = aggregate ? [] : rows.filter(value => {
      const row = record(value);
      const titles = [row.name, ...list(row.alternative_names).map(value => record(value).name)];
      return [0, 4, 8, 9, 11].includes(Number(row.game_type ?? 0)) &&
        list(row.platforms).some(value => platform ? record(value).name === platform : /^Xbox(?: One| Series X\|S)?$/i.test(String(record(value).name))) &&
        titles.some(title => typeof title === "string" && normalized(title) === name);
    });
    const candidates = [...new Map((exact.length ? exact : byTitle).map(value => [record(value).id, value])).values()];
    const match = candidates.length === 1 ? parseAtlasSummary(candidates[0]) : null;
    let openGame: GameSummary | undefined;
    if (match) {
      // Keep the provider's console edition route, even if it also links a modern Steam port.
      openGame = { ...match, id: `igdb:${match.igdbId}`, steamId: undefined, capsule: game.capsule };
    } else if (uid === "9N201KQXS5BM") {
      // The same Call of Duty hub published on Steam, rather than Call of Duty (2003).
      openGame = { ...game, id: "steam:1938090", steamId: 1938090 };
    }
    return { ...game, openGame };
  });
}
