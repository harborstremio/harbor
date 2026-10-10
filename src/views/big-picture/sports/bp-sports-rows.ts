import { getLeagueLabel, sortGames, type SportsGame } from "@/lib/sports/espn";
import type { HotEvent } from "@/lib/sports/hot-events";
import { hubLeague } from "@/lib/sports/hub-data";
import { diverseEvents } from "@/lib/sports/hub-discovery";
import type { BpSportsRowModel } from "./bp-sports-types";

export type BpSportsT = (key: string, vars?: Record<string, string | number>) => string;

const HOT_REASONS = new Set([
  "Championship stage",
  "Numbered UFC event",
  "Grand Prix weekend",
  "Fight night",
  "Your team",
  "Live now",
]);

const reasonKey = (reason: string): string =>
  HOT_REASONS.has(reason) ? reason : "In the spotlight";

const reasonLabel = (reason: string, t: BpSportsT): string => {
  if (reason === "Championship stage") return t("Championship stage");
  if (reason === "Numbered UFC event") return t("Numbered UFC event");
  if (reason === "Grand Prix weekend") return t("Grand Prix weekend");
  if (reason === "Fight night") return t("Fight night");
  if (reason === "Your team") return t("Your team");
  if (reason === "Live now") return t("Live now");
  return t("In the spotlight");
};

export function bpSportsLeagueRows(games: SportsGame[], prefix: string): BpSportsRowModel[] {
  const byLeague = new Map<string, SportsGame[]>();
  for (const game of games) {
    const held = byLeague.get(game.league);
    if (held) held.push(game);
    else byLeague.set(game.league, [game]);
  }
  return [...byLeague.entries()]
    .map(([tag, list]) => {
      const def = hubLeague(tag);
      return {
        key: `${prefix}:${tag}`,
        title: def ? getLeagueLabel(def) : tag,
        games: sortGames(list),
        live: list.some((game) => game.state === "in"),
      };
    })
    .sort(
      (a, b) =>
        Number(b.live) - Number(a.live) ||
        b.games.length - a.games.length ||
        a.title.localeCompare(b.title),
    )
    .map(({ key, title, games: rowGames }) => ({ key, title, games: rowGames }));
}

export type BpSportsForYouInput = {
  t: BpSportsT;
  live: SportsGame[];
  following: SportsGame[];
  coming: SportsGame[];
  fights: SportsGame[];
  esports: SportsGame[];
  dayGames: SportsGame[];
  pitchGame: SportsGame | null;
  dateTitle: string;
  otherDay: boolean;
  showFights: boolean;
  showEsports: boolean;
};

export function bpSportsForYouRows(input: BpSportsForYouInput): BpSportsRowModel[] {
  const { t } = input;
  const saved = input.live.length > 0 && input.live.every((game) => game.savedAt !== undefined);
  return [
    {
      key: "live",
      title: saved ? t("Latest saved scores") : t("Live now"),
      description: t("The action happening across your sports."),
      games: sortGames(input.live),
    },
    {
      key: "your-teams",
      title: t("Your teams"),
      games: sortGames(input.following.filter((game) => game.state !== "post")),
    },
    {
      key: "day",
      title: input.dateTitle,
      games: input.otherDay ? sortGames(input.dayGames) : [],
    },
    {
      key: "coming",
      title: t("Coming up"),
      description: t("Clear your calendar. These are worth a look."),
      games: diverseEvents(input.coming),
    },
    {
      key: "fights",
      title: t("Fight nights"),
      description: t("The headline events. The full card. The next big matchup."),
      games: input.showFights ? input.fights : [],
    },
    {
      key: "pitch",
      title: t("On the pitch"),
      description: t("The shape of the game. Explore the announced lineup."),
      games: input.pitchGame ? [input.pitchGame] : [],
    },
    {
      key: "esports",
      title: t("Esports"),
      games: input.showEsports ? sortGames(input.esports) : [],
    },
    {
      key: "today",
      title: input.dateTitle,
      games: input.otherDay ? [] : sortGames(input.dayGames),
    },
  ];
}

export function bpSportsHotRows(events: HotEvent[], t: BpSportsT): BpSportsRowModel[] {
  const byReason = new Map<string, HotEvent[]>();
  for (const event of events) {
    const key = reasonKey(event.reason);
    const held = byReason.get(key);
    if (held) held.push(event);
    else byReason.set(key, [event]);
  }
  const groups = [...byReason.entries()]
    .map(([reason, list]) => ({
      reason,
      list,
      top: list.reduce((best, event) => Math.max(best, event.score), 0),
    }))
    .sort((a, b) => b.top - a.top)
    .map((entry) => ({
      key: `hot:${entry.reason}`,
      title: reasonLabel(entry.reason, t),
      games: entry.list.map((event) => event.game),
    }));
  return [
    {
      key: "hot:top",
      title: t("Hot right now"),
      description: t("The events people are turning up for."),
      games: events.slice(0, 12).map((event) => event.game),
    },
    ...groups,
  ];
}
