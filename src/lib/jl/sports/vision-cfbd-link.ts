import type { CfbdTeam } from "./cfbd.ts";
import { providerKey, type VisionTeam } from "./vision-branding.ts";

/**
 * Links JL Vision college teams that the database hasn't linked yet to CollegeFootballData's
 * team list (whose ids are ESPN's), so a viewer only has to add their CFBD key. This runs when the
 * team list loads (once a week per device), not per game, and is deliberately strict: a school
 * name must match exactly after tidying, within the team's division, and any name that fits
 * more than one team on either side is skipped rather than guessed.
 */

/** JL Vision group league → CFBD classification. */
const CLASSIFICATION: Record<string, string> = {
  "ncaa-fbs": "fbs",
  "ncaa-fcs": "fcs",
  "ncaa-dii": "ii",
  "ncaa-diii": "iii",
};

export const CFBD_LEAGUE = "college-football";

/** "San José State" → "san jose state", "Texas A&M" → "texas a and m", "Hawai'i" → "hawaii". */
export function normalizeSchool(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Names to try for a JL Vision team, most exact first. */
function visionNames(team: VisionTeam): string[] {
  const full = normalizeSchool(team.name);
  const bare = normalizeSchool(team.name.replace(/\([^)]*\)/g, " "));
  const short = bare.replace(/\s+(college|university)$/, "").replace(/^university of\s+/, "");
  return [...new Set([full, bare, short].filter(Boolean))];
}

export function linkVisionToCfbd(
  vision: readonly VisionTeam[],
  cfbd: readonly CfbdTeam[],
): Map<string, string> {
  const taken = new Set<string>();
  const unlinked: VisionTeam[] = [];
  for (const team of vision) {
    if (!CLASSIFICATION[team.league]) continue;
    const espn = team.providerIds.find((p) => p.provider === "espn" && p.league === CFBD_LEAGUE);
    if (espn) taken.add(espn.id);
    else unlinked.push(team);
  }

  // Every name each CFBD team goes by, per classification and overall.
  const byName = new Map<string, Set<string>>();
  const add = (key: string, id: string) => {
    const set = byName.get(key) ?? new Set<string>();
    set.add(id);
    byName.set(key, set);
  };
  const classOf = new Map<string, string | null>();
  for (const t of cfbd) {
    if (taken.has(t.id)) continue;
    classOf.set(t.id, t.classification);
    for (const n of [t.school, t.abbreviation, ...t.altNames]) {
      if (!n) continue;
      const key = normalizeSchool(n);
      if (!key) continue;
      add(`*:${key}`, t.id);
      if (t.classification) add(`${t.classification}:${key}`, t.id);
    }
  }

  const unique = (key: string): string | null => {
    const ids = byName.get(key);
    return ids && ids.size === 1 ? [...ids][0] : null;
  };
  const claims = new Map<string, string[]>();
  for (const team of unlinked) {
    const cls = CLASSIFICATION[team.league];
    let found: string | null = null;
    // The team's own division first; any division only when its division has no such name.
    // The first name that exists decides: an ambiguous one is skipped, never loosened.
    for (const scope of [cls, "*"]) {
      const key = visionNames(team)
        .map((name) => `${scope}:${name}`)
        .find((k) => byName.has(k));
      if (!key) continue;
      found = unique(key);
      break;
    }
    if (!found) continue;
    claims.set(found, [...(claims.get(found) ?? []), team.key]);
  }

  const links = new Map<string, string>();
  for (const [id, teams] of claims)
    if (teams.length === 1) links.set(providerKey("espn", CFBD_LEAGUE, id), teams[0]);
  return links;
}
