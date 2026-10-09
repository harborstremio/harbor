import type { BaseballSituation, MatchPlayer } from "./espn-types";

export function parseBaseballSituation(raw: unknown): BaseballSituation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const data = raw as Record<string, unknown>;
  const count = (key: string, max: number) => {
    const value = data[key];
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= max
      ? value
      : undefined;
  };
  const playerId = (key: string) => {
    const player = data[key] as { playerId?: unknown } | undefined;
    return player && (typeof player.playerId === "string" || typeof player.playerId === "number")
      ? String(player.playerId)
      : undefined;
  };
  return {
    balls: count("balls", 4),
    strikes: count("strikes", 3),
    outs: count("outs", 3),
    pitcherId: playerId("pitcher"),
    batterId: playerId("batter"),
    onFirstId: playerId("onFirst"),
    onSecondId: playerId("onSecond"),
    onThirdId: playerId("onThird"),
  };
}

export const BASEBALL_POSITIONS = [
  { key: "LF", x: 22, y: 28 },
  { key: "CF", x: 50, y: 18 },
  { key: "RF", x: 78, y: 28 },
  { key: "SS", x: 36, y: 46 },
  { key: "2B", x: 64, y: 46 },
  { key: "3B", x: 22, y: 63 },
  { key: "1B", x: 78, y: 63 },
  { key: "P", x: 50, y: 61 },
  { key: "C", x: 50, y: 87 },
] as const;

function positionOf(player: MatchPlayer) {
  const position = player.position.toUpperCase();
  return ["SP", "RP", "CP"].includes(position) ? "P" : position;
}

/** Explicit active flags take precedence over starters, who may have left the game. */
export function baseballDefense(
  roster: MatchPlayer[],
  state: "pre" | "in" | "post",
  pitcherId?: string,
) {
  const hasActive = state !== "pre" && roster.some((player) => player.active !== undefined);
  return BASEBALL_POSITIONS.map((position) => {
    const candidates = roster.filter((player) => positionOf(player) === position.key);
    const player =
      position.key === "P" && pitcherId
        ? roster.find((player) => player.id === pitcherId)
        : undefined;
    return {
      ...position,
      player:
        player ??
        candidates.find((player) =>
          hasActive ? player.active === true : player.starter && !player.substitutedOut,
        ),
    };
  });
}

export function baseballBattingOrder(roster: MatchPlayer[], state: "pre" | "in" | "post") {
  const hasActive = state !== "pre" && roster.some((player) => player.active !== undefined);
  return roster
    .filter(
      (player) =>
        player.batOrder &&
        player.batOrder <= 9 &&
        (hasActive ? player.active === true : player.starter),
    )
    .sort((a, b) => a.batOrder! - b.batOrder!);
}
