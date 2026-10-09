import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as selection from "../src/lib/music/daily-discovery-selection";
import * as genres from "../src/lib/music/genre-catalog";
import { artistIdentityKey } from "../src/lib/music/artist-popularity";
import type { MusicTrack } from "../src/lib/music/types";

const day = "2026-09-29";
const track = (artist: string, number: number): MusicTrack => ({ id: `${artist}:${number}`, artist, title: `Song ${number}`, artwork: `${artist}.jpg`, durationSeconds: 180, durationLabel: "3:00" });
const pool = Array.from({ length: 12 }, (_, artist) => Array.from({ length: 12 }, (_, number) => track(`Artist ${artist}`, number))).flat();

test("daily selection requires real artist variety, caps each artist, and interleaves artists", () => {
  const dominated = Array.from({ length: 100 }, (_, n) => track(n % 2 ? "Chris Brown" : "Chris_Brown", n));
  assert.deepEqual(selection.selectDailyTracks(dominated, day, "taste"), []);
  assert.deepEqual(selection.selectDailyTracks(pool.slice(0, 48), day, "taste"), [], "four artists cannot become a daily mix");
  const result = selection.selectDailyTracks([...dominated, ...pool], day, "taste");
  assert.ok(selection.dailyMixHasVariety(result));
  assert.equal(result.length, 30);
  assert.ok(result.filter(value => selection.dailyArtistKey(value) === "chris brown").length <= 3);
  assert.ok(result.every((value, i) => !i || selection.dailyArtistKey(value) !== selection.dailyArtistKey(result[i - 1])));
});

test("same-day queues are deterministic and rotate songs the following day", () => {
  const a = selection.selectDailyTracks(pool, day, "taste");
  assert.deepEqual(selection.selectDailyTracks([...pool].reverse(), day, "taste"), a);
  const b = selection.selectDailyTracks(pool, "2026-09-30", "taste");
  assert.notDeepEqual(b.map(value => value.id).sort(), a.map(value => value.id).sort());
  assert.notDeepEqual(selection.selectDailyTracks(pool, day, "other"), a);
});

test("recording duplicates, backing tracks and videos never count toward variety", () => {
  const result = selection.selectDailyTracks([
    ...pool, ...pool.map(value => ({ ...value, id: `spotify:${value.id}`, connectorId: "spotify" })),
    ...pool.map(value => ({ ...value, id: `backing:${value.id}`, title: `${value.title} (Instrumental)` })),
    ...pool.map(value => ({ ...value, id: `video:${value.id}`, mediaKind: "video" as const })),
  ], day, "taste");
  assert.deepEqual(result, selection.selectDailyTracks(pool, day, "taste"));
});

function api(options: { artists?: number; fail?: boolean; saved?: Record<string, MusicTrack[]> } = {}) {
  let queries = 0;
  let blocked = "";
  const stored: Record<string, unknown> = {};
  const source = readFileSync(new URL("../src/lib/music/daily-discovery.ts", import.meta.url), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const mocks: Record<string, unknown> = {
    "./artist-popularity": { artistIdentityKey },
    "./artist-authority": { resolveArtist: async (name: string) => ({ canonical: { id: name, name } }) },
    "./artist-blocks": { filterBlockedTracks: (tracks: MusicTrack[]) => tracks.filter(value => value.artist !== blocked) },
    "./catalog": { artistTop: async ({ name }: { name: string }) => { queries++; return options.fail ? [] : Array.from({ length: 12 }, (_, n) => track(name, n)); } },
    "./discovery": { loadMusicGenreSelection: async () => ({ tracks: Array.from({ length: 50 }, (_, n) => track("Chris Brown", n)) }) },
    "./genre-artist-roster": { loadGenreArtistRoster: async (id: number) => ({ artists: Array.from({ length: options.artists ?? 12 }, (_, n) => ({ id: `genre${id}-artist${n}`, name: `Genre ${id} Artist ${n}` })), next: null }) },
    "./genre-catalog": genres,
    "./daily-discovery-selection": selection,
    "./local-store": { readLocalJson: async () => options.saved ?? null, writeLocalJson: (key: string, value: unknown) => { stored[key] = value; } },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((id: string) => {
    assert.ok(id in mocks, `Unexpected dependency: ${id}`);
    return mocks[id];
  }, module, module.exports);
  return { music: module.exports as typeof import("../src/lib/music/daily-discovery"), queries: () => queries, stored, block: (name: string) => { blocked = name; } };
}

test("plans use explicit tastes, rotate daily, and isolate profiles/tastes with versioned IDs", () => {
  const { music } = api();
  const plan = music.planDailyDiscovery([116, 132, 116], day, "me");
  assert.deepEqual(new Set(plan.map(value => value.genreId)), new Set([116, 132]));
  assert.deepEqual(music.planDailyDiscovery([132, 116], day, "me"), plan);
  assert.notEqual(music.planDailyDiscovery([116, 132], "2026-09-30", "me")[0].id, plan[0].id);
  assert.notEqual(music.planDailyDiscovery([116, 132], day, "you")[0].id, plan[0].id);
  assert.equal(music.parseDailyDiscoveryId("mix:daily:v2:chris%20brown"), null);
  assert.equal(music.planDailyDiscovery([], day, "new-user").length, 4);
});

test("a generic contaminated chart cannot leak artists into every genre, including through cache", async () => {
  const { music, queries } = api();
  const plans = music.planDailyDiscovery([116, 132], day, "me");
  const mixes = await music.loadDailyDiscoveryMixes([116, 132], day, "me");
  assert.equal(mixes.length, 2);
  for (const mix of mixes) {
    assert.ok(mix.tracks.every(value => value.artist.startsWith(`Genre ${mix.genreId} `)));
    assert.ok(selection.dailyMixHasVariety(mix.tracks));
    assert.equal(mix.artwork.length, 4);
  }
  const before = queries();
  assert.deepEqual((await music.loadDailyDiscoveryMix(plans[0].id, plans[0].index))?.tracks, mixes[0].tracks);
  assert.equal(queries(), before, "same-day replay makes no catalog requests");
});

test("invalid one-artist snapshots rebuild; simultaneous opens share one request", async () => {
  const id = api().music.planDailyDiscovery([116], day, "me")[0].id;
  const { music, queries } = api({ saved: { [id]: Array.from({ length: 45 }, (_, n) => track("YNW Melly", n)) } });
  const [a, b] = await Promise.all([music.loadDailyDiscoveryMix(id), music.loadDailyDiscoveryMix(id)]);
  assert.ok(a && b);
  assert.ok(selection.dailyMixHasVariety(a.tracks));
  assert.deepEqual(a, b);
  assert.equal(queries(), 8);
});

test("insufficient artists or unavailable sources do not become artist-only daily mixes", async () => {
  for (const options of [{ artists: 1 }, { artists: 4 }, { fail: true }]) {
    const { music, stored } = api(options);
    assert.deepEqual(await music.loadDailyDiscoveryMixes([116], day, "me"), []);
    assert.deepEqual(stored, {});
  }
});

test("artist blocks are respected when a cached queue is reopened", async () => {
  const { music, block } = api();
  const id = music.planDailyDiscovery([116], day, "me")[0].id;
  const before = (await music.loadDailyDiscoveryMix(id))!;
  block(before.tracks[0].artist);
  const after = (await music.loadDailyDiscoveryMix(id))!;
  assert.ok(after.tracks.every(value => value.artist !== before.tracks[0].artist));
  assert.ok(selection.dailyMixHasVariety(after.tracks));
});
