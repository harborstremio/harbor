import test from "node:test";
import assert from "node:assert/strict";
import { claimSourceAlert, markSourceAlertsRead, readSourceAlerts, recordSourceAlertCheck, setSourceAlert, sourceAlertGame, sourceAlertMatch, SOURCE_ALERT_PREFIX } from "../src/lib/games/source-alerts.ts";
import { checkSourceAlerts, SOURCE_ALERT_INTERVAL, type SourceAlertFeed } from "../src/lib/games/source-alert-check.ts";
import type { GameSource, SourceRelease } from "../src/lib/games/sources.ts";
const game = { id: "steam:10", steamId: 10, name: "Example Game", capsule: "https://example.org/art.jpg", platforms: ["Windows"] };
const release: SourceRelease = { id: "r", title: "Example Game – v1.2", kind: "game", files: [{ name: "Game", url: "https://example.org/game.zip", kind: "direct" }] };
const source: GameSource = { id: "s", name: "My source", url: "https://example.org/source.json", enabled: true, format: "community", checkedAt: 0, entries: [release], skipped: 0 };
function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
const abort = () => new AbortController();
const feed = (overrides: Partial<SourceAlertFeed> = {}): SourceAlertFeed => ({ catalog: async s => s, website: async s => ({ entries: s.entries, next: null }), yield: async () => {}, ...overrides });
function watch(store = storage(), id = "w") { setSourceAlert("a", game, true, store, 1, id); return { store, watch: readSourceAlerts("a", store).watches[0] }; }

test("profile-scoped opt-in persists independently of saves; turning off and rearming defeats an old result", () => {
  const { store, watch: first } = watch();
  assert.equal(readSourceAlerts("b", store).watches.length, 0);
  setSourceAlert("a", game, true, store, 2, "duplicate");
  assert.equal(readSourceAlerts("a", store).watches[0].id, first.id);
  setSourceAlert("a", game, false, store);
  assert.equal(claimSourceAlert("a", first.id, source, release, store), null);
  setSourceAlert("a", game, true, store, 3, "new");
  assert.equal(claimSourceAlert("a", first.id, source, release, store), null);
  assert.ok(claimSourceAlert("a", "new", source, release, store));
});

test("one durable notification per opt-in across polls/restarts; read state and alert cancellation retain inbox history", () => {
  const { store } = watch();
  const notice = claimSourceAlert("a", "w", source, release, store, 10)!;
  assert.equal(notice.match, "title");
  assert.equal(readSourceAlerts("a", store).watches[0].foundAt, 10);
  assert.equal(claimSourceAlert("a", "w", source, release, store, 20), null);
  markSourceAlertsRead("a", store);
  assert.equal(readSourceAlerts("a", store).notices[0].read, true);
  setSourceAlert("a", game, false, store);
  assert.equal(readSourceAlerts("a", store).notices.length, 1);
});

test("matches reject sequels, conflicting identities/platforms and update-only content; preserve versioned full releases", () => {
  assert.equal(sourceAlertMatch(release, game), "title");
  assert.equal(sourceAlertMatch({ ...release, steamId: 10 }, game), "identity");
  for (const entry of [{ ...release, steamId: 11 }, { ...release, title: "Example Game 2" }, { ...release, platform: "PS2" }, { ...release, kind: "patch" as const }, { ...release, files: [] }, { ...release, title: "Example Game – Soundtrack" }, { ...release, title: "Example Game - Update only v1.2" }]) assert.equal(sourceAlertMatch(entry, game), null);
  assert.equal(sourceAlertMatch({ ...release, title: "Example Game – v1.2 + 4 DLCs" }, game), "title");
  assert.equal(sourceAlertGame({ ...game, id: "igdb:22", igdbId: 22, catalogSteamId: 10 })?.steamId, undefined);
  assert.equal(sourceAlertGame({ ...game, capsule: "javascript:bad" })?.capsule, "");
});

test("storage failures and corrupt state never claim success or overwrite pending alerts", () => {
  const { store } = watch();
  const denied = { ...store, setItem: () => { throw Error("quota"); } };
  assert.throws(() => claimSourceAlert("a", "w", source, release, denied), /quota/);
  assert.equal(readSourceAlerts("a", store).watches[0].foundAt, undefined);
  store.setItem(SOURCE_ALERT_PREFIX + "a", "broken");
  assert.throws(() => setSourceAlert("a", game, true, store));
  assert.equal(store.getItem(SOURCE_ALERT_PREFIX + "a"), "broken");
});

test("checking reads each stale enabled catalog once for all watches and ignores disabled sources", async () => {
  const { watch: first } = watch(), second = { ...first, id: "two", game: { ...game, id: "steam:20", steamId: 20, name: "Another Game" } };
  let reads = 0, yields = 0; const found: string[] = [];
  const entries = [release, { ...release, id: "two", title: second.game.name }];
  const result = await checkSourceAlerts([first, second], [{ ...source, enabled: false }, source], feed({ catalog: async () => { reads++; return { ...source, entries }; }, yield: async () => { yields++; } }), abort().signal, async w => { found.push(w.id); }, new Map(), SOURCE_ALERT_INTERVAL + 1);
  assert.equal(reads, 1); assert.deepEqual(found, ["w", "two"]); assert.equal(yields, 1); assert.deepEqual(result, { pending: [], failed: false });
});

