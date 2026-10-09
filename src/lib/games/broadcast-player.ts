import { safeFetch } from "@/lib/safe-fetch";
import { parseBroadcastPlayback, validBroadcaster, type BroadcastPlayback } from "./broadcast-player-data";

/** Public Steam player handshake, requested only after Watch. Session URLs and
 * viewer tokens remain in memory for this player and are never disk-cached. */
export async function loadBroadcastPlayback(steamId: string, signal: AbortSignal): Promise<BroadcastPlayback> {
  if (!validBroadcaster(steamId)) throw Error("Invalid broadcaster");
  const response = await safeFetch(`https://steamcommunity.com/broadcast/getbroadcastmpd/?${new URLSearchParams({ steamid: steamId })}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]) });
  if (!response.ok) throw Error("Broadcast unavailable");
  return parseBroadcastPlayback(await response.json(), steamId);
}

export async function broadcastHeartbeat(steamId: string, playback: BroadcastPlayback, signal: AbortSignal) {
  if (!validBroadcaster(steamId)) return;
  const body = new URLSearchParams({ steamid: steamId, broadcastid: playback.broadcastId, viewertoken: playback.viewerToken });
  await safeFetch("https://steamcommunity.com/broadcast/heartbeat/", { method: "POST", body: body.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" }, signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) });
}
