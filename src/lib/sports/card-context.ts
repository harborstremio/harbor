import type { SportsGame } from "./espn-types";

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
const text = (value: unknown, max = 180) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

/** Read the provider's overall record, not a home/away split or a computed prediction. */
export function publishedSideContext(competitor: Raw | undefined): {
  record?: string;
  rank?: number;
} {
  const records = Array.isArray(competitor?.records)
    ? competitor.records.slice(0, 12).map(record)
    : [];
  const overall = records.find((item) => item.type === "total" || item.name === "overall");
  const summary = text(overall?.summary, 40);
  const rank = Number(record(competitor?.curatedRank).current);
  return {
    record: summary || undefined,
    // ESPN uses99 as its unranked college sentinel; curated polls contain the top25.
    rank: Number.isInteger(rank) && rank > 0 && rank <= 25 ? rank : undefined,
  };
}

export type CardContextRow =
  | { kind: "stage" | "venue" | "broadcast"; value: string }
  | { kind: "start"; value: number };

/** Metadata already on the scoreboard can fill a card without per-card requests. */
export function matchCardContext(game: SportsGame, now = Date.now()): CardContextRow[] {
  const stage = [text(game.context?.round), text(game.context?.draw)].filter(
    (value) => value && !/^(?:standard|std|regular season|0|\d{1,2})$/i.test(value),
  );
  const venue = text(game.context?.venue);
  const channels = [
    ...new Set((game.broadcasts ?? []).map((name) => text(name, 80)).filter(Boolean)),
  ].slice(0, 3);
  const rows: CardContextRow[] = [];
  if (stage.length) rows.push({ kind: "stage", value: [...new Set(stage)].join(" · ") });
  if (venue) rows.push({ kind: "venue", value: venue });
  if (channels.length) rows.push({ kind: "broadcast", value: channels.join(" · ") });
  if (
    !rows.length &&
    game.dateOnly === undefined &&
    game.state === "pre" &&
    Number.isFinite(game.startMs) &&
    game.startMs > now
  )
    rows.push({ kind: "start", value: game.startMs });
  return rows;
}

export function relativeCardStart(startMs: number, locale: string, now = Date.now()): string {
  const minutes = Math.max(1, Math.ceil((startMs - now) / 60000));
  const [value, unit] =
    minutes < 60
      ? ([minutes, "minute"] as const)
      : minutes < 1440
        ? ([Math.round(minutes / 60), "hour"] as const)
        : ([Math.round(minutes / 1440), "day"] as const);
  return new Intl.RelativeTimeFormat(locale, { numeric: "always" }).format(value, unit);
}
