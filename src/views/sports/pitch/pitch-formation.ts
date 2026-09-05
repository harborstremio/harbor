import type { MatchEvent, MatchPlayer } from "@/lib/sports/espn";

export type PitchSide = "home" | "away";
export type PitchOrientation = "horizontal" | "vertical";
export type SubState = "in" | "out";

export type PitchSlot = {
  player: MatchPlayer;
  x: number;
  y: number;
  band: number;
  keeper: boolean;
};

export type PitchLayout = {
  side: PitchSide;
  formation: string;
  inferred: boolean;
  slots: PitchSlot[];
  bench: MatchPlayer[];
};

const BAND_EXACT: Record<string, number> = {
  G: 0, GK: 0, K: 0, GOL: 0,
  D: 1, CB: 1, LCB: 1, RCB: 1, LB: 1, RB: 1, LWB: 1, RWB: 1, WB: 1, SW: 1, FB: 1, DF: 1,
  M: 2, MF: 2, CM: 2, DM: 2, CDM: 2, AM: 2, CAM: 2, LM: 2, RM: 2, LCM: 2, RCM: 2, CDF: 2,
  F: 3, FW: 3, ST: 3, CF: 3, SS: 3, LW: 3, RW: 3, LF: 3, RF: 3, W: 3, ATT: 3,
};

const SIDE_RIGHT = new Set(["R", "RB", "RCB", "RWB", "RM", "RCM", "RW", "RF"]);
const SIDE_LEFT = new Set(["L", "LB", "LCB", "LWB", "LM", "LCM", "LW", "LF"]);

const KEEPER_DEPTH = 0.12;
const BAND_FIRST = 0.27;
const BAND_LAST = 0.95;
const SOLO_BAND = 0.62;

export function positionBand(position: string): number {
  const token = (position || "").trim().toUpperCase();
  if (token && token in BAND_EXACT) return BAND_EXACT[token];
  const word = token.toLowerCase();
  if (word.includes("keep") || word.includes("goal")) return 0;
  if (word.includes("back") || word.includes("def")) return 1;
  if (word.includes("mid")) return 2;
  if (word.includes("forward") || word.includes("strik") || word.includes("wing") || word.includes("attack")) return 3;
  return 2;
}

export function lateralHint(position: string): number {
  const token = (position || "").trim().toUpperCase();
  if (SIDE_RIGHT.has(token)) return -1;
  if (SIDE_LEFT.has(token)) return 1;
  const word = token.toLowerCase();
  if (word.startsWith("right")) return -1;
  if (word.startsWith("left")) return 1;
  return 0;
}

export function formationPlaceOf(player: MatchPlayer): number | null {
  const raw = (player as unknown as { formationPlace?: unknown }).formationPlace;
  const value = typeof raw === "string" ? Number(raw) : raw;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

export function parseFormationCounts(formation: string): number[] {
  const counts = (formation || "")
    .split(/[^0-9]+/)
    .map((part) => Number(part))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 11);
  const total = counts.reduce((sum, n) => sum + n, 0);
  return total >= 6 && total <= 10 ? counts : [];
}

export function rowDepth(index: number, rows: number): number {
  if (rows <= 1) return SOLO_BAND;
  return BAND_FIRST + (index * (BAND_LAST - BAND_FIRST)) / (rows - 1);
}

export function rowSpread(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0.5];
  const margin = count === 2 ? 0.29 : count === 3 ? 0.2 : count === 4 ? 0.135 : count === 5 ? 0.095 : 0.07;
  const span = 1 - margin * 2;
  return Array.from({ length: count }, (_, i) => margin + (i * span) / (count - 1));
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function inferCounts(field: MatchPlayer[]): number[] {
  const bands = [1, 2, 3].map((band) => field.filter((p) => positionBand(p.position) === band).length);
  const used = bands.filter((n) => n > 0);
  if (used.length >= 2) return used;
  return chunk(field, 4).map((row) => row.length);
}

function sliceRows(field: MatchPlayer[], counts: number[]): MatchPlayer[][] {
  const rows: MatchPlayer[][] = [];
  let offset = 0;
  for (const count of counts) {
    if (offset >= field.length) break;
    rows.push(field.slice(offset, offset + count));
    offset += count;
  }
  if (offset < field.length) rows.push(field.slice(offset));
  return rows.filter((row) => row.length > 0);
}

function orderLaterally(row: MatchPlayer[]): MatchPlayer[] {
  return row
    .map((player, index) => ({ player, index, hint: lateralHint(player.position) }))
    .sort((a, b) => a.hint - b.hint || a.index - b.index)
    .map((entry) => entry.player);
}

