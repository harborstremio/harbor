import type { MatchPlayer } from "./espn-types";
export type FieldPlayer = {
  slot: string;
  x: number;
  y: number;
  player?: MatchPlayer;
};
const offense: Record<string, [number, number]> = {
  qb: [37, 50],
  rb: [27, 64],
  fb: [28, 38],
  lt: [48, 25],
  lg: [48, 37.5],
  c: [48, 50],
  rg: [48, 62.5],
  rt: [48, 75],
  te: [57, 83],
  wr1: [53, 9],
  wr2: [46, 93],
  wr3: [36, 20],
};
const defense: Record<string, [number, number]> = {
  lde: [52, 30],
  rde: [52, 70],
  nt: [52, 50],
  dt: [52, 44],
  ldt: [52, 42],
  rdt: [52, 58],
  de: [52, 30],
  wlb: [64, 25],
  slb: [64, 75],
  lilb: [64, 42],
  rilb: [64, 58],
  mlb: [65, 50],
  lb: [64, 50],
  lcb: [60, 10],
  rcb: [60, 90],
  ss: [80, 35],
  fs: [80, 65],
};
export function footballPositions(unit: "offense" | "defense"): FieldPlayer[] {
  const names =
    unit === "offense"
      ? ["qb", "rb", "lt", "lg", "c", "rg", "rt", "te", "wr1", "wr2", "wr3"]
      : ["lde", "rde", "ldt", "rdt", "wlb", "mlb", "slb", "lcb", "rcb", "ss", "fs"];
  const coordinates = unit === "offense" ? offense : defense;
  return names.map((slot) => ({
    slot: slot.toUpperCase(),
    x: coordinates[slot][0],
    y: coordinates[slot][1],
  }));
}
export function parseFootballSquad(raw: any): MatchPlayer[] {
  const groups = Array.isArray(raw?.athletes) ? raw.athletes : [];
  return groups
    .flatMap((group: any) => (Array.isArray(group.items) ? group.items : [group]))
    .filter((athlete: any) => athlete?.id && athlete.displayName)
    .slice(0, 200)
    .map((athlete: any) => ({
      id: String(athlete.id),
      name: String(athlete.displayName),
      jersey: String(athlete.jersey || ""),
      position: String(athlete.position?.abbreviation || ""),
      starter: false,
      goals: 0,
      yellowCards: 0,
      redCards: 0,
      image: typeof athlete.headshot?.href === "string" ? athlete.headshot.href : "",
    }));
}
export function parseFootballDepth(
  raw: any,
  portraitSport = "nfl",
): {
  offense: FieldPlayer[];
  defense: FieldPlayer[];
  year: number;
} {
  const charts: any[] = Array.isArray(raw.depthchart) ? raw.depthchart : [];
  const chart = (attack: boolean) =>
    charts.find((row) => (attack ? row.positions?.qb : row.positions?.lcb || row.positions?.rcb));
  const parse = (attack: boolean): FieldPlayer[] => {
    const positions = chart(attack)?.positions ?? {};
    const coordinates = attack ? offense : defense;
    const entries = Object.entries(positions).filter(([slot]) => coordinates[slot]);
    const selected =
      entries.length > 11 ? entries.filter(([slot]) => slot !== "fb").slice(0, 11) : entries;
    return selected.map(([slot, value]) => {
      const row = value as any;
      const athlete = row.athletes?.[0];
      return {
        slot: row.position?.abbreviation || slot.toUpperCase(),
        x: coordinates[slot][0],
        y: coordinates[slot][1],
        player: athlete?.id
          ? {
              id: String(athlete.id),
              name: String(athlete.displayName || ""),
              jersey: String(athlete.jersey || ""),
              position: row.position?.abbreviation || slot.toUpperCase(),
              starter: false,
              goals: 0,
              yellowCards: 0,
              redCards: 0,
              image: `https://a.espncdn.com/i/headshots/${portraitSport}/players/full/${athlete.id}.png`,
            }
          : undefined,
      };
    });
  };
  return {
    offense: parse(true),
    defense: parse(false),
    year: Number(raw.season?.year),
  };
}
export function basketballFive(roster: MatchPlayer[]): FieldPlayer[] {
  const slots = [
    { slot: "PG", x: 37, y: 50 },
    { slot: "SG", x: 28, y: 17 },
    { slot: "SF", x: 28, y: 83 },
    { slot: "PF", x: 16, y: 72 },
    { slot: "C", x: 15, y: 38 },
  ];
  const starters = roster.filter((player) => player.starter).slice(0, 5);
  const used = new Set<string>();
  return slots.map((slot) => {
    const player =
      starters.find((player) => !used.has(player.id) && player.position === slot.slot) ??
      starters.find(
        (player) =>
          !used.has(player.id) &&
          (slot.slot.endsWith("G")
            ? player.position === "G"
            : slot.slot.endsWith("F")
              ? player.position === "F"
              : player.position === "C"),
      ) ??
      starters.find((player) => !used.has(player.id));
    if (player) used.add(player.id);
    return { ...slot, player };
  });
}
