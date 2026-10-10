import type { SportsGame, SportsSide } from "../../sports/espn-types.ts";
import type { College } from "./colleges.ts";
import type { JlFavoriteTeam } from "./rank.ts";
import { sportKey, type SchoolEvent } from "./sidearm.ts";
import { providerKey, type VisionTeam } from "./vision-branding.ts";
import { normalizeSchool } from "./vision-cfbd-link.ts";

/**
 * Followed colleges in the Sports Hub. ESPN's feed carries few or no Division II and III games,
 * so a school followed on its College page (Gallaudet, say) gets its games from its own
 * athletics site instead, turned into the same games ESPN's feed gives. The hero, wordmark, Game
 * Stories, cards and ticker then treat it like any other followed team. Plain module, no I/O.
 */

/** Games from a school's own site are marked with this source. */
export const SCHOOL_SOURCE = "school";

/** The sports followed colleges bring into the hub, with the league each plays as. */
const SPORT_LEAGUE: Record<string, string> = { football: "NCAAF" };

/** A game "on now" from a school calendar: started under this long ago and not yet decided. */
const LIVE_WINDOW_MS = 3.5 * 3600_000;

/** "ncaa:1234" → "ncaa-1234", the team id followed colleges use (art keys can't hold ':'). */
export function collegeTeamId(college: Pick<College, "id">): string {
  return college.id.replace(/:/g, "-");
}

/** The College page a hub game from a school's site belongs to; null for any other game. */
export function collegeIdOfGame(game: Pick<SportsGame, "id" | "source">): string | null {
  if (game.source !== SCHOOL_SOURCE) return null;
  const m = /^school:(ncaa:\d+):/.exec(game.id);
  return m ? m[1] : null;
}

/** "Gallaudet University" → "Gallaudet", "University of Chicago" → "Chicago". */
export function collegeShortName(name: string): string {
  const short = name
    .replace(/^the\s+/i, "")
    .replace(/^university of\s+/i, "")
    .replace(/\s+(university|college)$/i, "")
    .trim();
  return short || name;
}

/** The college as a followed team, so ranking, the hero and the ticker count it as yours. */
export function collegeFavorite(college: College): JlFavoriteTeam {
  return { league: "NCAAF", id: collegeTeamId(college), name: collegeShortName(college.name) };
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "opponent";

/** The school's score first, as its calendar writes it ("35-14"). */
function scores(event: SchoolEvent): [string, string] {
  const m = event.score ? /^(\d+)-(\d+)$/.exec(event.score) : null;
  return m ? [m[1], m[2]] : ["", ""];
}

/**
 * A college's games in the sports the hub covers, as hub games. `look` adds the school's mascot
 * (the wordmark's second line) and logo when known.
 */
export function collegeGames(
  college: College,
  events: readonly SchoolEvent[],
  now: number,
  look: { mascot?: string | null; logo?: string | null } = {},
): SportsGame[] {
  const short = collegeShortName(college.name);
  const out: SportsGame[] = [];
  for (const event of events) {
    const league = event.sport ? SPORT_LEAGUE[sportKey(event.sport)] : undefined;
    const startMs = Date.parse(event.start);
    if (!league || !Number.isFinite(startMs)) continue;
    const decided = !!event.result;
    const live = !decided && startMs <= now && now - startMs < LIVE_WINDOW_MS;
    const [mine, theirs] = scores(event);
    const school: SportsSide = {
      id: collegeTeamId(college),
      name: look.mascot ? `${short} ${look.mascot}` : short,
      abbr: short.slice(0, 4).toUpperCase(),
      logo: look.logo ?? "",
      score: mine,
      winner: event.result === "W",
      location: short,
      nickname: look.mascot ?? undefined,
    };
    const opponentName = event.opponent?.trim() || "TBA";
    const opponent: SportsSide = {
      id: `opp-${slug(opponentName)}`,
      name: opponentName,
      abbr: opponentName.slice(0, 4).toUpperCase(),
      logo: "",
      score: theirs,
      winner: event.result === "L",
    };
    // Neutral-site and unmarked games are listed with the school at home.
    const home = event.home === false ? opponent : school;
    const away = home === school ? opponent : school;
    out.push({
      id: `school:${college.id}:${event.id}`,
      league,
      state: decided ? "post" : live ? "in" : "pre",
      detail: decided ? `Final${event.result ? ` · ${event.result}` : ""}` : "",
      home,
      away,
      startMs,
      dateOnly: event.allDay ? event.start.slice(0, 10) : undefined,
      source: SCHOOL_SOURCE,
      network: null,
      odds: null,
    });
  }
  return out;
}

/**
 * Followed colleges linked to their JL Vision team, so a school's art, colours and logo apply.
 * The school's short name must match one JL Vision college team exactly (after tidying), and
 * only when no other followed school or JL Vision team claims the same name.
 */
export function linkCollegesToVision(
  colleges: readonly College[],
  vision: readonly VisionTeam[],
): Map<string, string> {
  const teamsByName = new Map<string, VisionTeam[]>();
  for (const team of vision) {
    if (!team.league.startsWith("ncaa-")) continue;
    for (const name of new Set([team.name, team.name.replace(/\([^)]*\)/g, " ")])) {
      const key = normalizeSchool(collegeShortName(name));
      if (!key) continue;
      const list = teamsByName.get(key) ?? [];
      if (!list.includes(team)) list.push(team);
      teamsByName.set(key, list);
    }
  }
  const byName = new Map<string, College[]>();
  for (const college of colleges) {
    const key = normalizeSchool(collegeShortName(college.name));
    byName.set(key, [...(byName.get(key) ?? []), college]);
  }
  const links = new Map<string, string>();
  for (const [key, schools] of byName) {
    const teams = teamsByName.get(key);
    if (schools.length !== 1 || teams?.length !== 1) continue;
    const orgId = /^ncaa:(\d+)$/.exec(schools[0].id)?.[1];
    if (orgId) links.set(providerKey("ncaa", "college", orgId), teams[0].key);
  }
  return links;
}
