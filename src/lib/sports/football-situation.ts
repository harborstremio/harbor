import type { FootballSituation, MatchEvent } from "./espn-types";

type FeedRow = Record<string, any>;
const rows = (value: unknown): FeedRow[] =>
  Array.isArray(value) ? value.filter((row) => row && typeof row === "object") : [];
const number = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined;
const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;
const id = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim()
    ? value
    : typeof value === "number" && Number.isFinite(value)
      ? String(value)
      : undefined;

function orderedPlays(input: FeedRow[]): FeedRow[] {
  const unique = new Map<string, FeedRow>();
  for (const play of input) {
    if (!text(play.text) && !text(play.shortText)) continue;
    const key =
      id(play.id) ??
      `${play.period?.number ?? ""}|${play.clock?.displayValue ?? ""}|${play.text ?? play.shortText}`;
    unique.set(key, { ...play, id: key });
  }
  return [...unique.values()].sort((a, b) => {
    const aSequence = Number(a.sequenceNumber),
      bSequence = Number(b.sequenceNumber);
    if (Number.isFinite(aSequence) && Number.isFinite(bSequence)) return aSequence - bSequence;
    const period = (number(a.period?.number, 1, 20) ?? 0) - (number(b.period?.number, 1, 20) ?? 0);
    if (period) return period;
    const seconds = (p: FeedRow) => {
      const match = /^(\d+):(\d{2})$/.exec(p.clock?.displayValue ?? "");
      return match ? Number(match[1]) * 60 + Number(match[2]) : undefined;
    };
    const aClock = seconds(a),
      bClock = seconds(b);
    return aClock !== undefined && bClock !== undefined ? bClock - aClock : 0;
  });
}

/** ESPN repeats the current drive in previous; keep corrected plays once, in game order. */
export function parseFootballEvents(data: FeedRow): MatchEvent[] {
  const plays = rows(data.drives?.previous).flatMap((drive) => rows(drive.plays));
  plays.push(...rows(data.drives?.current?.plays));
  const drivePlays = orderedPlays(plays);
  const ordered = drivePlays.length ? drivePlays : orderedPlays(rows(data.scoringPlays));
  return ordered.slice(-80).map((play) => {
    const period = number(play.period?.number, 1, 20);
    const periodText = period ? (period <= 4 ? `Q${period}` : `OT${period - 4}`) : "";
    return {
      id: String(play.id),
      time: [periodText, text(play.clock?.displayValue)].filter(Boolean).join(" · "),
      type: "other",
      text: text(play.text) ?? text(play.shortText) ?? "",
      teamId:
        id(play.team?.id) ??
        id(rows(play.teamParticipants).find((team) => team.type === "offense")?.id) ??
        id(play.start?.team?.id),
      participantName: text(play.participants?.[0]?.athlete?.displayName),
    };
  });
}

/** A reported end-of-play state is a snapshot, never a projection of live player movement. */
export function parseFootballSituation(data: FeedRow): FootballSituation | undefined {
  const header = data.header?.competitions?.[0];
  if (header?.status?.type?.state !== "in") return undefined;
  const direct = data.situation ?? header?.situation;
  const lastPlay = orderedPlays(rows(data.drives?.current?.plays)).at(-1);
  const value = direct ?? lastPlay?.end;
  if (!value) return undefined;
  const down = number(value.down, 1, 4);
  // Touchdowns, kickoffs and timeouts can carry down -1/0 and obsolete field coordinates.
  // Do not revive the preceding down after the possession has ended.
  if (down === undefined) return undefined;
  return {
    source: direct ? "situation" : "last-play",
    down,
    distance: number(value.distance, 0, 100),
    possessionTeamId: id(value.possession?.id) ?? id(value.possession) ?? id(value.team?.id),
    yardLine: number(value.yardLine, 0, 100),
    yardLineText: text(value.possessionText),
    clock: text(direct ? header?.status?.displayClock : lastPlay?.clock?.displayValue),
    period: number(direct ? header?.status?.period : lastPlay?.period?.number, 1, 20),
    lastPlayId: direct ? undefined : id(lastPlay?.id),
  };
}
