import type {
  MatchEvent,
  MatchPlayer,
  MatchTeamStatRow,
  MatchTeamStats,
  SportsGame,
  SportsMatchDetail,
} from "../espn-types";

export type Raw = Record<string, any>;
type Marks = { goals: number; yellow: number; red: number; in: boolean; out: boolean };

const STAT_LABEL: Record<string, string> = { "Ball Possession": "Possession", "Goalkeeper Saves": "Saves" };

export function idOf(value: unknown): string {
  return value == null ? "" : String(value);
}

function minuteOf(e: Raw): number {
  return Number(e.time?.elapsed ?? 0) + Number(e.time?.extra ?? 0) / 100;
}

function markEvents(events: Raw[], teamId: string, starters: Set<string>): Map<string, Marks> {
  const marks = new Map<string, Marks>();
  const at = (id: string): Marks => {
    let m = marks.get(id);
    if (!m) {
      m = { goals: 0, yellow: 0, red: 0, in: false, out: false };
      marks.set(id, m);
    }
    return m;
  };
  const onField = new Set(starters);
  const ordered = events
    .filter((e) => idOf(e.team?.id) === teamId)
    .sort((a, b) => minuteOf(a) - minuteOf(b));
  for (const e of ordered) {
    const type = String(e.type ?? "").toLowerCase();
    const detail = String(e.detail ?? "").toLowerCase();
    const pid = idOf(e.player?.id);
    const aid = idOf(e.assist?.id);
    if (type === "goal") {
      if (pid && !detail.includes("missed") && !detail.includes("own")) at(pid).goals += 1;
    } else if (type === "card") {
      if (!pid) continue;
      if (detail.includes("red")) at(pid).red += 1;
      else if (detail.includes("second")) {
        at(pid).yellow += 1;
        at(pid).red += 1;
      } else at(pid).yellow += 1;
    } else if (type === "subst") {
      const out = onField.has(pid) || !onField.has(aid) ? pid : aid;
      const inn = out === pid ? aid : pid;
      if (out) {
        at(out).out = true;
        onField.delete(out);
      }
      if (inn) {
        at(inn).in = true;
        onField.add(inn);
      }
    }
  }
  return marks;
}

function gridPlaces(starters: Raw[]): Map<string, number> {
  const parsed = starters.map((s, index) => {
    const [row, col] = String(s.player?.grid ?? "").split(":").map(Number);
    return {
      id: idOf(s.player?.id),
      row: Number.isFinite(row) ? row : 99,
      col: Number.isFinite(col) ? col : index,
    };
  });
  parsed.sort((a, b) => a.row - b.row || a.col - b.col);
  return new Map(parsed.map((p, i) => [p.id, i + 1] as const));
}

function photoMap(players: unknown): Map<string, string> {
  const out = new Map<string, string>();
  if (!Array.isArray(players)) return out;
  for (const team of players as Raw[]) {
    const list: Raw[] = Array.isArray(team?.players) ? team.players : [];
    for (const entry of list) {
      const p = entry?.player;
      if (p?.id != null && typeof p.photo === "string") out.set(String(p.id), p.photo);
    }
  }
  return out;
}

function roster(line: Raw | undefined, events: Raw[], photos: Map<string, string>): MatchPlayer[] {
  if (!line) return [];
  const starters: Raw[] = Array.isArray(line.startXI) ? line.startXI : [];
  const bench: Raw[] = Array.isArray(line.substitutes) ? line.substitutes : [];
  const places = gridPlaces(starters);
  const marks = markEvents(events, idOf(line.team?.id), new Set(places.keys()));
  const build = (entry: Raw, starter: boolean): MatchPlayer => {
    const p: Raw = entry?.player ?? {};
    const id = idOf(p.id);
    const m = marks.get(id);
    return {
      id,
      name: typeof p.name === "string" ? p.name : "",
      jersey: p.number == null ? "" : String(p.number),
      position: typeof p.pos === "string" ? p.pos : "",
      starter,
      substitutedIn: m?.in === true,
      substitutedOut: m?.out === true,
      formationPlace: starter ? places.get(id) : undefined,
      goals: m?.goals ?? 0,
      yellowCards: m?.yellow ?? 0,
      redCards: m?.red ?? 0,
      image: photos.get(id) ?? "",
    };
  };
  return [...starters.map((s) => build(s, true)), ...bench.map((s) => build(s, false))];
}

function statValue(box: Raw | undefined, type: string): string | undefined {
  const list: Raw[] = Array.isArray(box?.statistics) ? box.statistics : [];
  const hit = list.find((s) => s?.type === type);
  return hit && hit.value != null ? String(hit.value) : undefined;
}

