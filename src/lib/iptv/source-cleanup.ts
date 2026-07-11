import { removeStatsForSource } from "./channel-stats";
import { removeCountryPrefs } from "./country-prefs";
import { removeEpgOverridesForSource } from "./epg-map";
import { clearEpg } from "./epg-store";
import { removeGroupPrefs } from "./group-order";
import { removePinsForSource } from "./pins";
import { clearPlaylistCache } from "./store";

export function purgePlaylistState(id: string, removeFavoritesForSource?: (sourceId: string) => void): void {
  if (!id) return;
  clearPlaylistCache(id);
  clearEpg(id);
  removeStatsForSource(id);
  removePinsForSource(id);
  removeGroupPrefs(id);
  removeCountryPrefs(id);
  removeEpgOverridesForSource(id);
  removeFavoritesForSource?.(id);
}
