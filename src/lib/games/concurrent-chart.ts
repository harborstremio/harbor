import { safeFetch } from "@/lib/safe-fetch";
import { loadGameHighlights } from "./catalog";
import { concurrentChartGames, parseConcurrentChart, type ConcurrentChart } from "./concurrent-chart-data";
import { PLAYER_COUNT_TTL } from "./player-counts";
export type { ConcurrentChart } from "./concurrent-chart-data";

let snapshot: ConcurrentChart | undefined;
export function readConcurrentSteamChart() { return snapshot; }

export async function loadConcurrentSteamChart(signal: AbortSignal, initial?: (chart: ConcurrentChart) => void, force = false): Promise<ConcurrentChart> {
  if (!force && snapshot && Date.now()>=snapshot.observedAt && Date.now()-snapshot.observedAt<PLAYER_COUNT_TTL) return snapshot;
  const response = await safeFetch("https://api.steampowered.com/ISteamChartsService/GetGamesByConcurrentPlayers/v1/", { signal: AbortSignal.any([signal,AbortSignal.timeout(12_000)]) });
  if (!response.ok) throw Error("Concurrent chart unavailable");
  const { ranks, publishedAt } = parseConcurrentChart(await response.json()), observedAt = Date.now();
  signal.throwIfAborted();
  // Paint the opening four pages before requesting metadata for the rest of the
  // chart. Existing charts refresh atomically; only an empty screen uses initial.
  const first = await loadGameHighlights(ranks.slice(0,24).map(rank=>rank.appId));
  signal.throwIfAborted();
  const opening=concurrentChartGames(ranks,first);
  if (opening.length) initial?.({games:opening,observedAt,publishedAt});
  const rest = await Promise.allSettled(Array.from({length:Math.ceil(Math.max(0,ranks.length-24)/24)},(_,index)=>loadGameHighlights(ranks.slice(24+index*24,48+index*24).map(rank=>rank.appId))));
  signal.throwIfAborted();
  if (rest.some(result=>result.status==='rejected')) throw Error('Concurrent chart metadata unavailable');
  const games=[...first,...rest.flatMap(result=>result.status==='fulfilled'?result.value:[])];
  signal.throwIfAborted();
  const ordered = concurrentChartGames(ranks, games);
  if (!ordered.length) throw Error("Concurrent chart metadata unavailable");
  const result = { games: ordered, observedAt, publishedAt };
  snapshot=result;
  return result;
}
