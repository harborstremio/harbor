import type { SportsGame } from "./espn-types";

export type FightSection = "Main card" | "Prelims" | "Early prelims" | "Fight card";
export type FightInfo = {
  section: FightSection;
  order: number;
  weight: string;
};
export function parseFightInfo(raw: any): FightInfo {
  const name = String(raw.cardSegment?.name ?? "").toLowerCase();
  const description = String(raw.cardSegment?.description ?? "").toLowerCase();
  return {
    section:
      name === "prelims2" || description.includes("early")
        ? "Early prelims"
        : name === "prelims" || description.includes("prelim")
          ? "Prelims"
          : name === "main" || description.includes("main")
            ? "Main card"
            : "Fight card",
    order: Number(raw.matchNumber) || 99,
    weight: String(raw.type?.text ?? raw.type?.abbreviation ?? ""),
  };
}

/** A bout remains its own playable detail; schedule cards count the parent event once. */
export function scheduleEvents(games: SportsGame[]): SportsGame[][] {
  const groups = new Map<string, SportsGame[]>();
  for (const game of games) {
    const key =
      ["UFC", "PFL", "BELL", "LFA"].includes(game.league) && game.context?.id
        ? `${game.league}:${game.context.id}`
        : `${game.league}:${game.id}`;
    const group = groups.get(key);
    if (group) {
      if (!group.some((item) => item.id === game.id)) group.push(game);
    } else groups.set(key, [game]);
  }
  return [...groups.values()];
}
