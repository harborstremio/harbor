import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createShortcutActivity, shortcutActivityKey, SHORTCUT_ACTIVITY_LIMIT, type ShortcutActivityEvent } from "../src/lib/games/steam-shortcut-activity.ts";

function storage() {
  const values = new Map<string, string>();
  let denied = false;
  return { values, block: (value: boolean) => { denied = value; },
    getItem: (key: string) => { if (denied) throw Error("denied"); return values.get(key) ?? null; },
    setItem: (key: string, value: string) => { if (denied) throw Error("quota"); values.set(key, value); },
  };
}
const scan: ShortcutActivityEvent = { kind: "scan", count: 4, accounts: 2, elapsed: 32, root: "W:/Steam", warnings: ["shortcut_entries"] };

test("activity is session-only until opted in; disable retention removes saved entries without hiding this session", () => {
  const disk = storage(), activity = createShortcutActivity("a", () => disk);
  activity.record(scan);
  assert.equal(disk.values.size, 0);
  assert.equal(createShortcutActivity("a", () => disk).getSnapshot().entries.length, 0);
  assert.equal(activity.configure({ remember: true }), true);
  assert.equal(createShortcutActivity("a", () => disk).getSnapshot().entries.length, 1);
  assert.equal(createShortcutActivity("b", () => disk).getSnapshot().entries.length, 0);
  activity.configure({ remember: false });
  assert.equal(activity.getSnapshot().entries.length, 1);
  assert.deepEqual(JSON.parse(disk.values.get(shortcutActivityKey("a"))!).entries, []);
  assert.equal(createShortcutActivity("a", () => disk).getSnapshot().entries.length, 0);
});

test("only 300 newest records remain; saved history reloads in the same order and clearing is profile-specific", () => {
  const disk = storage(), a = createShortcutActivity("a", () => disk), b = createShortcutActivity("b", () => disk);
  a.configure({ remember: true }); b.configure({ remember: true }); b.record(scan);
  for (let count = 0; count < 320; count++) a.record({ ...scan, count });
  const entries = a.getSnapshot().entries;
  assert.equal(entries.length, SHORTCUT_ACTIVITY_LIMIT); assert.equal(entries[0].count, 319); assert.equal(entries.at(-1)?.count, 20);
  assert.deepEqual(createShortcutActivity("a", () => disk).getSnapshot().entries, entries);
  assert.equal(a.clear(), true); assert.equal(a.getSnapshot().entries.length, 0);
  assert.equal(createShortcutActivity("a", () => disk).getSnapshot().entries.length, 0);
  assert.equal(createShortcutActivity("b", () => disk).getSnapshot().entries.length, 1);
});

test("storage failure never pretends preferences or clear succeeded; current activity survives and persistence can recover", () => {
  const disk = storage(), activity = createShortcutActivity("a", () => disk);
  activity.record(scan); activity.configure({ remember: true }); const saved = disk.values.get(shortcutActivityKey("a"));
  disk.block(true);
  assert.equal(activity.configure({ remember: false }), false);
  assert.equal(activity.getSnapshot().remember, true); assert.equal(activity.getSnapshot().storageError, true);
  assert.equal(activity.clear(), false); assert.equal(activity.getSnapshot().entries.length, 1);
  activity.record({ kind: "settings" }); assert.equal(activity.getSnapshot().entries.length, 2);
  assert.equal(disk.values.get(shortcutActivityKey("a")), saved);
  disk.block(false); activity.record(scan);
  assert.equal(activity.getSnapshot().storageError, false);
  assert.equal(createShortcutActivity("a", () => disk).getSnapshot().entries.length, 3);
});

test("details are opt-in and raw executable/arguments/error payloads are never retained", () => {
  const disk = storage(), activity = createShortcutActivity("a", () => disk);
  activity.record(scan); activity.record({ kind: "account", accountId: 1, count: 4 });
  assert.equal(activity.getSnapshot().entries.length, 1); assert.equal(activity.getSnapshot().entries[0].root, undefined);
  activity.configure({ remember: true, detailed: true });
  activity.record({ kind: "account", accountId: 1, count: 4, root: "W:/Steam\nfolder" });
  activity.record({ ...scan, executable: "secret.exe", launchOptions: "--token secret", rawError: "private payload", warnings: ["shortcut_entries", "shortcut_entries", "private payload"] } as ShortcutActivityEvent);
  assert.equal(activity.getSnapshot().entries[1].root, "W:/Steam folder");
  assert.deepEqual(activity.getSnapshot().entries[0].warnings, ["shortcut_entries"]);
  const saved = disk.values.get(shortcutActivityKey("a"))!;
  assert.doesNotMatch(saved, /secret|private payload|launchOptions|executable/);
  activity.configure({ detailed: false }); const size = activity.getSnapshot().entries.length;
  activity.record({ kind: "account", accountId: 2, count: 1 }); assert.equal(activity.getSnapshot().entries.length, size);
});

