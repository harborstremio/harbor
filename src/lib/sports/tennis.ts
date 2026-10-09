import { safeFetch } from "@/lib/safe-fetch";

const BASE = "https://site.api.espn.com/apis/site/v2/sports/tennis";
const TOURS = ["atp", "wta"] as const;

export type Tour = "ATP" | "WTA";

export type TennisTournament = {
  id: string;
  tour: Tour;
  name: string;
  venue: string;
  major: boolean;
  startMs: number;
  endMs: number;
  state: "pre" | "in" | "post";
};

export type DrawPlayer = {
  name: string;
  flag: string;
  flags?: string[];
  winner: boolean;
  sets: string[];
};

export type DrawMatch = {
  id: string;
  round: string;
  roundId: number;
  draw: string;
  state: "pre" | "in" | "post";
  detail: string;
  startMs: number;
  court: string;
  players: DrawPlayer[];
};

export type DrawRound = { name: string; matches: DrawMatch[] };

export type DrawSection = { draw: string; rounds: DrawRound[] };

export type TournamentDraw = {
  tournament: TennisTournament;
  sections: DrawSection[];
  previousWinners: { name: string; draw: string; image: string }[];
};

type Raw = Record<string, unknown>;

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

function stateOf(raw: unknown): "pre" | "in" | "post" {
  const s = ((raw as Raw)?.type as Raw | undefined)?.state;
  return s === "in" || s === "post" ? s : "pre";
}

function isNoise(name: string): boolean {
  return /challenger|itf|futures|utr|exhibition/i.test(name);
}

function toTournament(ev: Raw, tour: Tour): TennisTournament | null {
  const name = String(ev.name ?? ev.shortName ?? "").trim();
  if (!name || isNoise(name)) return null;
  return {
    id: String(ev.id ?? ""),
    tour,
    name,
    venue: String((ev.venue as Raw | undefined)?.displayName ?? ""),
    major: ev.major === true,
    startMs: Date.parse(String(ev.date ?? "")) || 0,
    endMs: Date.parse(String(ev.endDate ?? "")) || 0,
    state: stateOf(ev.status),
  };
}

async function scoreboard(tour: string, dates?: string): Promise<Raw[]> {
  const url = `${BASE}/${tour}/scoreboard${dates ? `?dates=${dates}` : ""}`;
  try {
    const r = await safeFetch(url);
    if (!r.ok) return [];
    const d = (await r.json()) as { events?: unknown[] };
    return Array.isArray(d.events) ? (d.events as Raw[]) : [];
  } catch {
    return [];
  }
}

