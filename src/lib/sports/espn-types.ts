export type SportsSide = {
  id: string;
  name: string;
  abbr: string;
  logo: string;
  score: string;
  winner: boolean;
  periods?: { period: number; value: string; winner?: boolean; tiebreak?: string }[];
  currentPoint?: string;
  serving?: boolean;
  /** Published overall record from this competition's scoreboard. */
  record?: string;
  /** Published top25 poll ranking; absent for unranked competitors. */
  rank?: number;
  /** Explicit individual identity, separate from team/roster or classification IDs. */
  athleteId?: string;
  athleteSource?: "espn" | "thesportsdb" | "api-sports";
  athleteImage?: string;
  /** A doubles pair or relay squad. ESPN ships these as ONE competitor carrying a roster rather
   *  than a team, so a side is 1..N people and the pair label is pre-formatted upstream. */
  members?: { id: string; name: string; flag: string }[];
  /** School or city ("Ohio State", "Philadelphia"); team sides only. */
  location?: string;
  /** Mascot or nickname ("Buckeyes", "Phillies"); team sides only. */
  nickname?: string;
  /** Team colours as the provider lists them (lowercase hex without '#'). */
  color?: string;
  altColor?: string;
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
  /** Present only when displaying a cached slice that has not refreshed successfully. */
  savedAt?: number;
  id: string;
  league: string;
  state: "pre" | "in" | "post";
  detail: string;
  home: SportsSide;
  away: SportsSide;
  /**
   * Everyone in a race, heat or leaderboard. A two-sided board can only show the
   * leading pair, which is the whole field for a match and a fraction of it here.
   */
  field?: SportsSide[];
  startMs: number;
  /** Published calendar date (YYYY-MM-DD) when no start time is available; startMs is a sort anchor. */
  dateOnly?: string;
  context?: EventContext;
  source?: string;
  artwork?: string;
  poster?: string;
  broadcasts?: string[];
  /** The national broadcaster when one is marked, else the first listed (one of `broadcasts`). */
  network?: string | null;
  /** Published betting line, e.g. "KC -3.5 · O/U 47.5". */
  odds?: string | null;
};

export type MatchPlayer = {
  source?: "espn" | "thesportsdb" | "api-sports";
  id: string;
  name: string;
  jersey: string;
  position: string;
  starter: boolean;
  active?: boolean;
  batOrder?: number;
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

export type MatchPlayerStatTable = {
  teamId: string;
  name: string;
  innings?: number;
  summary?: string;
  labels: string[];
  descriptions: string[];
  rows: { player: MatchPlayer; values: string[] }[];
};

export type MatchPartnershipTable = {
  teamId: string;
  innings: number;
  rows: {
    wicket: string;
    runs: string;
    overs: string;
    players: { name: string; runs: string }[];
  }[];
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
  baseball?: BaseballSituation;
  football?: FootballSituation;
  homeFormation?: string;
  awayFormation?: string;
  homeRoster: MatchPlayer[];
  awayRoster: MatchPlayer[];
  homeStats: MatchTeamStats;
  awayStats: MatchTeamStats;
  allStats: MatchTeamStatRow[];
  playerStats?: MatchPlayerStatTable[];
  partnerships?: MatchPartnershipTable[];
  events: MatchEvent[];
  homeProfile?: MMAFighterProfile;
  awayProfile?: MMAFighterProfile;
};

export type FootballSituation = {
  source: "situation" | "last-play";
  down: number;
  distance?: number;
  possessionTeamId?: string;
  /** Provider field coordinate; use yardLineText for the team-relative yard line. */
  yardLine?: number;
  yardLineText?: string;
  clock?: string;
  period?: number;
  lastPlayId?: string;
};

export type BaseballSituation = {
  balls?: number;
  strikes?: number;
  outs?: number;
  pitcherId?: string;
  batterId?: string;
  onFirstId?: string;
  onSecondId?: string;
  onThirdId?: string;
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