export function buildPitchLayout(
  roster: MatchPlayer[],
  formation: string,
  side: PitchSide,
): PitchLayout {
  const bench = roster.filter((p) => !p.starter);
  const starters = roster.filter((p) => p.starter);
  if (starters.length === 0) {
    return { side, formation: "", inferred: true, slots: [], bench: roster };
  }

  const places = starters.map(formationPlaceOf);
  const ordered = places.every((v) => v !== null)
    ? starters
        .map((player, index) => ({ player, place: places[index] as number }))
        .sort((a, b) => a.place - b.place)
        .map((entry) => entry.player)
    : starters.slice();

  const keeper =
    ordered.find((p) => positionBand(p.position) === 0) ??
    ordered.find((p) => formationPlaceOf(p) === 1) ??
    ordered[0];
  const field = ordered.filter((p) => p !== keeper);

  const parsed = parseFormationCounts(formation);
  const inferred = parsed.length === 0;
  const counts = inferred ? inferCounts(field) : parsed;
  const rows = sliceRows(field, counts);

  const slots: PitchSlot[] = [
    { player: keeper, x: KEEPER_DEPTH, y: 0.5, band: 0, keeper: true },
  ];

  rows.forEach((row, rowIndex) => {
    const depth = rowDepth(rowIndex, rows.length);
    const spread = rowSpread(row.length);
    orderLaterally(row).forEach((player, index) => {
      slots.push({ player, x: depth, y: spread[index], band: rowIndex + 1, keeper: false });
    });
  });

  const resolved = inferred ? rows.map((row) => row.length).join("-") : parsed.join("-");
  return { side, formation: resolved, inferred, slots, bench };
}

export function toCanvasPoint(slot: PitchSlot, side: PitchSide): { x: number; y: number } {
  return side === "home"
    ? { x: slot.x * 0.5, y: slot.y }
    : { x: 1 - slot.x * 0.5, y: 1 - slot.y };
}

export function orientPoint(
  x: number,
  y: number,
  orientation: PitchOrientation,
): { left: number; top: number } {
  if (orientation === "horizontal") return { left: x * 100, top: y * 100 };
  return { left: y * 100, top: (1 - x) * 100 };
}

function lastNameOf(name: string): string {
  const parts = (name || "").trim().split(/\s+/);
  return (parts[parts.length - 1] || "").toLowerCase();
}

export function matchPlayerByName(text: string, roster: MatchPlayer[]): MatchPlayer | null {
  const haystack = (text || "").toLowerCase();
  if (!haystack) return null;
  const full = roster.find((p) => p.name && haystack.includes(p.name.toLowerCase()));
  if (full) return full;
  const surname = roster.find((p) => {
    const last = lastNameOf(p.name);
    return last.length > 2 && haystack.includes(last);
  });
  return surname ?? null;
}

function eventNeedle(event: MatchEvent): string {
  return `${event.participantName || ""} ${event.text || ""}`;
}

export function goalsFromEvents(events: MatchEvent[], roster: MatchPlayer[]): Map<string, number> {
  const tally = new Map<string, number>();
  for (const event of events) {
    if (event.type !== "goal") continue;
    const player = matchPlayerByName(eventNeedle(event), roster);
    if (!player) continue;
    tally.set(player.id, (tally.get(player.id) ?? 0) + 1);
  }
  return tally;
}

export function goalsOf(player: MatchPlayer, derived: Map<string, number>): number {
  return Math.max(player.goals || 0, derived.get(player.id) ?? 0);
}

function flaggedSub(player: MatchPlayer): SubState | null {
  const raw = player as unknown as Record<string, unknown>;
  if (player.substitutedIn === true || raw.subbedIn === true) return "in";
  if (player.substitutedOut === true || raw.subbedOut === true) return "out";
  return null;
}

export function subStatesFromEvents(
  events: MatchEvent[],
  roster: MatchPlayer[],
): Map<string, SubState> {
  const states = new Map<string, SubState>();
  for (const player of roster) {
    const flag = flaggedSub(player);
    if (flag) states.set(player.id, flag);
  }
  for (const event of events) {
    if (event.type !== "substitution") continue;
    const needle = eventNeedle(event).toLowerCase();
    if (!needle.trim()) continue;
    for (const player of roster) {
      if (states.has(player.id)) continue;
      const last = lastNameOf(player.name);
      const hit =
        Boolean(player.name && needle.includes(player.name.toLowerCase())) ||
        (last.length > 2 && needle.includes(last));
      if (hit) states.set(player.id, player.starter ? "out" : "in");
    }
  }
  return states;
}
