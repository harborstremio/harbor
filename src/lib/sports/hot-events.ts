import type { SportsGame } from "./espn-types";
import { eventCards } from "./hub-cache";
import { hubLeague } from "./hub-data";

export const HOT_EVENT_LEAGUES = [
  "UFC",
  "PFL",
  "ONE",
  "BOXING",
  "F1",
  "NFL",
  "NBA",
  "WNBA",
  "MLB",
  "NHL",
  "EPL",
  "UCL",
  "LALIGA",
  "SERIEA",
  "TENNIS",
  "LCK",
  "LEC",
  "RLCS",
];
export type HotEvent = {
  game: SportsGame;
  reason: string;
  icon: string;
  score: number;
  group: string;
};

const localDay = (ms: number) => {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

/** Calendar-only events retain their published day, independent of the viewer's timezone. */
export function hotEventCalendarParts(game: SportsGame, locale: string) {
  const date = new Date(game.dateOnly ? `${game.dateOnly}T12:00:00Z` : game.startMs);
  return {
    dateTime: game.dateOnly || date.toISOString(),
    day: game.dateOnly ? date.getUTCDate() : date.getDate(),
    month: date.toLocaleDateString(locale, {
      month: "short",
      ...(game.dateOnly ? { timeZone: "UTC" } : {}),
    }),
  };
}

/** Editorial signals from schedule metadata, never invented audience/popularity counts. */
export function hotEvents(
  games: SportsGame[],
  now: number,
  follows: (game: SportsGame) => boolean = () => false,
): HotEvent[] {
  const candidates = eventCards(
    games.filter(
      (game) =>
        Number.isFinite(game.startMs) &&
        game.state !== "post" &&
        (game.state === "in"
          ? game.savedAt === undefined && game.startMs > now - 86400000
          : game.dateOnly
            ? game.dateOnly >= localDay(now)
            : game.startMs >= now) &&
        game.startMs < now + 30 * 86400000,
    ),
  )
    .map((game) => {
      const group = hubLeague(game.league)?.group || "other";
      const title = `${game.context?.name || ""} ${game.context?.round || ""} ${game.detail}`;
      let reason = "In the spotlight",
        icon = "flame",
        score = 10;
      if (
        game.context?.major ||
        /\b(?:grand final|finals|championship|world cup|super bowl)\b|(?:^|\s)final(?:\s|$)/i.test(
          title,
        )
      ) {
        reason = "Championship stage";
        icon = "trophy";
        score += 55;
      } else if (game.league === "UFC" && /^UFC\s+\d+\b/i.test(title)) {
        reason = "Numbered UFC event";
        icon = "combat";
        score += 48;
      } else if (game.league === "F1") {
        reason = "Grand Prix weekend";
        icon = "motorsport";
        score += 42;
      } else if (["boxing", "combat"].includes(group)) {
        reason = "Fight night";
        icon = "boxing";
        score += 30;
      } else if (["UCL", "NFL", "NBA"].includes(game.league)) score += 20;
      if (follows(game)) {
        score += 18;
        if (reason === "In the spotlight") {
          reason = "Your team";
          icon = "crown";
        }
      }
      if (game.state === "in") {
        score += 28;
        reason = "Live now";
      }
      const days = Math.max(0, (game.startMs - now) / 86400000);
      score += Math.max(0, 14 - days);
      return { game, reason, icon, score, group };
    })
    .sort(
      (a, b) =>
        b.score - a.score || a.game.startMs - b.game.startMs || a.game.id.localeCompare(b.game.id),
    );
  // A full slate in one league must not crowd every other sport off the page.
  const counts = new Map<string, number>();
  return candidates
    .filter((item) => {
      const count = counts.get(item.group) || 0;
      counts.set(item.group, count + 1);
      return count < 6;
    })
    .slice(0, 24);
}
