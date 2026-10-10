import test from "node:test";
import assert from "node:assert/strict";
import { rememberMusicContextTracks, reopenMusicMix } from "../src/lib/music/recent-context.ts";
import type { MusicTrack } from "../src/lib/music/types";

test("reopening a mix preserves its seed, identity and cached queue", async () => {
  const seed: MusicTrack = { id: "seed", connectorId: "deezer", title: "Original seed", artist: "Artist", artwork: "", durationSeconds: 180, durationLabel: "3:00" };
  const tracks = [{ ...seed, id: "recommendation", title: "Recommended song" }];
  rememberMusicContextTracks("similar", "original-mix", tracks);
  const requests: unknown[] = [];
  await reopenMusicMix({ kind: "similar", id: "original-mix", name: "My mix", artwork: [], at: 1, seed }, request => requests.push(request));
  assert.deepEqual(requests, [{ kind: "similar", track: seed, queue: tracks, label: "My mix", contextId: "original-mix" }]);
});

test("a context with no seed does not navigate to an unrelated page", async () => {
  let opened = false;
  await reopenMusicMix({ kind: "similar", id: "missing", name: "Missing", artwork: [], at: 1 }, () => { opened = true; });
  assert.equal(opened, false);
});
test("legacy Daily Mix caches drop unrelated scenes and instrumental editions", async () => {
  const seed = { id: "rap", title: "Song", artist: "Rap Artist", artwork: "", durationSeconds: 180, durationLabel: "3:00" };
  const unrelated = { ...seed, id: "dance", artist: "Dance Artist" };
  const backing = { ...seed, id: "backing", title: "Song (Instrumental)" };
  rememberMusicContextTracks("similar", "mix:daily:1", [seed, unrelated, backing]);
  let queue: MusicTrack[] = [];
  let label: string | undefined;
  await reopenMusicMix({ kind: "similar", id: "mix:daily:1", name: "Daily Mix 1", artwork: [], at: 1, seed }, request => { if (request.kind === "similar") { queue = request.queue ?? []; label = request.label; } });
  assert.deepEqual(queue, [seed]);
  assert.equal(label, "Rap Artist Mix", "a one-artist cache is accurately labelled when reopened");
});
