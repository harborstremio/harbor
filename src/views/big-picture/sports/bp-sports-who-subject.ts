import type { AthleteSource } from "@/lib/sports/athlete-identity";
import type { LeagueDef, MMAFighterProfile, SportsSide } from "@/lib/sports/espn-types";
import type { TeamIdentity } from "@/lib/sports/team-profile";

const NO_TEAM = new Set(["combat", "boxing", "tennis", "golf", "motorsport", "esports"]);

const UNNAMED = /^(?:tbd|tba|unknown|winner|loser|bye)(?:\b|$)/i;

export type BpSportsWhoPerson = {
  id: string;
  name: string;
  crest: string;
  source: AthleteSource | "none";
  path: string;
  group: string;
  profile: MMAFighterProfile | undefined;
};

export type BpSportsWhoTeamSubject = {
  kind: "team";
  key: string;
  name: string;
  art: string;
  league: LeagueDef | undefined;
  identity: TeamIdentity;
};

export type BpSportsWhoAthleteSubject = {
  kind: "athlete";
  key: string;
  name: string;
  art: string;
  league: LeagueDef | undefined;
  person: BpSportsWhoPerson;
};

export type BpSportsWhoSubject = BpSportsWhoTeamSubject | BpSportsWhoAthleteSubject;

export type BpSportsWhoInput = {
  side: SportsSide;
  art: string;
  league: LeagueDef | undefined;
  leagueTag: string;
  group: string;
  individual: boolean;
  source: string | undefined;
  profile: MMAFighterProfile | undefined;
};

function athleteSource(raw: string | undefined): AthleteSource | "none" {
  if (raw === undefined || raw === "" || raw === "espn") return "espn";
  if (/thesportsdb/i.test(raw)) return "thesportsdb";
  if (/api-sports/i.test(raw)) return "api-sports";
  return "none";
}

export function bpSportsWhoPlayerSubject(
  player: { id: string; name: string; image?: string; source: "espn" | "thesportsdb" },
  league: LeagueDef | undefined,
  leagueTag: string,
): BpSportsWhoAthleteSubject | null {
  const name = player.name.trim();
  if (name === "" || UNNAMED.test(name)) return null;
  const face = player.image ?? "";
  if (player.id === "" && face === "") return null;
  const group = league?.group ?? "";
  return {
    kind: "athlete",
    key: `bp-sports-who-player:${leagueTag}:${player.id || name}`,
    name,
    art: face,
    league,
    person: {
      id: player.id,
      name,
      crest: face,
      source: player.source,
      path: group === "soccer" ? "soccer/all" : (league?.path ?? ""),
      group,
      profile: undefined,
    },
  };
}

export function bpSportsWhoSubject(input: BpSportsWhoInput): BpSportsWhoSubject | null {
  const { side, art, league, leagueTag, group, individual, source, profile } = input;
  const name = side.name.trim();
  if (name === "" || UNNAMED.test(name)) return null;
  const key = `bp-sports-who:${leagueTag}:${side.id || name}`;

  if (individual || NO_TEAM.has(group)) {
    const person: BpSportsWhoPerson = {
      id: side.id,
      name,
      crest: side.logo,
      source: athleteSource(source),
      path: group === "soccer" ? "soccer/all" : (league?.path ?? ""),
      group,
      profile,
    };
    const face = profile?.fullImage || art || side.logo;
    if (face === "" && profile === undefined && person.id === "") return null;
    return { kind: "athlete", key, name, art: face, league, person };
  }

  if (group === "") return null;
  return {
    kind: "team",
    key,
    name,
    art: art || side.logo,
    league,
    identity: { id: side.id, name, logo: side.logo, league: leagueTag, source },
  };
}
