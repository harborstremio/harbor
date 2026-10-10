import type { SportsGame, SportsSide } from "./espn-types";

const ORIGIN = "https://www.premierboxingchampions.com";
const normalized = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

/** Only portraits explicitly attributed to this bout's named fighters are accepted. */
export function parsePbcDetail(html: string, game: SportsGame): SportsGame {
  if (
    game.source !== "official-boxing" ||
    game.league !== "BOXING" ||
    !/^pbc:fight-night-[a-z]+-\d{1,2}-\d{4}$/.test(game.id) ||
    html.length > 1_000_000 ||
    typeof document === "undefined"
  )
    return game;

  const template = document.createElement("template");
  // Never mount remote markup: its scripts, handlers and styles remain inert.
  template.innerHTML = html;
  const root = template.content;
  const canonical = root.querySelectorAll('link[rel="canonical"]');
  if (canonical.length !== 1) return game;
  try {
    const url = new URL(canonical[0].getAttribute("href") || "");
    if (url.href !== `${ORIGIN}/${game.id.slice(4)}`) return game;
  } catch {
    return game;
  }

  const portraits = new Map<string, Set<string>>();
  for (const image of Array.from(root.querySelectorAll(".fight-image img")).slice(0, 60)) {
    const alt = normalized(image.getAttribute("alt") || "");
    if (!alt.endsWith(" fighter profile")) continue;
    const name = alt.slice(0, -" fighter profile".length);
    if (!name) continue;
    try {
      const url = new URL(image.getAttribute("src") || "", ORIGIN);
      if (
        url.origin !== ORIGIN ||
        url.username ||
        url.password ||
        url.hash ||
        !/^\/sites\/default\/files\/(?:styles\/fight_315x315\/public\/)?BioImage_[a-z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(
          url.pathname,
        )
      )
        continue;
      const values = portraits.get(name) || new Set<string>();
      values.add(url.href);
      portraits.set(name, values);
    } catch {
      // Missing, placeholder and external image URLs do not replace existing artwork.
    }
  }
  const enrich = (side: SportsSide): SportsSide => {
    const matches = portraits.get(normalized(side.name));
    if (matches?.size !== 1) return side;
    const logo = [...matches][0];
    return side.logo === logo ? side : { ...side, logo };
  };
  const home = enrich(game.home);
  const away = enrich(game.away);
  return home === game.home && away === game.away ? game : { ...game, home, away };
}
