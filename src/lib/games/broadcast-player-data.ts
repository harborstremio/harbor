export type BroadcastPlayback = { hlsUrl: string; broadcastId: string; viewerToken: string; heartbeatSeconds: number };
export const validBroadcaster = (id: string) => /^7656119\d{10}$/.test(id);

export function parseBroadcastPlayback(value: unknown, steamId: string): BroadcastPlayback {
  if (!validBroadcaster(steamId) || !value || typeof value !== "object") throw Error("Invalid broadcast");
  const data = value as Record<string, unknown>;
  if (data.success !== "ready") throw Error("Broadcast unavailable");
  const url = new URL(String(data.hls_url));
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
    !/(?:^|\.)steamcontent\.com$/.test(url.hostname) && url.hostname !== "steambroadcast.akamaized.net" ||
    !url.pathname.startsWith(`/broadcast/${steamId}/`) || !url.pathname.endsWith(".m3u8")) throw Error("Invalid broadcast stream");
  const broadcastId = String(data.broadcastid ?? ""), viewerToken = String(data.viewertoken ?? "");
  if (!/^\d{1,20}$/.test(broadcastId) || !/^\d{1,20}$/.test(viewerToken)) throw Error("Invalid broadcast session");
  const interval = Number(data.heartbeat_interval);
  return { hlsUrl: url.href, broadcastId, viewerToken, heartbeatSeconds: Number.isFinite(interval) ? Math.max(15, Math.min(120, interval)) : 30 };
}
