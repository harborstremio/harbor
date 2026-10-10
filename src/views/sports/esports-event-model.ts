import type { Bo3Tournament } from "@/lib/sports/esports-bo3-api";
import type { EsportsFeed } from "@/lib/sports/esports-feeds";
import { normalizeSeriesName, type SeriesCandidate } from "@/lib/sports/esports-series";

export interface EsportsEventTeam {
  id: string;
  name: string;
  logo?: string;
}

/** One tournament, assembled from the feeds already on screen. Also the event page's input. */
export interface EsportsEventSummary extends SeriesCandidate {
  /** Every provider event id folded into this tournament, so its matches stay findable. */
  eventIds: string[];
  logo?: string;
  location?: { city?: string; country?: string; venue?: string };
  teams: EsportsEventTeam[];
  matchCount: number;
  liveCount: number;
  /** bo3 event_level. "major" is a headline fact its letter tier does not carry. */
  level?: string;
  /** Set by the card that opened the page, so the page does not re-rank to learn one chip. */
  tierChip?: string;
  /** Only Liquipedia states a currency. The provider figure is shown as a bare number. */
  prizeCurrency?: "USD";
  sourceUrl?: string;
}

const MAX_TEAMS = 12;

/**
 * Tournaments are folded on the normalised name, not the provider event id: Riot publishes one
 * tournament id per split, so keying on the id lists the same league several times over.
 */
export function esportsEventSummaries(
  feeds: readonly (EsportsFeed | undefined)[],
  cs2Tournaments: readonly Bo3Tournament[] = [],
): EsportsEventSummary[] {
  const groups = new Map<string, EsportsEventSummary & { recentCount: number }>();
  for (const feed of feeds) {
    for (const match of feed?.matches ?? []) {
      const name = match.event.name.trim();
      if (!name) continue;
      const key = `${match.game}:${normalizeSeriesName(name)}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          id: key,
          game: match.game,
          name,
          eventIds: [],
          teams: [],
          matchCount: 0,
          liveCount: 0,
          recentCount: 0,
          status: "upcoming",
        };
        groups.set(key, group);
      }
      if (match.event.id && !group.eventIds.includes(match.event.id))
        group.eventIds.push(match.event.id);
      if (!group.logo && match.event.logo) group.logo = match.event.logo;
      group.matchCount += 1;
      if (match.state === "live") group.liveCount += 1;
      if (match.state === "recent") group.recentCount += 1;
      group.startMs = Math.min(group.startMs ?? match.startMs, match.startMs);
      group.endMs = Math.max(group.endMs ?? match.startMs, match.startMs);
      for (const team of match.teams) {
        if (!team.name || group.teams.length >= MAX_TEAMS) continue;
        if (!group.teams.some((known) => known.name === team.name))
          group.teams.push({ id: team.id, name: team.name, logo: team.logo });
      }
    }
  }
  // A bo3 id is unique inside bo3 only, and OpenDota league ids are numeric too, so the join is
  // limited to the title the tournament list was actually requested for.
  const byId = new Map(cs2Tournaments.map((row) => [row.id, row]));
  return [...groups.values()].map(({ recentCount, ...group }) => {
    const summary: EsportsEventSummary = {
      ...group,
      status:
        group.liveCount > 0
          ? "live"
          : recentCount === group.matchCount
            ? "completed"
            : "upcoming",
    };
    const tournament =
      summary.game === "cs2"
        ? summary.eventIds.map((id) => byId.get(id)).find(Boolean)
        : undefined;
    if (!tournament) return summary;
    return {
      ...summary,
      name: tournament.name || summary.name,
      logo: tournament.logo || summary.logo,
      startMs: tournament.startMs ?? summary.startMs,
      endMs: tournament.endMs ?? summary.endMs,
      prize: tournament.prize ? { totalUsd: tournament.prize } : summary.prize,
      tier: tournament.tier ? { publisher: tournament.tier } : summary.tier,
      level: tournament.level,
      sourceUrl: tournament.sourceUrl,
    };
  });
}

/** Compact on a card, and never labelled USD unless a source said so. */
export function esportsPrizeLabel(
  prize: number | undefined,
  currency: "USD" | undefined,
  locale: string,
): string {
  if (!prize || prize <= 0) return "";
  return new Intl.NumberFormat(
    locale,
    currency
      ? { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 }
      : { notation: "compact", maximumFractionDigits: 1 },
  ).format(prize);
}

export function esportsEventDateRange(
  startMs: number | undefined,
  endMs: number | undefined,
  locale: string,
  withYear = false,
): string {
  if (startMs === undefined) return "";
  const start = new Date(startMs);
  const end = endMs === undefined ? start : new Date(endMs);
  const day = withYear
    ? ({ year: "numeric", month: "short", day: "numeric" } as const)
    : ({ month: "short", day: "numeric" } as const);
  if (end.toDateString() === start.toDateString()) return start.toLocaleDateString(locale, day);
  const sameMonth =
    end.getMonth() === start.getMonth() && end.getFullYear() === start.getFullYear();
  const from = start.toLocaleDateString(
    locale,
    withYear && end.getFullYear() !== start.getFullYear()
      ? day
      : { month: "short", day: "numeric" },
  );
  const to = end.toLocaleDateString(locale, sameMonth && !withYear ? { day: "numeric" } : day);
  return `${from} - ${to}`;
}
