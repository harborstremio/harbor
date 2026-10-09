import test from "node:test";
import assert from "node:assert/strict";
import type { MusicConnectorHealth, MusicSearchResults } from "../src/lib/music/types";

type Invoke = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

const globals = globalThis as unknown as { window?: { __TAURI_INTERNALS__: { invoke: Invoke } } };
globals.window = { __TAURI_INTERNALS__: { invoke: async () => undefined } };

const { searchAcrossMusicSources, invalidateMusicHealth, musicHealthSnapshot } =
  await import("../src/lib/music/sources");

const health = (id: string): MusicConnectorHealth => ({
  id,
  name: id,
  health: "healthy",
  searchable: true,
  playable: true,
  scrobbler: false,
});

const results = (id: string): MusicSearchResults => ({
  tracks: [
    { id: `${id}:t1`, title: "Crazy Story", artist: "King Von", connectorId: id } as never,
    { id: `${id}:t2`, title: "Took Her To The O", artist: "King Von", connectorId: id } as never,
  ],
  albums: [{ id: `${id}:al1`, connectorId: id, title: "Welcome to O'Block", artist: "King Von" }],
  artists: [{ id: `${id}:ar1`, connectorId: id, name: "King Von" }],
  playlists: [],
});

type Plan = { failing: Set<string>; healthCalls: number; searched: string[] };

function install(plan: Plan): void {
  globals.window = {
    __TAURI_INTERNALS__: {
      invoke: async (cmd, args) => {
        if (cmd === "music_health") {
          plan.healthCalls += 1;
          return [health("catalog"), health("youtube")];
        }
        if (cmd === "music_search_typed") {
          const connector = String((args as { connector?: string } | undefined)?.connector ?? "");
          plan.searched.push(connector);
          if (plan.failing.has(connector)) throw new Error("request failed");
          return results(connector);
        }
        throw new Error(`unexpected command ${cmd}`);
      },
    },
  };
}

function plan(failing: string[] = []): Plan {
  const next: Plan = { failing: new Set(failing), healthCalls: 0, searched: [] };
  install(next);
  invalidateMusicHealth();
  return next;
}

test("a lane that rejects still lets the surviving lanes through untouched", async () => {
  const state = plan(["youtube"]);
  const merged = await searchAcrossMusicSources("King Von", 24);
  assert.deepEqual(state.searched.sort(), ["catalog", "youtube"]);
  assert.equal(merged.tracks.length, 2, "the surviving lane's tracks must not be dropped");
  assert.equal(merged.albums.length, 1);
  assert.equal(merged.artists.length, 1);
  assert.equal(merged.artists[0]?.id, "catalog:ar1");
  assert.deepEqual(merged.artists[0]?.sourceConnectorIds, ["catalog"]);
});

test("a partial failure is stamped onto laneOutcomes instead of being discarded", async () => {
  plan(["youtube"]);
  const merged = await searchAcrossMusicSources("King Von", 24);
  const outcomes = merged.laneOutcomes ?? [];
  assert.equal(outcomes.length, 2, "every lane must report, not only the survivors");
  const catalog = outcomes.find((entry) => entry.id === "catalog");
  const youtube = outcomes.find((entry) => entry.id === "youtube");
  assert.deepEqual(catalog, {
    id: "catalog",
    ok: true,
    error: null,
    tracks: 2,
    albums: 1,
    artists: 1,
    playlists: 0,
  });
  assert.equal(youtube?.ok, false);
  assert.match(String(youtube?.error), /youtube: request failed/);
  assert.deepEqual(
    [youtube?.tracks, youtube?.albums, youtube?.artists, youtube?.playlists],
    [0, 0, 0, 0],
  );
});

test("one transient lane failure re-reads health instead of freezing the connector out", async () => {
  const state = plan(["youtube"]);
  await musicHealthSnapshot();
  assert.equal(state.healthCalls, 1);
  await musicHealthSnapshot();
  assert.equal(state.healthCalls, 1, "the snapshot is cached inside the TTL");
  await searchAcrossMusicSources("King Von", 24);
  await musicHealthSnapshot();
  assert.equal(
    state.healthCalls,
    2,
    "a partial failure must invalidate health, not only a total blackout",
  );
});

test("an all-healthy fan-out leaves the health cache alone", async () => {
  const state = plan();
  await musicHealthSnapshot();
  assert.equal(state.healthCalls, 1);
  const merged = await searchAcrossMusicSources("King Von", 24);
  assert.ok((merged.laneOutcomes ?? []).every((entry) => entry.ok));
  await musicHealthSnapshot();
  assert.equal(state.healthCalls, 1, "a clean search must not throw away a valid snapshot");
});

test("a total blackout still throws with every reason", async () => {
  plan(["catalog", "youtube"]);
  await assert.rejects(
    () => searchAcrossMusicSources("King Von", 24),
    /catalog: request failed[\s\S]*youtube: request failed/,
  );
});