export async function fetchTennisTournaments(weeks = 10): Promise<TennisTournament[]> {
  const now = new Date();
  const end = new Date(now.getTime() + weeks * 7 * 86400000);
  const range = `${stamp(now)}-${stamp(end)}`;
  const lists = await Promise.all(
    TOURS.map(async (t) => {
      const tour = t.toUpperCase() as Tour;
      const [live, ranged] = await Promise.all([scoreboard(t), scoreboard(t, range)]);
      return [...live, ...ranged].map((ev) => toTournament(ev, tour));
    }),
  );
  const seen = new Set<string>();
  const out: TennisTournament[] = [];
  for (const item of lists.flat()) {
    if (!item || !item.id) continue;
    const key = `${item.tour}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  const rank = (t: TennisTournament) => (t.state === "in" ? 0 : t.state === "pre" ? 1 : 2);
  out.sort((a, b) => rank(a) - rank(b) || a.startMs - b.startMs || a.name.localeCompare(b.name));
  return out;
}

function toDrawMatch(comp: Raw, draw: string): DrawMatch | null {
  const cs = (comp.competitors as Raw[] | undefined) ?? [];
  if (cs.length < 2) return null;
  const sorted = [...cs].sort((a, b) => Number(a.order ?? 99) - Number(b.order ?? 99));
  const players: DrawPlayer[] = sorted.map((c) => {
    const athlete = (c.athlete as Raw | undefined) ?? {};
    const roster = (c.roster as Raw | undefined) ?? {};
    const lines = (c.linescores as Raw[] | undefined) ?? [];
    const flagOf = (person: Raw) => String((person.flag as Raw | undefined)?.href ?? "");
    const squad = (Array.isArray(roster.athletes) ? (roster.athletes as Raw[]) : []).map(
      (entry) => ((entry.athlete as Raw | undefined) ?? entry) as Raw,
    );
    const flags = squad.map(flagOf).filter(Boolean);
    return {
      name:
        String(athlete.displayName ?? athlete.shortName ?? "") ||
        String(roster.displayName ?? roster.shortDisplayName ?? "").trim(),
      flag: flagOf(athlete) || flags[0] || "",
      ...(flags.length > 1 ? { flags } : {}),
      winner: c.winner === true,
      sets: lines.map((l) => String(l.value ?? l.displayValue ?? "")).filter(Boolean),
    };
  });
  if (players.some((p) => !p.name || /^tbd$/i.test(p.name))) return null;
  const st = (comp.status as Raw | undefined) ?? {};
  const type = (st.type as Raw | undefined) ?? {};
  const roundRaw = (comp.round as Raw | undefined) ?? {};
  return {
    id: String(comp.id ?? ""),
    round: String(roundRaw.displayName ?? ""),
    roundId: Number(roundRaw.id ?? 0) || 0,
    draw,
    state: stateOf(st),
    detail: String(type.shortDetail ?? type.detail ?? ""),
    startMs: Date.parse(String(comp.date ?? "")) || 0,
    court: String((comp.court as Raw | undefined)?.displayName ?? ""),
    players,
  };
}

export async function fetchTournamentDraw(t: TennisTournament): Promise<TournamentDraw | null> {
  const tour = t.tour.toLowerCase();
  const from = t.startMs ? new Date(t.startMs) : new Date();
  const to = t.endMs ? new Date(t.endMs) : new Date(from.getTime() + 14 * 86400000);
  const events = await scoreboard(tour, `${stamp(from)}-${stamp(to)}`);
  const ev = events.find((e) => String(e.id ?? "") === t.id);
  if (!ev) return null;

  const groupings = (ev.groupings as Raw[] | undefined) ?? [];
  const matches: DrawMatch[] = [];
  for (const g of groupings) {
    const draw = String((g.grouping as Raw | undefined)?.displayName ?? "");
    for (const c of (g.competitions as Raw[] | undefined) ?? []) {
      const m = toDrawMatch(c, draw);
      if (m) matches.push(m);
    }
  }

  const byDraw = new Map<string, Map<string, DrawMatch[]>>();
  for (const m of matches) {
    const drawKey = m.draw || "Matches";
    const roundKey = m.round || drawKey;
    let rounds = byDraw.get(drawKey);
    if (!rounds) {
      rounds = new Map();
      byDraw.set(drawKey, rounds);
    }
    const list = rounds.get(roundKey);
    if (list) list.push(m);
    else rounds.set(roundKey, [m]);
  }

  const earliest = (list: DrawMatch[]) => {
    const stamps = list.map((m) => m.startMs).filter((n) => n > 0);
    return stamps.length ? Math.min(...stamps) : Number.MAX_SAFE_INTEGER;
  };
  const roundOrder = (list: DrawMatch[]) => {
    const ids = list.map((m) => m.roundId).filter((n) => n > 0);
    return ids.length ? Math.min(...ids) : Number.MAX_SAFE_INTEGER;
  };

  const sections: DrawSection[] = [...byDraw.entries()].map(([draw, roundMap]) => ({
    draw,
    rounds: [...roundMap.entries()]
      .map(([name, list]) => ({ name, matches: list.sort((a, b) => a.startMs - b.startMs) }))
      .sort((a, b) => earliest(a.matches) - earliest(b.matches) || roundOrder(a.matches) - roundOrder(b.matches)),
  }));
  sections.sort((a, b) => a.draw.localeCompare(b.draw));

  const previousWinners = ((ev.previousWinners as Raw[] | undefined) ?? []).map((w) => ({
    name: String(w.displayName ?? ""),
    draw: String((w.type as Raw | undefined)?.text ?? ""),
    image: String(w.headshot ?? ""),
  }));

  return { tournament: { ...t, state: stateOf(ev.status) }, sections, previousWinners };
}
