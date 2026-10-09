import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { changeCustomLibrary, correctCustomPlaytime, customLibraryKey, customPlaytime, emptyCustomLibrary, emptyLaunchConfig, parseCustomLibrary, readCustomLibrary, recordCustomExit, saveCustomConfiguration, upsertCustomGame, type CustomGame } from "../src/lib/games/custom-library.ts";

const game = (): CustomGame => ({ id: randomUUID(), name: "Same title", config: { ...emptyLaunchConfig(), executable: "W:/Games/game.exe" }, linked: null, artwork: null, pinned: false, hidden: false, addedAt: 1, lastPlayed: 0, measuredSeconds: 7200 });
const receipt = (item: CustomGame) => ({ profile: "test", id: item.id, sessionId: randomUUID(), pid: 1, startedAt: 10, endedAt: 600010, seconds: 600, success: true, code: 0 });

test("corrections retain source counters, sessions and separate copies including explicit zero", () => {
  const first = game(), second = game(), store = { ...emptyCustomLibrary(), games: [first, second] };
  const next = correctCustomPlaytime(store, first.id, 0, 30);
  assert.equal(customPlaytime(next.games.find(item => item.id === first.id)!), 0);
  assert.equal(customPlaytime(next.games.find(item => item.id === second.id)!), 7200);
  assert.equal(next.games[0].measuredSeconds, 7200);
  assert.deepEqual(next.games[0].playtimeCorrection, { totalSeconds: 0, measuredSeconds: 7200, changedAt: 30 });
  assert.deepEqual(next.sessions, store.sessions);
  assert.equal(first.playtimeCorrection, undefined);
});

test("subsequent measured sessions increment the adjusted total once and reset reveals all measured time", () => {
  const first = game(), event = receipt(first);
  let store = correctCustomPlaytime({ ...emptyCustomLibrary(), games: [first] }, first.id, 36000, 30);
  store = recordCustomExit(store, event, event.startedAt);
  store = recordCustomExit(store, event, event.startedAt);
  assert.equal(customPlaytime(store.games[0]), 36600);
  assert.equal(store.games[0].measuredSeconds, 7800);
  assert.equal(store.sessions.length, 1);
  const reset = correctCustomPlaytime(store, first.id, null, 50);
  assert.equal(customPlaytime(reset.games[0]), 7800);
  assert.equal(reset.games[0].playtimeCorrection, undefined);
  assert.deepEqual(reset.sessions, store.sessions);
});

test("old version1 stores round-trip and malformed correction data fails closed", () => {
  const first = game(), store = { ...emptyCustomLibrary(), games: [first] };
  assert.deepEqual(parseCustomLibrary(JSON.stringify(store)), store);
  const next = correctCustomPlaytime(store, first.id, 3600, 30);
  assert.deepEqual(parseCustomLibrary(JSON.stringify(next)), next);
  const extreme = correctCustomPlaytime({ ...store, games: [{ ...first, measuredSeconds: Number.MAX_SAFE_INTEGER }] }, first.id, 600, 30);
  assert.equal(customPlaytime(extreme.games[0]), 600);
  for (const correction of [null, {}, { totalSeconds: -1, measuredSeconds: 0, changedAt: 1 }, { totalSeconds: 1, measuredSeconds: 7201, changedAt: 1 }, { totalSeconds: 3_600_000_001, measuredSeconds: 0, changedAt: 1 }]) {
    assert.throws(() => parseCustomLibrary(JSON.stringify({ ...store, games: [{ ...first, playtimeCorrection: correction }] })));
  }
  assert.throws(() => parseCustomLibrary(JSON.stringify({ ...store, games: [{ ...first, measuredSeconds: Number.MAX_SAFE_INTEGER, playtimeCorrection: { totalSeconds: 600, measuredSeconds: 0, changedAt: 1 } }] })));
  for (const seconds of [NaN, Infinity, -1, 1.5, 3_600_000_001]) assert.throws(() => correctCustomPlaytime(store, first.id, seconds));
  assert.throws(() => correctCustomPlaytime(store, randomUUID(), 0));
});

test("serialized exit and correction use the latest observation in either order; profile and quota failures preserve data", async () => {
  const values = new Map<string, string>(); let full = false;
  globalThis.localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { if (full) throw Error("quota"); values.set(key, value); } } as Storage;
  const first = game(), event = receipt(first);
  await changeCustomLibrary("test", store => upsertCustomGame(store, first));
  await Promise.all([
    changeCustomLibrary("test", store => recordCustomExit(store, event, event.startedAt)),
    changeCustomLibrary("test", store => correctCustomPlaytime(store, first.id, 1000, 50)),
  ]);
  assert.equal(customPlaytime(readCustomLibrary("test").games[0]), 1000);
  assert.equal(readCustomLibrary("test").games[0].playtimeCorrection?.measuredSeconds, 7800);
  await Promise.all([
    changeCustomLibrary("test", store => correctCustomPlaytime(store, first.id, 2000, 60)),
    changeCustomLibrary("test", store => recordCustomExit(store, { ...event, sessionId: randomUUID() }, event.startedAt)),
  ]);
  assert.equal(customPlaytime(readCustomLibrary("test").games[0]), 2600);
  assert.deepEqual(readCustomLibrary("another").games, []);
  const raw = values.get(customLibraryKey("test")); full = true;
  await assert.rejects(changeCustomLibrary("test", store => correctCustomPlaytime(store, first.id, null)));
  assert.equal(values.get(customLibraryKey("test")), raw);
  full = false; values.set(customLibraryKey("broken"), "broken");
  await assert.rejects(changeCustomLibrary("broken", store => correctCustomPlaytime(store, first.id, 100)));
  assert.equal(values.get(customLibraryKey("broken")), "broken");
});

test("saving an older configuration draft cannot erase a correction, reset or new session", () => {
  const first = game(), draft = { ...first, name: "Renamed" };
  let store = correctCustomPlaytime({ ...emptyCustomLibrary(), games: [first] }, first.id, 36000, 30);
  const event = receipt(first);
  store = recordCustomExit(store, event, event.startedAt);
  store = saveCustomConfiguration(store, draft);
  assert.equal(store.games[0].name, "Renamed");
  assert.equal(customPlaytime(store.games[0]), 36600);
  const oldCorrectedDraft = store.games[0];
  store = correctCustomPlaytime(store, first.id, null);
  store = saveCustomConfiguration(store, oldCorrectedDraft);
  assert.equal(store.games[0].playtimeCorrection, undefined);
  assert.equal(customPlaytime(store.games[0]), 7800);
  assert.equal(store.sessions.length, 1);
});
