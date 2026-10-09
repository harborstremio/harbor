import { queryIgdb } from "./atlas";
import { ATLAS_DETAIL_FIELDS, ROM_HACK_PLATFORMS, parseAtlasGame } from "./igdb-data";
import { isRomHack } from "./hack-catalog";

/** Most-reviewed well-rated hacks, not an editorial list or download chart. */
export function hackSpotlightQuery(baseId?: number) {
  if (baseId !== undefined && (!Number.isSafeInteger(baseId) || baseId <= 0)) throw new Error("Invalid base game");
  const platforms = ROM_HACK_PLATFORMS.join(",");
  return `fields ${ATLAS_DETAIL_FIELDS}; where game_type = 5 & parent_game != null & parent_game.platforms = (${platforms}) & platforms = (${platforms}) & total_rating >= 75 & total_rating_count >= 5 & first_release_date <= ${Math.floor(Date.now() / 86400000) * 86400} & cover != null${baseId ? ` & parent_game = ${baseId}` : ""}; sort total_rating_count desc; limit 48;`;
}

export async function loadHackSpotlights(signal?: AbortSignal, baseId?: number) {
  const rows = await queryIgdb(hackSpotlightQuery(baseId), signal);
  return rows.map(parseAtlasGame).filter(isRomHack).filter(game => game.hero || game.screenshots.length).slice(0, 24);
}
