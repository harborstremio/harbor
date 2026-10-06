/** ESPN search results (teams and players) mapped to Harbor league tags. Plain module, no I/O. */

type Rec = Record<string, unknown>;

export type SportsSearchHit = {
  kind: "team" | "player";
  league: string;
  id: string;
  name: string;
  subtitle: string;
  image: string | null;
};

/** ESPN league uids for the leagues the JL Sports Hub covers. */
export const LEAGUE_BY_ESPN_UID: Record<string, string> = {
  "28": "NFL",
  "23": "NCAAF",
  "46": "NBA",
  "41": "NCAAB",
  "90": "NHL",
  "10": "MLB",
};

const https = (u: unknown) => (typeof u === "string" && u ? u.replace(/^http:\/\//, "https://") : null);

export function parseSearchResults(doc: unknown): SportsSearchHit[] {
  const hits: SportsSearchHit[] = [];
  const results = Array.isArray((doc as Rec | null)?.results) ? ((doc as Rec).results as Rec[]) : [];
  for (const group of results) {
    const kind = group.type === "team" ? "team" : group.type === "player" ? "player" : null;
    if (!kind) continue;
    for (const c of Array.isArray(group.contents) ? (group.contents as Rec[]) : []) {
      const uid = String(c.uid ?? "");
      const league = LEAGUE_BY_ESPN_UID[/~l:(\d+)/.exec(uid)?.[1] ?? ""];
      const id = (kind === "team" ? /~t:(\d+)/ : /~a:(\d+)/).exec(uid)?.[1];
      const name = typeof c.displayName === "string" ? c.displayName : "";
      if (!league || !id || !name) continue;
      const image = (c.image ?? {}) as Rec;
      hits.push({
        kind,
        league,
        id,
        name,
        subtitle: typeof c.subtitle === "string" ? c.subtitle : league,
        image: https(image.default) ?? https(image.defaultDark),
      });
    }
  }
  return hits;
}

export type AthleteForFollow = {
  teamId: string | null;
  teamName: string | null;
  headshot: string | null;
  position: string | null;
};

export function parseAthleteForFollow(doc: unknown): AthleteForFollow {
  const a = ((doc as Rec | null)?.athlete ?? {}) as Rec;
  const team = (a.team ?? {}) as Rec;
  const position = (a.position ?? {}) as Rec;
  const headshot = (a.headshot ?? {}) as Rec;
  return {
    teamId: team.id != null ? String(team.id) : null,
    teamName: typeof team.displayName === "string" ? team.displayName : null,
    headshot: https(headshot.href),
    position: typeof position.abbreviation === "string" ? position.abbreviation : null,
  };
}

const HEADSHOT_PATH: Record<string, string> = {
  NFL: "nfl",
  NCAAF: "college-football",
  NBA: "nba",
  NCAAB: "mens-college-basketball",
  NHL: "nhl",
  MLB: "mlb",
};

/** ESPN's headshot image for an athlete id, when the league has one. */
export function espnHeadshot(league: string, athleteId: string): string | null {
  const path = HEADSHOT_PATH[league];
  if (!path || !/^\d{1,12}$/.test(athleteId)) return null;
  return `https://a.espncdn.com/i/headshots/${path}/players/full/${athleteId}.png`;
}
