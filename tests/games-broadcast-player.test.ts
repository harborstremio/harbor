import test from "node:test";
import assert from "node:assert/strict";
import { parseBroadcastPlayback } from "../src/lib/games/broadcast-player-data.ts";
const steamId = "76561199845912453";
const ready = { success: "ready", hls_url: `https://cache13-ord1.steamcontent.com/broadcast/${steamId}/6931083642557487580/hls_manifest/0/cache13-ord1.steamcontent.com/master.m3u8?broadcast_origin=ext2-ord1.steamserver.net`, broadcastid: "2947567400459043126", viewertoken: "4112959867763438248", heartbeat_interval: 30 };

test("the public broadcast handshake preserves uint64 identity and Steam's HLS endpoint", () => {
  const parsed = parseBroadcastPlayback(ready, steamId);
  assert.equal(parsed.hlsUrl, ready.hls_url); assert.equal(parsed.broadcastId, ready.broadcastid);
  assert.equal(parsed.viewerToken, ready.viewertoken); assert.equal(parsed.heartbeatSeconds, 30);
});
test("missing, ended, restricted and waiting streams never become a player URL", () => {
  for (const success of ["end", "waiting", "waiting_for_start", "missing_subscription", "user_restricted", 1]) assert.throws(() => parseBroadcastPlayback({ ...ready, success }, steamId));
  assert.throws(() => parseBroadcastPlayback(null, steamId));
});
test("reject unrelated stream origins, credentials, wrong broadcaster and non-HLS paths", () => {
  for (const hls_url of ["javascript:alert(1)", ready.hls_url.replace("https:", "http:"), ready.hls_url.replace("steamcontent.com", "steamcontent.com.evil.test"), ready.hls_url.replace(steamId, "76561199845912454"), ready.hls_url.replace("https://", "https://user:pass@"), ready.hls_url.replace(".m3u8", ".html")]) assert.throws(() => parseBroadcastPlayback({ ...ready, hls_url }, steamId));
  assert.throws(() => parseBroadcastPlayback(ready, "bad"));
  assert.throws(() => parseBroadcastPlayback({ ...ready, viewertoken: "<script>" }, steamId));
});
test("server heartbeat values are bounded", () => {
  assert.equal(parseBroadcastPlayback({ ...ready, heartbeat_interval: 0 }, steamId).heartbeatSeconds, 15);
  assert.equal(parseBroadcastPlayback({ ...ready, heartbeat_interval: 10000 }, steamId).heartbeatSeconds, 120);
});
