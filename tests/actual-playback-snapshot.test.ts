import assert from "node:assert/strict";
import test from "node:test";
import { actualPlaybackSnapshot } from "../src/lib/player/actual-playback";
import { initialPlayerSnapshot } from "../src/lib/player/bridge";
import type { PlayerSrc } from "../src/lib/view";

const src: PlayerSrc = {
  meta: { id: "local:short", type: "movie", name: "Short video" },
  url: "C:/synthetic/short.mp4",
  title: "Short video",
  notWebReady: true,
};
const session = {
  id: "session-one",
  actor: { profileId: "one", storageProfileId: "one", accountId: null },
};
test("only decoded actual playback qualifies, including short unrecognized local video", () => {
  const base = initialPlayerSnapshot();
  assert.equal(actualPlaybackSnapshot(src, base, 3, session, 100), null);
  assert.equal(actualPlaybackSnapshot(src, { ...base, status: "playing" }, 3, session, 100), null);
  const playing = { ...base, status: "playing" as const, firstFrameReady: true, durationSec: 40 };
  const result = actualPlaybackSnapshot(src, playing, 3, session, 100);
  assert.equal(result?.positionMs, 3000);
  assert.equal(result?.src.url, src.url);
  assert.equal(result?.completed, false);
  assert.equal(actualPlaybackSnapshot({ ...src, isLive: true }, playing, 3, session, 100), null);
});

test("a proxied source retains original identity but cannot replay a stale proxy session", () => {
  const result = actualPlaybackSnapshot(
    {
      ...src,
      url: "http://127.0.0.1:1111/private-proxy",
      historyUrl: "https://synthetic.invalid/video",
      proxySessionId: "ephemeral",
      playbackTraceId: "trace",
    },
    { ...initialPlayerSnapshot(), status: "playing", firstFrameReady: true, durationSec: 400 },
    30,
    session,
    100,
  );
  assert.equal(result?.src.url, "https://synthetic.invalid/video");
  assert.equal(result?.requiresSourceRefresh, true);
  assert.equal(result?.src.proxySessionId, undefined);
  assert.equal(result?.src.playbackTraceId, undefined);
});

test("completion retains actual item and observed position without selecting Up Next", () => {
  const result = actualPlaybackSnapshot(
    { ...src, episode: { season: 2, episode: 3 } },
    { ...initialPlayerSnapshot(), status: "ended", firstFrameReady: true, durationSec: 100 },
    100,
    session,
    100,
  );
  assert.equal(result?.completed, true);
  assert.deepEqual(result?.src.episode, { season: 2, episode: 3 });
  assert.equal(result?.positionMs, 100000);
});

test("near-end progress is resumable until natural EOF, independent of watched thresholds", () => {
  const base = { ...initialPlayerSnapshot(), firstFrameReady: true, durationSec: 100 };
  for (const status of ["playing", "paused"] as const) {
    const actual = actualPlaybackSnapshot(src, { ...base, status }, 90, session, 100);
    assert.equal(actual?.completed, false);
    assert.equal(actual?.positionMs, 90000);
  }
  assert.equal(
    actualPlaybackSnapshot(src, { ...base, status: "ended" }, 40, session, 100)?.completed,
    false,
    "a truncated stream EOF is not a completed playback",
  );
});
