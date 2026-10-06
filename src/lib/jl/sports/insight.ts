/**
 * Pre-game insight from ESPN's game summary (records, ESPN's projection, season leaders, injuries)
 * and athlete pages (a followed player's season line). Plain parsers, no I/O.
 */

type Rec = Record<string, unknown>;

export type InsightLeader = { category: string; athlete: string; athleteId: string | null; value: string };

export type InsightSide = {
  teamId: string;
  abbr: string;
  record: string | null;
  /** ESPN's projected chance to win, 0–100. */
  winChance: number | null;
  leaders: InsightLeader[];
  injuries: Array<{ athlete: string; athleteId: string | null; status: string }>;
};

export type PregameInsight = { away: InsightSide | null; home: InsightSide | null };

export type PlayerLine = { name: string; teamName: string | null; stats: Array<{ label: string; value: string }> };

const rec = (v: unknown): Rec => (v && typeof v === "object" ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function chance(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null;
}

export function parsePregame(summary: unknown): PregameInsight {
  const d = rec(summary);
  const comp = arr(rec(d.header).competitions)[0];
  const competitors = arr(comp?.competitors);
  const predictor = rec(d.predictor);
  const leadersByTeam = new Map<string, InsightLeader[]>();
  for (const t of arr(d.leaders)) {
    const id = str(rec(t.team).id);
    if (!id) continue;
    const items: InsightLeader[] = [];
    for (const cat of arr(t.leaders)) {
      const top = arr(cat.leaders)[0];
      const athlete = rec(top?.athlete);
      const name = str(athlete.displayName);
      const value = str(top?.displayValue);
      const category = str(cat.displayName);
      if (name && value && category) items.push({ category, athlete: name, athleteId: str(athlete.id), value });
    }
    leadersByTeam.set(id, items.slice(0, 3));
  }
  const injuriesByTeam = new Map<string, InsightSide["injuries"]>();
  for (const t of arr(d.injuries)) {
    const id = str(rec(t.team).id);
    if (!id) continue;
    injuriesByTeam.set(
      id,
      arr(t.injuries)
        .map((i) => {
          const athlete = rec(i.athlete);
          const name = str(athlete.displayName);
          const status = str(i.status) ?? str(rec(i.type).description);
          return name && status ? { athlete: name, athleteId: str(athlete.id), status } : null;
        })
        .filter((i): i is InsightSide["injuries"][number] => !!i),
    );
  }
  const side = (homeAway: "home" | "away"): InsightSide | null => {
    const c = competitors.find((x) => x.homeAway === homeAway);
    const team = rec(c?.team);
    const teamId = str(team.id);
    if (!c || !teamId) return null;
    const records = arr(c.record ?? c.records);
    const total = records.find((r) => r.type === "total") ?? records[0];
    return {
      teamId,
      abbr: str(team.abbreviation) ?? "",
      record: str(total?.summary) ?? str(total?.displayValue),
      winChance: chance(rec(predictor[homeAway === "home" ? "homeTeam" : "awayTeam"]).gameProjection),
      leaders: leadersByTeam.get(teamId) ?? [],
      injuries: (injuriesByTeam.get(teamId) ?? []).slice(0, 6),
    };
  };
  return { away: side("away"), home: side("home") };
}

export function parsePlayerLine(athleteDoc: unknown): PlayerLine | null {
  const a = rec(rec(athleteDoc).athlete);
  const name = str(a.displayName);
  if (!name) return null;
  return {
    name,
    teamName: str(rec(a.team).displayName),
    stats: arr(rec(a.statsSummary).statistics)
      .map((s) => ({ label: str(s.displayName) ?? str(s.shortDisplayName) ?? "", value: str(s.displayValue) ?? "" }))
      .filter((s) => s.label && s.value)
      .slice(0, 4),
  };
}

/** Injury report lines that concern a followed player, by id or exact name. */
export function followedInjuries(
  insight: PregameInsight,
  players: Array<{ id: string; name: string }>,
): Array<{ athlete: string; status: string }> {
  const sides = [insight.away, insight.home].filter((s): s is InsightSide => !!s);
  return sides.flatMap((s) =>
    s.injuries.filter((i) => players.some((p) => (i.athleteId ? i.athleteId === p.id : i.athlete === p.name))),
  );
}
