import type { SportsGame, SportsSide } from "./espn-types";

export function hasUsefulScoreBreakdown(game: SportsGame, sport: string): boolean {
  if (game.state === "pre") return false;
  if (["motorsport", "golf", "cricket"].includes(sport)) return true;
  if (
    ![
      "tennis",
      "volleyball",
      "badminton",
      "tabletennis",
      "pickleball",
      "baseball",
      "softball",
      "basketball",
      "football",
      "hockey",
    ].includes(sport)
  )
    return false;
  if (
    sport === "tennis" &&
    (game.home.currentPoint !== undefined || game.away.currentPoint !== undefined)
  )
    return true;
  const sides = [game.home, game.away];
  if (!sides.some((side) => side.periods?.length)) return false;
  return !sides.every((side) => side.periods?.length === 1 && side.periods[0].value === side.score);
}

export function publishedScore(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (value && typeof value === "object") {
    const row = value as Record<string, unknown>;
    return publishedScore(row.displayValue ?? row.value);
  }
  return "";
}

/** Preserve published periods and tennis service information; never infer point scores. */
export function publishedScoreDetail(
  raw?: Record<string, unknown>,
  group?: string,
): Pick<SportsSide, "periods" | "currentPoint" | "serving"> {
  const periods = Array.isArray(raw?.linescores)
    ? raw.linescores.slice(0, 30).flatMap((line, index) => {
        if (!line || typeof line !== "object") return [];
        const value = publishedScore(line.displayValue ?? line.value);
        if (!value) return [];
        return [
          {
            period: Number(line.period) > 0 ? Number(line.period) : index + 1,
            value,
            winner: typeof line.winner === "boolean" ? line.winner : undefined,
            tiebreak: publishedScore(line.tiebreak) || undefined,
          },
        ];
      })
    : undefined;
  return {
    periods: periods?.length ? periods : undefined,
    currentPoint: group === "tennis" ? publishedScore(raw?.currentScore) || undefined : undefined,
    serving:
      group === "tennis" && typeof raw?.possession === "boolean" ? raw.possession : undefined,
  };
}

export const SET_SPORTS = ["tennis", "volleyball", "badminton", "tabletennis", "pickleball"];

export function isSetSport(group: string | undefined): boolean {
  return !!group && SET_SPORTS.includes(group);
}

export function scoreMetric(group: string): string {
  if (["tennis", "volleyball"].includes(group)) return "Sets won";
  if (["badminton", "tabletennis", "pickleball"].includes(group)) return "Games won";
  if (group === "snooker") return "Frames";
  if (group === "cricket") return "Runs / wickets";
  if (["baseball", "softball"].includes(group)) return "Runs";
  if (["soccer", "hockey", "fieldhockey", "handball", "lacrosse"].includes(group)) return "Goals";
  if (["basketball", "football", "rugby", "aussie", "netball"].includes(group)) return "Points";
  if (group === "motorsport") return "Position";
  return "Score";
}
