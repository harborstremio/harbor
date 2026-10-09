/**
 * Owner-curated sports art: the first choice for a team's, athlete's, student's or college's
 * wallpaper, ahead of TheSportsDB and the designed backdrop. Keys follow JL Media Vision's web
 * app ("team:<league>:<espnId>", ...). No store is wired yet, so every lookup answers null; a
 * per-user art store plugs in here without touching the views.
 */

export const artKey = {
  team: (league: string, espnId: string) => `team:${league.toLowerCase()}:${espnId}`,
  athlete: (league: string, espnId: string) => `athlete:${league.toLowerCase()}:${espnId}`,
  student: (site: string, sport: string, id: string) => `student:${site}:${sport}:${id}`,
  college: (id: string) => `college:${id}`,
};

/** The curated image URL for an art key, or null when none is set. */
export function curatedArt(key: string): string | null {
  void key;
  return null;
}
