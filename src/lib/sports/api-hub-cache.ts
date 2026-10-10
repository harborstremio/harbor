import { readSportsApiKey, sportsApiRevision } from "./api-credentials";
import { apiLeagueForHub } from "./api-hub-leagues";
import { readSportsSlice, saveSportsSlice } from "./slice-storage";
import type { SportsSlice } from "./hub-cache";

const memory = new Map<string, SportsSlice>();
let revision = -1;
function usesPaidSource(key: string) {
  const [league, , mode] = key.split("@");
  return mode !== "upcoming" && !!apiLeagueForHub(league) && !!readSportsApiKey();
}
function sync() {
  if (revision !== sportsApiRevision()) {
    memory.clear();
    revision = sportsApiRevision();
  }
}
/** Account-supplied results stay in memory and cannot survive a credential change. */
export function readHubSourceSlice(key: string) {
  sync();
  return usesPaidSource(key) ? memory.get(key) : readSportsSlice(key);
}
export function saveHubSourceSlice(key: string, slice: SportsSlice) {
  sync();
  if (!usesPaidSource(key)) {
    saveSportsSlice(key, slice);
    return;
  }
  memory.delete(key);
  memory.set(key, slice);
  while (memory.size > 48) memory.delete(memory.keys().next().value!);
}