function teamStats(box: Raw | undefined): MatchTeamStats {
  if (!box) return {};
  return {
    possession: statValue(box, "Ball Possession"),
    shots: statValue(box, "Total Shots"),
    shotsOnTarget: statValue(box, "Shots on Goal"),
    corners: statValue(box, "Corner Kicks"),
    fouls: statValue(box, "Fouls"),
    yellowCards: statValue(box, "Yellow Cards"),
    redCards: statValue(box, "Red Cards"),
  };
}

function statRows(homeBox: Raw | undefined, awayBox: Raw | undefined): MatchTeamStatRow[] {
  const list: Raw[] = Array.isArray(homeBox?.statistics) ? homeBox.statistics : [];
  const rows: MatchTeamStatRow[] = [];
  for (const stat of list) {
    const type = typeof stat?.type === "string" ? stat.type : "";
    if (!type) continue;
    const homeValue = statValue(homeBox, type);
    const awayValue = statValue(awayBox, type);
    if (homeValue == null && awayValue == null) continue;
    rows.push({ label: STAT_LABEL[type] ?? type, homeValue: homeValue ?? "0", awayValue: awayValue ?? "0" });
  }
  return rows;
}

function footballEvent(e: Raw, index: number, cameOn: Set<string>): MatchEvent {
  const kind = String(e.type ?? "").toLowerCase();
  const detail = String(e.detail ?? "");
  const lower = detail.toLowerCase();
  let type: MatchEvent["type"] = "other";
  if (kind === "goal" && !lower.includes("missed")) type = "goal";
  else if (kind === "card") type = lower.includes("red") || lower.includes("second") ? "red_card" : "yellow_card";
  else if (kind === "subst") type = "substitution";
  let player = typeof e.player?.name === "string" ? e.player.name : "";
  let assist = typeof e.assist?.name === "string" ? e.assist.name : "";
  if (type === "substitution" && cameOn.has(idOf(e.assist?.id))) [player, assist] = [assist, player];
  const extra = Number(e.time?.extra ?? 0);
  return {
    id: `${idOf(e.time?.elapsed)}-${index}`,
    time: e.time?.elapsed == null ? "" : `${e.time.elapsed}${extra > 0 ? `+${extra}` : ""}'`,
    type,
    text: assist ? `${detail} (${assist})` : detail,
    teamId: idOf(e.team?.id) || undefined,
    participantName: player || undefined,
  };
}

function hockeyEvent(e: Raw, index: number): MatchEvent {
  const kind = String(e.type ?? "").toLowerCase();
  const players: string[] = Array.isArray(e.players) ? e.players.map(String) : [];
  const assists: string[] = Array.isArray(e.assists) ? e.assists.map(String) : [];
  return {
    id: `${idOf(e.game_id)}-${index}`,
    time: [e.period, e.minute].filter((v) => typeof v === "string" && v).join(" "),
    type: kind === "goal" ? "goal" : "other",
    text: kind === "goal" ? assists.join(", ") : String(e.comment ?? ""),
    teamId: idOf(e.team?.id) || undefined,
    participantName: players[0],
  };
}

export function footballDetailOf(f: Raw, game: SportsGame): SportsMatchDetail {
  const lineups: Raw[] = Array.isArray(f.lineups) ? f.lineups : [];
  const events: Raw[] = Array.isArray(f.events) ? f.events : [];
  const stats: Raw[] = Array.isArray(f.statistics) ? f.statistics : [];
  const photos = photoMap(f.players);
  const homeLine = lineups.find((l) => idOf(l.team?.id) === game.home.id);
  const awayLine = lineups.find((l) => idOf(l.team?.id) === game.away.id);
  const homeBox = stats.find((s) => idOf(s.team?.id) === game.home.id);
  const awayBox = stats.find((s) => idOf(s.team?.id) === game.away.id);
  const homeRoster = roster(homeLine, events, photos);
  const awayRoster = roster(awayLine, events, photos);
  const cameOn = new Set(
    [...homeRoster, ...awayRoster].filter((p) => p.substitutedIn).map((p) => p.id),
  );
  return {
    ...game,
    homeFormation: typeof homeLine?.formation === "string" ? homeLine.formation : undefined,
    awayFormation: typeof awayLine?.formation === "string" ? awayLine.formation : undefined,
    homeRoster,
    awayRoster,
    homeStats: teamStats(homeBox),
    awayStats: teamStats(awayBox),
    allStats: statRows(homeBox, awayBox),
    events: events.map((e, index) => footballEvent(e, index, cameOn)),
  };
}

export function hockeyEventsOf(rows: Raw[]): MatchEvent[] {
  return rows.map(hockeyEvent);
}
