import type {
  MatchPlayer,
  MatchPlayerStatTable,
  MatchPartnershipTable,
  MatchTeamStatRow,
  SportsSide,
} from "./espn-types";

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {};
const rows = (v: unknown, cap = 200): Raw[] => (Array.isArray(v) ? v.slice(0, cap).map(obj) : []);
const text = (v: unknown): string =>
  typeof v === "string"
    ? v.trim().slice(0, 300)
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";
const values = (v: unknown): string[] => (Array.isArray(v) ? v.slice(0, 40).map(text) : []);
const statValue = (v: Raw) => text(v.displayValue) || text(v.value) || "—";

/** Join both teams by category/name; one-sided data and numeric zero stay intact. */
export function parseTeamStatRows(home: unknown, away: unknown): MatchTeamStatRow[] {
  const flatten = (box: unknown) => {
    const out = new Map<string, { label: string; value: string }>();
    const visit = (items: unknown, prefix = "", depth = 0) => {
      if (depth > 4 || out.size >= 200) return;
      for (const stat of rows(items)) {
        const name = text(stat.name) || text(stat.label) || text(stat.displayName);
        if (!name) continue;
        const key = `${prefix}/${name}`;
        if (Array.isArray(stat.stats)) visit(stat.stats, key, depth + 1);
        else
          out.set(key, {
            label: text(stat.label) || text(stat.displayName) || name,
            value: statValue(stat),
          });
      }
    };
    visit(obj(box).statistics);
    return out;
  };
  const h = flatten(home),
    a = flatten(away);
  return [...new Set([...h.keys(), ...a.keys()])].slice(0, 200).map((key) => ({
    label: (h.get(key) || a.get(key))!.label,
    homeValue: h.get(key)?.value ?? "—",
    awayValue: a.get(key)?.value ?? "—",
  }));
}

/** ESPN's column/athlete box-score format is shared by team sports, not just the US big four. */
export function parsePlayerStatTables(boxscore: unknown): MatchPlayerStatTable[] {
  const tables: MatchPlayerStatTable[] = [];
  for (const team of rows(obj(boxscore).players, 4)) {
    const teamId = text(obj(team.team).id);
    if (!teamId) continue;
    for (const category of rows(team.statistics, 30)) {
      const labels = values(category.labels);
      if (!labels.length || labels.some((label) => !label)) continue;
      const descriptions = values(category.descriptions);
      const seen = new Set<string>();
      const entries = rows(category.athletes).flatMap((entry) => {
        const athlete = obj(entry.athlete),
          id = text(athlete.id),
          name = text(athlete.displayName) || text(athlete.fullName);
        if (
          !id ||
          !name ||
          seen.has(id) ||
          !Array.isArray(entry.stats) ||
          entry.didNotPlay === true
        )
          return [];
        seen.add(id);
        const stats = values(entry.stats),
          position = obj(entry.position || athlete.position);
        const portrait = text(obj(athlete.headshot).href);
        const player: MatchPlayer = {
          id,
          name,
          jersey: text(entry.jersey || athlete.jersey),
          position:
            text(position.abbreviation) || text(position.displayName) || text(position.name),
          starter: entry.starter === true,
          active: typeof entry.active === "boolean" ? entry.active : undefined,
          substitutedIn: false,
          substitutedOut: false,
          goals: 0,
          yellowCards: 0,
          redCards: 0,
          image: /^https:\/\//i.test(portrait) ? portrait : undefined,
        };
        return [{ player, values: labels.map((_, i) => stats[i] || "—") }];
      });
      if (entries.length)
        tables.push({
          teamId,
          name: text(category.text) || text(category.displayName) || text(category.name),
          labels,
          descriptions: labels.map((label, i) => descriptions[i] || label),
          rows: entries,
        });
    }
  }
  return tables;
}

