import { safeFetch } from "@/lib/safe-fetch";
import { GamePlayerCounts } from "./player-count-data";
export { PLAYER_COUNT_TTL, type GamePlayerCount } from "./player-count-data";

const counts = new GamePlayerCounts(async (appId, signal) => {
  const response = await safeFetch(`https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/?appid=${appId}`, { signal });
  if (!response.ok) throw Error("Player count unavailable");
  return response.json();
});

/** At most twelve visible games; failed observations are omitted, never changed to zero. */
export function loadCurrentPlayerCounts(appIds: readonly number[], signal?: AbortSignal) {
  return counts.load(appIds, signal);
}
