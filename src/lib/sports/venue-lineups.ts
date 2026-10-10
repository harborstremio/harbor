import type { MatchPlayer } from "./espn-types";
export type VenueSlot = {
  label: string;
  x: number;
  y: number;
  player?: MatchPlayer;
};

/** Formation anchors describe a lineup, never telemetry or an inferred live location. */
export function venueLineup(sport: string, roster: MatchPlayer[]): VenueSlot[] {
  const starters = roster.filter((player) => player.starter && player.id && player.name);
  const used = new Set<string>();
  const pick = (positions: string[]) => {
    const player = starters.find(
      (item) => !used.has(item.id) && positions.includes(item.position.toUpperCase()),
    );
    if (player) used.add(player.id);
    return player;
  };
  if (sport === "hockey")
    return [
      { label: "G", x: 12, y: 50, player: pick(["G", "GK"]) },
      { label: "LD", x: 24, y: 28, player: pick(["LD", "D"]) },
      { label: "RD", x: 24, y: 72, player: pick(["RD", "D"]) },
      { label: "C", x: 38, y: 50, player: pick(["C"]) },
      { label: "LW", x: 40, y: 17, player: pick(["LW", "L"]) },
      { label: "RW", x: 40, y: 83, player: pick(["RW", "R"]) },
    ];
  if (sport === "rugby")
    return Array.from({ length: 15 }, (_, index) => {
      const jersey = index + 1;
      const player = starters.find((item) => Number(item.jersey) === jersey);
      const coordinates = [
        [40, 32],
        [40, 50],
        [40, 68],
        [33, 44],
        [33, 56],
        [29, 27],
        [28, 80],
        [25, 50],
        [20, 40],
        [17, 60],
        [35, 10],
        [18, 78],
        [35, 80],
        [40, 90],
        [10, 50],
      ][index];
      return {
        label: String(jersey),
        x: coordinates[0],
        y: coordinates[1],
        player,
      };
    });
  if (sport === "lacrosse")
    return [
      ...[[12, 50]].map(([x, y]) => ({
        label: "G",
        x,
        y,
        player: pick(["G", "GK"]),
      })),
      ...[
        [24, 23],
        [24, 50],
        [24, 77],
      ].map(([x, y]) => ({ label: "D", x, y, player: pick(["D"]) })),
      ...[
        [36, 23],
        [36, 50],
        [36, 77],
      ].map(([x, y]) => ({ label: "M", x, y, player: pick(["M", "MF"]) })),
      ...[
        [46, 20],
        [46, 50],
        [46, 80],
      ].map(([x, y]) => ({ label: "A", x, y, player: pick(["A", "ATT"]) })),
    ];
  // Cricket field settings and Australian football rotations are not available in
  // this feed; their real squad belongs beside the layout, not in invented slots.
  return [];
}
