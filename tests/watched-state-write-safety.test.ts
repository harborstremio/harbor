import assert from "node:assert/strict";
import test from "node:test";
import { decodeWatchedEpisodes, encodeWatchedEpisodes } from "../src/lib/stremio-watched.ts";

const videos = [
  { id: "tt123:1:1", season: 1, episode: 1 },
  { id: "tt123:1:2", season: 1, episode: 2 },
];

test("strict watched writes reject malformed state instead of clearing other episodes", async () => {
  await assert.rejects(() => decodeWatchedEpisodes("corrupt", videos, true), /malformed/);
  await assert.rejects(() => decodeWatchedEpisodes("tt123:1:1:1:invalid", videos, true), /decoded/);
  assert.deepEqual(await decodeWatchedEpisodes("corrupt", videos), new Set());
});

test("strict watched writes preserve valid state and reject a different episode anchor", async () => {
  const value = await encodeWatchedEpisodes(new Set(["1:2"]), videos);
  assert.deepEqual(await decodeWatchedEpisodes(value, videos, true), new Set(["1:2"]));
  await assert.rejects(() => decodeWatchedEpisodes(value, [videos[0]!], true), /aligned/);
});