test("fresh saved catalogs avoid refetch, failed sources cannot invent availability, and another source still succeeds", async () => {
  const { watch: first } = watch(); let reads = 0, matches = 0;
  await checkSourceAlerts([first], [{ ...source, checkedAt: 10 }], feed({ catalog: async () => { reads++; throw Error(); } }), abort().signal, async () => { matches++; }, new Map(), 11);
  assert.equal(reads, 0); assert.equal(matches, 1);
  const result = await checkSourceAlerts([first], [source, { ...source, id: "good" }], feed({ catalog: async s => { if (s.id === "s") throw Error("offline"); return s; } }), abort().signal, async () => { matches++; }, new Map(), SOURCE_ALERT_INTERVAL + 1);
  assert.equal(matches, 2); assert.equal(result.failed, true);
});

test("aborting an in-flight source request prevents late delivery", async () => {
  const { watch: first } = watch(), controller = abort(); let matches = 0;
  await assert.rejects(checkSourceAlerts([first], [source], feed({ catalog: async s => { controller.abort(); return s; } }), controller.signal, async () => { matches++; }, new Map(), SOURCE_ALERT_INTERVAL + 1));
  assert.equal(matches, 0);
});

test("large website searches continue within bounded pages and recheck newest entries", async () => {
  const { watch: first } = watch(), website = { ...source, website: { kind: "wordpress" as const, site: "https://example.org", api: "https://example.org/wp-json" } };
  const pages: number[] = [], cursors = new Map<string, number>(); let matches = 0;
  const backend = feed({ website: async (_s, _q, page) => { pages.push(page); return { entries: page === 6 ? [release] : [], next: page + 1 }; } });
  await checkSourceAlerts([first], [website], backend, abort().signal, async () => { matches++; }, cursors);
  assert.deepEqual(pages, [1, 2, 3, 4]); assert.equal(matches, 0);
  await checkSourceAlerts([first], [website], backend, abort().signal, async () => { matches++; }, cursors);
  assert.deepEqual(pages, [1, 2, 3, 4, 1, 5, 6]); assert.equal(matches, 1); assert.equal(cursors.size, 0);
});

test("a disabled source cannot claim an alert and unsuccessful checks remain pending", () => {
  const { store } = watch();
  assert.equal(claimSourceAlert("a", "w", { ...source, enabled: false }, release, store), null);
  recordSourceAlertCheck("a", ["w"], true, store, 30);
  assert.deepEqual(readSourceAlerts("a", store).watches[0].failed, true);
  assert.equal(readSourceAlerts("a", store).notices.length, 0);
  assert.equal(readSourceAlerts("b", store).watches.length, 0);
});

test('fresh compact catalogs query stored records without refetch and keep failed watches pending', async () => {
  const { watch: first } = watch();
  const compact: GameSource = { ...source, checkedAt: 10, entries: [], catalog: { profile: 'a', version: '11111111-1111-4111-8111-111111111111', parts: 1, layout: { bytes: 100, ends: [1] }, storedEnds: [1], recent: [], recentAt: 10, recentUntil: Infinity } };
  let network = 0, disk = 0; const found: string[] = [];
  const backend = feed({ catalog: async () => { network++; return source; }, stored: async (_source, reference) => { disk++; assert.equal(reference.id, game.id); return [release]; } });
  assert.deepEqual(await checkSourceAlerts([first], [compact], backend, abort().signal, async watch => { found.push(watch.id); }, new Map(), 11), { pending: [], failed: false });
  assert.equal(network, 0); assert.equal(disk, 1); assert.deepEqual(found, ['w']);
  const failure = await checkSourceAlerts([first], [compact], feed({ stored: async () => { throw Error('source_storage'); } }), abort().signal, async () => { assert.fail('Failed cache cannot claim availability'); }, new Map(), 11);
  assert.deepEqual(failure, { pending: ['w'], failed: true });
  await checkSourceAlerts([first], [compact], backend, abort().signal, async () => {}, new Map(), SOURCE_ALERT_INTERVAL + 11);
  assert.equal(network, 1, 'Expired compact catalogs still check the actual upstream feed');
});

test('canceling an in-flight compact catalog lookup prevents alert delivery', async () => {
  const { watch: first } = watch(), request = abort();
  const compact: GameSource = { ...source, checkedAt: 10, entries: [], catalog: { profile: 'a', version: '11111111-1111-4111-8111-111111111111', parts: 0, layout: { bytes: 2, ends: [] }, storedEnds: [], recent: [], recentAt: 10, recentUntil: Infinity } };
  await assert.rejects(checkSourceAlerts([first], [compact], feed({ stored: async () => { request.abort(); return [release]; } }), request.signal, async () => { assert.fail('Late match delivered'); }, new Map(), 11), { name: 'AbortError' });
});
