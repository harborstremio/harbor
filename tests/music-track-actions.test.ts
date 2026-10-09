import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { splitArtistCredit, resolveDisplayCredits } from "../src/lib/music/artist-credit";
const track = {
  id: "soundcloud:123456",
  connectorId: "soundcloud",
  title: "Went Legit",
  artist: "G Herbo, Southside",
  artwork: "",
  durationSeconds: 180,
  durationLabel: "3:00",
};
const yt = {
  ...track,
  id: "youtube_music:abcdefghijk",
  sourceId: "abcdefghijk",
  connectorId: "youtube_music",
};
const followingTracks = Array.from({ length: 5 }, (_, index) => ({
  ...yt,
  id: `next-${index}`,
  title: `Another Song ${index}`,
  artist: `Artist ${index}`,
  sourceId: `nexttrack0${index}`,
}));
function radio(candidates: any[], related: any[]) {
  const calls: any[] = [];
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/radio.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const mocks: any = {
    "@tauri-apps/api/core": {
      invoke: async (cmd: string, args: any) => {
        calls.push({ cmd, args });
        return candidates;
      },
    },
    "@/lib/safe-fetch": {
      safeFetch: async () => {
        throw new Error("unexpected network request");
      },
    },
    "@/lib/secret-store": { loadSecrets: async () => {}, getSecret: () => "" },
    "./lastfm": { LASTFM_API_KEY: "lastfm" },
    "./recording-profile": { loadRecordingProfile: async () => null },
    "./search-artists": {
      artistCreditParts: (name: string) => name.split(",").map((part) => part.trim()),
    },
    "./search-normalize": {
      normalizeName: (value: string) => value.toLowerCase(),
      normalizeTitle: (value: string) => value.toLowerCase(),
    },
    "./sources": { searchMusic: async () => [] },
    "./player": { getMusicState: () => ({ recents: [], likedTracks: [] }) },
    "./catalog": {
      stationTracks: async (station: any) => {
        calls.push({ station });
        return related;
      },
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id: string) => mocks[id],
    module,
    module.exports,
  );
  return { api: module.exports as typeof import("../src/lib/music/radio"), calls };
}
test("comma and explicit featured credits produce separate navigation targets", () => {
  for (const name of ["G Herbo, Southside", "G Herbo feat. Southside", "G Herbo (ft. Southside)"])
    assert.deepEqual(
      splitArtistCredit(name).map((a) => a.name),
      ["G Herbo", "Southside"],
    );
  assert.deepEqual(
    splitArtistCredit("Simon & Garfunkel").map((a) => a.name),
    ["Simon & Garfunkel"],
  );
});
test("verified punctuation is an artist name; unknown combined credit remains separate", async () => {
  const name = "Tyler, The Creator";
  assert.deepEqual(
    (
      await resolveDisplayCredits(name, async () => [
        { id: "deezer:artist:1", connectorId: "catalog", name },
      ])
    ).map((a) => a.name),
    [name],
  );
  assert.deepEqual(
    (await resolveDisplayCredits("G Herbo, Southside", async () => [])).map((a) => a.name),
    ["G Herbo", "Southside"],
  );
});
test("SoundCloud radio resolves a real YouTube seed, then retains selected song and deduplicates following tracks", async () => {
  const f = radio(
    [{ connectorId: "youtube_music", health: "healthy", track: yt }],
    [yt, ...followingTracks, followingTracks[0]],
  );
  const queue = await f.api.loadTrackRadio(track);
  assert.equal(f.calls[0].cmd, "music_source_candidates");
  assert.deepEqual(f.calls[1].station, {
    id: "RDAMVMabcdefghijk",
    connectorId: "youtube_music",
    name: track.title,
    artwork: "",
  });
  assert.equal(queue[0].id, track.id);
  assert.equal(queue.length, 6);
  assert.equal(new Set(queue.map((entry) => entry.id)).size, queue.length);
});
test("valid YouTube radio avoids unnecessary lookup; unavailable seeds and empty stations reject visibly", async () => {
  const f = radio([], followingTracks);
  await f.api.loadTrackRadio(yt);
  assert.equal(f.calls.length, 1);
  await assert.rejects(radio([], []).api.loadTrackRadio(track), /music.radio.error/);
  await assert.rejects(radio([], []).api.loadTrackRadio(yt), /music.radio.error/);
  await assert.rejects(
    radio([], followingTracks.slice(0, 4)).api.loadTrackRadio(yt),
    /music.radio.error/,
  );
});

test("ampersand collaborations split after verification while verified bands stay intact", async () => {
  assert.equal((await resolveDisplayCredits("Tame Impala & JENNIE", async () => [])).length, 2);
  const name = "Simon & Garfunkel";
  assert.deepEqual(
    (
      await resolveDisplayCredits(name, async () => [
        { id: "deezer:artist:10", name, connectorId: "catalog" },
      ])
    ).map((a) => a.name),
    [name],
  );
});
