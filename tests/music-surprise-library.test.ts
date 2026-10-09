import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { withTimeout } from "../src/lib/progressive-rows";
import { mixRecordings } from "../src/lib/music/mix-quality";
import { musicTrackIdentity } from "../src/lib/music/track-identity";
import type { MusicPlaylist, MusicTrack } from "../src/lib/music/types";

const song = (n: number): MusicTrack => ({ id: String(n), title: `Song ${n}`, artist: `Artist ${n}`, artwork: `${n}.jpg`, durationSeconds: 180, durationLabel: "3:00" });
function fixture() {
  const playlists: MusicPlaylist[] = [{ id: "mine", name: "My mix", createdAt: "", updatedAt: "", tracks: [song(1), song(2)] }];
  const calls: string[] = [];
  let active = 0, peak = 0;
  const abort = new AbortController();
  let hold: (() => Promise<void>) | undefined;
  const mocks: Record<string, unknown> = {
    "@/lib/progressive-rows": { withTimeout },
    "./library": { listMusicPlaylists: async () => playlists },
    "./taste-pool": { loadTastePool: async () => { calls.push("saved"); return { tracks: [song(3)] }; }, cachedTastePool: () => ({ tracks: [] }) },
    "./mix-quality": { mixRecordings },
    "./surprise-selection": { shuffleSurprise: (values: unknown[]) => [...values] },
    "./spotify-library": { loadSpotifyLibraryPage: async (kind: string, offset = 0, id = "") => {
      calls.push(`${kind}:${offset}:${id}`); active++; peak = Math.max(peak, active);
      if (hold) await hold();
      await new Promise(resolve => setImmediate(resolve)); active--;
      return kind === "playlists"
        ? { playlists: Array.from({ length: 8 }, (_, n) => ({ id: `playlist-${n}`, canRead: n > 0 })) }
        : { tracks: [song(10 + Number(id.at(-1)) + (offset ? 100 : 0))], total: 200 };
    } },
  };
  const source = readFileSync(new URL("../src/lib/music/surprise-library.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => { assert.ok(id in mocks, id); return mocks[id]; }, module, module.exports);
  return { api: module.exports as typeof import("../src/lib/music/surprise-library"), playlists, calls, abort, peak: () => peak, hold: (fn: () => Promise<void>) => { hold = fn; } };
}

test("current profile playlists contribute even without saved songs or a Spotify account", async () => {
  const h = fixture();
  assert.deepEqual(await h.api.loadSurpriseLibrary(false, true, h.abort.signal), [song(1), song(2)]);
  assert.deepEqual(h.calls, [], "secondary profiles never read the primary Spotify account");
  h.playlists[0].tracks.push(song(4));
  assert.deepEqual(await h.api.loadSurpriseLibrary(false, false, h.abort.signal), [song(1), song(2), song(4)]);
});

test("Spotify samples readable user playlists and deeper pages with two requests at a time", async () => {
  const h = fixture();
  const tracks = await h.api.loadSurpriseLibrary(true, true, h.abort.signal);
  assert.ok(tracks.some(track => track.id === "1") && tracks.some(track => track.id === "3"));
  assert.equal(h.calls.filter(call => call.startsWith("playlist:")).length, 8);
  assert.ok(!h.calls.some(call => call.endsWith(":playlist-0")));
  assert.ok(h.calls.some(call => /^playlist:(50|100|150):/.test(call)));
  assert.ok(h.peak() <= 2);
  assert.equal(new Set(tracks.map(musicTrackIdentity)).size, tracks.length);
});

test("cancelling playlist loading prevents further requests and discards late results", async () => {
  const h = fixture();
  let release!: () => void;
  h.hold(() => new Promise<void>(resolve => { release = resolve; }));
  const pending = h.api.loadSurpriseLibrary(true, true, h.abort.signal);
  await new Promise(resolve => setImmediate(resolve));
  h.abort.abort(); release();
  assert.deepEqual(await pending, []);
  assert.equal(h.calls.filter(call => call.startsWith("playlist:")).length, 0);
});
