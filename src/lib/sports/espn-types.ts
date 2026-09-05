export type SportsSide = {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  score: string;
  winner: boolean;
};

export type EventContext = {
  id: string;
  name: string;
  round: string;
  draw: string;
  venue: string;
  major: boolean;
  court?: string;
  bestOf?: number;
};

export type SportsGame = {
  id: string;
  league: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: SportsSide;
  away: SportsSide;
  startMs: number;
  context?: EventContext;
  source?: string;
};

export type MatchPlayer = {
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  substitutedIn?: boolean;
  substitutedOut?: boolean;
  formationPlace?: number;
  goals: number;
  yellowCards: number;
  redCards: number;
  image?: string;
};

export type MatchTeamStats = {
  possession?: string;
  shots?: string;
  shotsOnTarget?: string;
  corners?: string;
  fouls?: string;
  yellowCards?: string;
  redCards?: string;
};

export type MatchEvent = {
  id: string;
  time: string;
  type: "goal" | "yellow_card" | "red_card" | "substitution" | "other";
  text: string;
  teamId?: string;
  participantName?: string;
};

export type MatchTeamStatRow = {
  label: string;
  homeValue: string;
  awayValue: string;
};

export type MMAFighterProfile = {
  age: string;
  height: string;
  weight: string;
  reach: string;
  stance: string;
  fullImage: string;
};

export type SportsMatchDetail = SportsGame & {
  homeFormation?: string;
  awayFormation?: string;
  homeRoster: MatchPlayer[];
  awayRoster: MatchPlayer[];
  homeStats: MatchTeamStats;
  awayStats: MatchTeamStats;
  allStats: MatchTeamStatRow[];
  events: MatchEvent[];
  homeProfile?: MMAFighterProfile;
  awayProfile?: MMAFighterProfile;
};

export type LeagueDef = {
  key: string;
  label: string;
  labelEn: string;
  labelRu?: string;
  tag: string;
  path: string;
  logo: string;
  group: string;
};

export type LeagueGroupDef = {
  key: string;
  label: string;
  labelEn: string;
  labelRu?: string;
  icon: string;
};