/** Cricket publishes innings cards outside boxscore.players. Keep each innings separate. */
export function parseCricketPlayerTables(
  raw: unknown,
  teams: { side: SportsSide; roster: MatchPlayer[] }[],
): MatchPlayerStatTable[] {
  const cards: MatchPlayerStatTable[] = rows(obj(raw).matchcards, 12).flatMap((card) => {
    const team = teams.find((item) =>
      [item.side.abbr, item.side.name].filter(Boolean).includes(text(card.teamName)),
    );
    if (!team) return [];
    const batting = text(card.headline).toLowerCase() === "batting";
    if (!batting && text(card.headline).toLowerCase() !== "bowling") return [];
    const keys = batting
      ? ["runs", "ballsFaced", "fours", "sixes", "dismissal"]
      : ["overs", "maidens", "conceded", "wickets", "economyRate"];
    const labels = batting
      ? ["Runs", "Balls faced", "Fours", "Sixes", "Dismissal"]
      : ["Overs", "Maidens", "Runs conceded", "Wickets", "Economy"];
    const seen = new Set<string>();
    const players = rows(card.playerDetails, 30).flatMap((entry) => {
      const player = team.roster.find((item) => item.id === text(entry.playerID));
      if (!player || seen.has(player.id)) return [];
      seen.add(player.id);
      return [{ player, values: keys.map((key) => text(entry[key]) || "—") }];
    });
    const innings = Number(card.inningsNumber);
    return players.length
      ? [
          {
            teamId: team.side.id,
            name: batting ? "Batting" : "Bowling",
            innings: Number.isInteger(innings) && innings > 0 && innings <= 4 ? innings : undefined,
            summary: text(card.total) || undefined,
            labels,
            descriptions: labels,
            rows: players,
          },
        ]
      : [];
  });
  // Summary matchcards may contain only the latest innings. The roster's published
  // per-innings categories retain earlier batting/bowling; never infer participation
  // from a zero-filled roster or reuse one innings' figures for another.
  const tables = new Map<string, MatchPlayerStatTable>();
  const tableKey = (table: MatchPlayerStatTable) =>
    `${table.teamId}:${table.innings ?? "unknown"}:${table.name}`;
  for (const card of cards) {
    const key = tableKey(card),
      existing = tables.get(key);
    if (!existing) tables.set(key, card);
    else
      for (const row of card.rows)
        if (!existing.rows.some((item) => item.player.id === row.player.id))
          existing.rows.push(row);
  }
  for (const roster of rows(obj(raw).rosters, 4)) {
    const team = teams.find((item) => item.side.id === text(obj(roster.team).id));
    if (!team) continue;
    const ordered = new Map<string, { player: MatchPlayer; values: string[]; order: number }[]>();
    for (const entry of rows(roster.roster, 40)) {
      const player = team.roster.find((item) => item.id === text(obj(entry.athlete).id));
      if (!player) continue;
      for (const line of rows(entry.linescores, 4)) {
        const stats = new Map<string, Raw>();
        for (const category of rows(obj(line.statistics).categories, 12)) {
          for (const stat of rows(category.stats, 100)) {
            const name = text(stat.name);
            if (name) stats.set(name, stat);
          }
        }
        const innings = Number(text(stats.get("inningsNumber")?.value) || text(line.period));
        if (!Number.isInteger(innings) || innings < 1 || innings > 4) continue;
        if (line.period != null && Number(line.period) !== innings) continue;
        for (const batting of [true, false]) {
          const participated = stats.get(batting ? "batted" : "inningsBowled")?.value;
          if (Number(participated) !== 1) continue;
          const name = batting ? "Batting" : "Bowling";
          const keys = batting
            ? ["runs", "ballsFaced", "fours", "sixes", "dismissalCard"]
            : ["overs", "maidens", "conceded", "wickets", "economyRate"];
          const labels = batting
            ? ["Runs", "Balls faced", "Fours", "Sixes", "Dismissal"]
            : ["Overs", "Maidens", "Runs conceded", "Wickets", "Economy"];
          const key = `${team.side.id}:${innings}:${name}`;
          if (!tables.has(key))
            tables.set(key, {
              teamId: team.side.id,
              name,
              innings,
              labels,
              descriptions: labels,
              rows: [],
            });
          const order = Number(stats.get(batting ? "battingPosition" : "bowlingPosition")?.value);
          const bucket = ordered.get(key) ?? [];
          if (!bucket.some((row) => row.player.id === player.id))
            bucket.push({
              player,
              values: keys.map((key) => statValue(stats.get(key) ?? {})),
              order: Number.isFinite(order) && order > 0 ? order : 100,
            });
          ordered.set(key, bucket);
        }
      }
    }
    for (const [key, entries] of ordered) {
      const table = tables.get(key)!;
      for (const { player, values } of entries.sort((a, b) => a.order - b.order)) {
        if (!table.rows.some((row) => row.player.id === player.id))
          table.rows.push({ player, values });
      }
    }
  }
  return [...tables.values()]
    .filter((table) => table.rows.length)
    .sort(
      (a, b) =>
        (a.innings ?? 5) - (b.innings ?? 5) ||
        Number(a.name === "Bowling") - Number(b.name === "Bowling"),
    );
}

/** The provider identifies partnership batters by display name only: keep plain text,
 * rather than guess player IDs or turn their individual contribution into career stats. */
export function parseCricketPartnerships(
  raw: unknown,
  sides: SportsSide[],
): MatchPartnershipTable[] {
  const tables = new Map<string, MatchPartnershipTable>();
  for (const card of rows(obj(raw).matchcards, 12)) {
    if (text(card.headline).toLowerCase() !== "partnerships") continue;
    const side = sides.find((side) =>
      [side.abbr, side.name].filter(Boolean).includes(text(card.teamName)),
    );
    const innings = Number(card.inningsNumber);
    if (!side || !Number.isInteger(innings) || innings < 1 || innings > 4) continue;
    const key = `${side.id}:${innings}`,
      table = tables.get(key) ?? { teamId: side.id, innings, rows: [] };
    for (const entry of rows(card.playerDetails, 30)) {
      const first = text(entry.player1Name),
        second = text(entry.player2Name),
        wicket = text(entry.partnershipWicketName);
      if (
        !first ||
        !second ||
        !wicket ||
        table.rows.some(
          (row) =>
            row.wicket === wicket &&
            row.players[0].name === first &&
            row.players[1].name === second,
        )
      )
        continue;
      table.rows.push({
        wicket,
        runs: text(entry.partnershipRuns) || "—",
        overs: text(entry.partnershipOvers) || "—",
        players: [
          { name: first, runs: text(entry.player1Runs) || "—" },
          { name: second, runs: text(entry.player2Runs) || "—" },
        ],
      });
    }
    if (table.rows.length) tables.set(key, table);
  }
  return [...tables.values()].sort((a, b) => a.innings - b.innings);
}
