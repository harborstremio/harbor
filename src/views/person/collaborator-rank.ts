import type { TitleCreditPerson } from "@/lib/providers/tmdb/tmdb-title-credits";

export type CollaboratorTitle = {
  key: string;
  cast: TitleCreditPerson[];
  crew: TitleCreditPerson[];
};

export type CollaboratorRole = "Director" | "Writer";

export type Collaborator = {
  id: number;
  name: string;
  profilePath: string | null;
  titles: number;
  popularity: number;
  role: CollaboratorRole | null;
};

export const BILLING_CAP = 15;

export const MIN_SHARED_TITLES = 2;

export const COLLAB_RAIL_MIN = 3;
export const COLLAB_RAIL_MAX = 18;

const CREW_ROLES: Array<[job: string, role: CollaboratorRole]> = [
  ["Director", "Director"],
  ["Writer", "Writer"],
  ["Screenplay", "Writer"],
  ["Story", "Writer"],
  ["Teleplay", "Writer"],
];
const CREW_ROLE_BY_JOB = new Map(CREW_ROLES);
const CREW_CAP = 10;

type Tally = {
  id: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  titles: Set<string>;
  wasCast: boolean;
  directed: number;
  wrote: number;
};

function topBilled(cast: TitleCreditPerson[], personId: number): TitleCreditPerson[] {
  const best = new Map<number, TitleCreditPerson>();
  for (const p of cast) {
    if (p.id === personId) continue;
    const existing = best.get(p.id);
    if (!existing || (p.order ?? Number.MAX_SAFE_INTEGER) < (existing.order ?? Number.MAX_SAFE_INTEGER)) {
      best.set(p.id, p);
    }
  }
  return [...best.values()]
    .sort(
      (a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER),
    )
    .slice(0, BILLING_CAP);
}

function roleOf(tally: Tally): CollaboratorRole | null {
  if (tally.wasCast) return null;
  if (tally.directed === 0 && tally.wrote === 0) return null;
  return tally.directed >= tally.wrote ? "Director" : "Writer";
}

export function rankCollaborators(
  titles: CollaboratorTitle[],
  personId: number,
): Collaborator[] {
  const tallies = new Map<number, Tally>();
  const counted = new Set<string>();

  const touch = (p: TitleCreditPerson): Tally => {
    let entry = tallies.get(p.id);
    if (!entry) {
      entry = {
        id: p.id,
        name: p.name,
        profilePath: p.profilePath,
        popularity: p.popularity,
        titles: new Set(),
        wasCast: false,
        directed: 0,
        wrote: 0,
      };
      tallies.set(p.id, entry);
    }
    if (!entry.profilePath) entry.profilePath = p.profilePath;
    if (p.popularity > entry.popularity) entry.popularity = p.popularity;
    return entry;
  };

  for (const title of titles) {
    if (counted.has(title.key)) continue;
    counted.add(title.key);
    for (const p of topBilled(title.cast, personId)) {
      const entry = touch(p);
      entry.titles.add(title.key);
      entry.wasCast = true;
    }
    let crewSeen = 0;
    for (const p of title.crew) {
      if (crewSeen >= CREW_CAP) break;
      if (p.id === personId) continue;
      const role = CREW_ROLE_BY_JOB.get(p.job ?? "");
      if (!role) continue;
      crewSeen += 1;
      const entry = touch(p);
      entry.titles.add(title.key);
      if (role === "Director") entry.directed += 1;
      else entry.wrote += 1;
    }
  }

  return [...tallies.values()]
    .filter((e) => e.titles.size >= MIN_SHARED_TITLES)
    .map((e) => ({
      id: e.id,
      name: e.name,
      profilePath: e.profilePath,
      titles: e.titles.size,
      popularity: e.popularity,
      role: roleOf(e),
    }))
    .sort(
      (a, b) =>
        b.titles - a.titles ||
        Number(a.role !== null) - Number(b.role !== null) ||
        b.popularity - a.popularity ||
        a.name.localeCompare(b.name),
    )
    .slice(0, COLLAB_RAIL_MAX);
}
