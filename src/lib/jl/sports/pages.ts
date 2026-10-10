/** The deeper Sports pages a viewer can open from the Sports Hub. Plain types, no I/O. */
export type SportsPage =
  | { kind: "team"; league: string; teamId: string; name?: string }
  | { kind: "athlete"; league: string; athleteId: string; name?: string }
  | { kind: "league"; league: string; name?: string }
  | { kind: "leagues" }
  | { kind: "world" }
  | { kind: "match-center"; sport: string; matchId: string; name?: string }
  | { kind: "colleges" }
  | { kind: "conferences"; group?: string; team?: string }
  | { kind: "college"; collegeId: string; name?: string }
  | { kind: "student"; site: string; sport: string; studentId: string; name?: string };

/** Stable identity for a page, used for navigation and React keys. */
export function sportsPageKey(p: SportsPage): string {
  switch (p.kind) {
    case "team":
      return `team:${p.league}:${p.teamId}`;
    case "athlete":
      return `athlete:${p.league}:${p.athleteId}`;
    case "league":
      return `league:${p.league}`;
    case "leagues":
      return "leagues";
    case "world":
      return "world";
    case "match-center":
      return `match-center:${p.sport}:${p.matchId}`;
    case "colleges":
      return "colleges";
    case "conferences":
      return "conferences";
    case "college":
      return `college:${p.collegeId}`;
    case "student":
      return `student:${p.site}:${p.sport}:${p.studentId}`;
  }
}
