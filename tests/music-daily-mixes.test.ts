import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { backingTrackVersion } from "../src/lib/music/source-version";
import { planDailyMixes } from "../src/lib/music/daily-mixes";
import type { DailyMix } from "../src/lib/music/daily-mixes";
import type { MusicPlaylist, MusicTrack } from "../src/lib/music/types";

const track = (artist: string, title: string): MusicTrack => ({
  id: `${artist}:${title}`,
  connectorId: "x",
  title,
  artist,
  artwork: `http://a/${encodeURIComponent(artist)}.jpg`,
  durationSeconds: 200,
  durationLabel: "3:20",
});

const RAP = ["Juice WRLD", "Lil Durk", "Moneybagg Yo"];
const DANCE = ["DJ THT", "Basshunter", "Master Blaster", "Topmodelz"];

const shuffled: MusicTrack[] = [
  track("Juice WRLD", "1"),
  track("DJ THT", "2"),
  track("Lil Durk", "3"),
  track("Basshunter", "4"),
  track("Moneybagg Yo", "5"),
  track("Master Blaster", "6"),
  track("Topmodelz", "7"),
];

const playlists: MusicPlaylist[] = [
  {
    id: "p1",
    name: "rap",
    createdAt: "",
    updatedAt: "",
    tracks: RAP.map((artist) => track(artist, "p")),
  },
  {
    id: "p2",
    name: "hands up",
    createdAt: "",
    updatedAt: "",
    tracks: DANCE.map((artist) => track(artist, "p")),
  },
];

const artistGenres = Object.fromEntries([...RAP.map(name => [name.toLowerCase(), ["hip-hop"]]), ...DANCE.map(name => [name.toLowerCase(), ["hands up"]])]);

function scene(artist: string): "rap" | "dance" | "other" {
  if (RAP.includes(artist)) return "rap";
  if (DANCE.includes(artist)) return "dance";
  return "other";
}

test("playlist membership keeps unrelated scenes out of one mix", () => {
  const mixes = planDailyMixes(shuffled, [], {}, 1000, { playlists, artistGenres });
  assert.ok(mixes.length > 0, "expected at least one mix");
  for (const mix of mixes) {
    const scenes = new Set(mix.artists.map(scene));
    assert.equal(
      scenes.size,
      1,
      `mix ${mix.index} mixed scenes: ${mix.artists.join(", ")}`,
    );
  }
});

test("every mix has a usable artist seed", () => {
  for (const mix of planDailyMixes(shuffled, [], {}, 1000, { playlists, artistGenres })) {
    assert.ok(mix.artists.length >= 1, `mix ${mix.index} had ${mix.artists.length} artist(s)`);
  }
});

test("extra sources widen the pool beyond recents and liked", () => {
  const narrow = planDailyMixes([track("Odetari", "a"), track("Odetari", "b")], [], {}, 1000);
  const wide = planDailyMixes([track("Odetari", "a"), track("Odetari", "b")], [], {}, 1000, {
    extra: RAP.map((artist) => track(artist, "s")),
    playlists,
    artistGenres,
  });
  assert.equal(narrow.length, 1, "missing genre metadata keeps a focused Daily Mix available");
  assert.ok(wide.length > 0, "extra sources should produce a mix");
});

function dailyMixes(loadPlaylistLikeThis: (...args: unknown[]) => Promise<MusicTrack[]>) {
  const code = ts.transpileModule(
    readFileSync(new URL("../src/lib/music/daily-mixes.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  let cached: MusicTrack[] | null = null;
  const mocks: Record<string, unknown> = {
    "./source-version": { backingTrackVersion },
    "./search-artists": {
      artistCreditParts: (name: string) => name.split(",").map((part) => part.trim()),
    },
    "./track-identity": {
      musicTrackIdentity: (entry: MusicTrack) => `${entry.artist}|${entry.title}`.toLowerCase(),
    },
    "./artist-authority": { resolveArtist: async (name: string) => ({ canonical: { name } }) },
    "./catalog": { artistTop: loadPlaylistLikeThis },
    "./recent-context": { hydrateMusicContextTracks: async () => {}, heldMusicContextTracks: () => cached, rememberMusicContextTracks: (_kind: string, _id: string, tracks: MusicTrack[]) => { cached = tracks; } },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (id: string) => mocks[id],
    module,
    module.exports,
  );
  return module.exports as typeof import("../src/lib/music/daily-mixes");
}

const mixOf = (seeds: MusicTrack[]): DailyMix => ({
  id: "mix:daily:1",
  index: 1,
  artists: [...new Set(seeds.map((entry) => entry.artist))],
  seeds,
  artwork: [],
});

const offline = async () => {
  throw new Error("music.radio.error");
};

test("a mix opens on its own seeds when every radio lane is unreachable", async () => {
  const api = dailyMixes(offline);
  const seeds = [
    track("Juice WRLD", "a1"),
    track("Juice WRLD", "a2"),
    track("Lil Durk", "b1"),
    track("Lil Durk", "b2"),
  ];
  const out = await api.loadDailyMixTracks(mixOf(seeds));
  assert.deepEqual(
    out.map((entry) => entry.title),
    ["a1", "b1", "a2", "b2"],
    "the fallback alternates artists instead of playing one block each",
  );
  assert.ok(out.every((entry) => entry.mediaKind === "audio"));
});

test("the fallback skips what was already heard", async () => {
  const api = dailyMixes(offline);
  const seeds = [track("Juice WRLD", "a1"), track("Lil Durk", "b1")];
  const out = await api.loadDailyMixTracks(mixOf(seeds), [track("Juice WRLD", "a1")]);
  assert.deepEqual(
    out.map((entry) => entry.title),
    ["b1"],
  );
});

test("catalog expansion rejects unrelated artists instead of filling a genre gap", async () => {
  const built = [track("Someone Else", "z1"), track("Another", "z2")];
  const api = dailyMixes(async () => built);
  const out = await api.loadDailyMixTracks(mixOf([track("Juice WRLD", "a1")]));
  assert.deepEqual(
    out.map((entry) => entry.title),
    ["a1"],
  );
});

test("listening adjacency and a mixed playlist are not evidence of a shared genre", () => {
  const mixes = planDailyMixes(shuffled, [], {}, 1000, { playlists });
  assert.equal(mixes.length, 6);
  assert.ok(mixes.every(mix => mix.artists.length === 1));
});

test("reopening a Daily Mix reuses its queue without another catalog request", async () => {
  let calls = 0;
  const api = dailyMixes(async () => { calls++; return [track("Juice WRLD", "expanded")]; });
  const mix = mixOf([track("Juice WRLD", "seed")]);
  const first = await api.loadDailyMixTracks(mix);
  assert.deepEqual(await api.loadDailyMixTracks(mix), first);
  assert.equal(calls, 1);
});