test("corrupt or oversized stored history stays untouched until an explicit repair and malformed records cannot invent outcomes", () => {
  const disk = storage(), key = shortcutActivityKey("a");
  for (const raw of ["broken", "x".repeat(2 * 1024 * 1024 + 1), JSON.stringify({ remember: "yes", detailed: false, entries: [] })]) {
    disk.values.set(key, raw); const activity = createShortcutActivity("a", () => disk);
    assert.equal(activity.getSnapshot().storageError, true); activity.record(scan);
    assert.equal(disk.values.get(key), raw); assert.equal(activity.clear(), true);
    assert.equal(activity.getSnapshot().storageError, false);
  }
  const valid = { ...scan, id: "one", at: Date.now() };
  disk.values.set(key, JSON.stringify({ remember: true, detailed: false, entries: [valid, valid, { kind: "scan", id: "missing-count", at: 1 }, { ...valid, id: "bad-time", at: 1e30 }, { ...valid, id: "unknown", kind: "unknown" }] }));
  assert.deepEqual(createShortcutActivity("a", () => disk).getSnapshot().entries.map(entry => entry.id), ["one"]);
});

test("worst-case bounded diagnostic strings remain reloadable and subscriptions receive only their own journal changes", () => {
  const disk = storage(), activity = createShortcutActivity("a", () => disk), other = createShortcutActivity("b", () => disk);
  let changes = 0; const stop = activity.subscribe(() => changes++);
  assert.equal(activity.observed, true); other.record(scan); assert.equal(changes, 0);
  activity.configure({ remember: true, detailed: true });
  for (let i = 0; i < 300; i++) activity.record({ ...scan, root: '"'.repeat(3000), name: '"'.repeat(800), warnings: Array.from({ length: 24 }, (_, n) => "shortcut_" + "a".repeat(n + 1)) });
  const saved = createShortcutActivity("a", () => disk).getSnapshot();
  assert.equal(saved.storageError, false); assert.equal(saved.entries.length, 300);
  assert.equal(saved.entries[0].root?.length, 1024); assert.equal(saved.entries[0].name?.length, 256);
  stop(); assert.equal(activity.observed, false); const count = changes; activity.record(scan); assert.equal(changes, count);
});

test("all activity labels and interpolation values exist once in each of the16locales", () => {
  const folder = new URL("../src/lib/i18n/locales/", import.meta.url);
  const keys = new Map<string, string[]>();
  const read = (locale: string) => [...fs.readFileSync(new URL(`${locale}/game-steam-shortcuts.ts`, folder), "utf8").matchAll(/"(games\.shortcuts\.activity\.[^"]+)":\s*"((?:\\.|[^"\\])*)"/g)];
  for (const row of read("en")) keys.set(row[1], (row[2].match(/\{\w+\}/g) ?? []).sort());
  assert.equal(keys.size, 19);
  for (const locale of ["ar", "de", "en", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"]) {
    const rows = read(locale); assert.equal(rows.length, keys.size, locale); assert.equal(new Set(rows.map(row => row[1])).size, keys.size, locale);
    for (const row of rows) assert.deepEqual((row[2].match(/\{\w+\}/g) ?? []).sort(), keys.get(row[1]), `${locale} ${row[1]}`);
  }
});

test("one large account scan publishes and persists once, with its completion summary above the detailed records", () => {
  const disk = storage(); let writes = 0, changes = 0;
  const activity = createShortcutActivity("a", () => ({ ...disk, setItem: (key, value) => { writes++; disk.setItem(key, value); } }));
  activity.configure({ remember: true, detailed: true }); writes = 0;
  activity.subscribe(() => changes++);
  activity.recordMany([
    ...Array.from({ length: 128 }, (_, index): ShortcutActivityEvent => ({ kind: "account", accountId: index + 1, count: 2 })),
    { kind: "scan", count: 256, accounts: 128 },
  ]);
  assert.equal(writes, 1); assert.equal(changes, 1); assert.equal(activity.getSnapshot().entries.length, 129);
  assert.equal(activity.getSnapshot().entries[0].kind, "scan");
});
