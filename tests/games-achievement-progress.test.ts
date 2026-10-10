import assert from "node:assert/strict";
import test from "node:test";
import { achievementPreviewRows, achievementProgressRows } from "../src/lib/games/achievement-progress.ts";
import type { SteamAchievement, SteamAchievements } from "../src/lib/games/steam-account.ts";
const icon = (id: string) => `https://cdn.steamstatic.com/steamcommunity/public/images/apps/440/${id}.jpg`;
const achievement = (id: string, unlocked: boolean): SteamAchievement => ({ id, name: id, description: "", icon: icon(id), lockedIcon: icon(id + "-locked"), hidden: false, unlocked, unlockedAt: unlocked ? 123 : 0 });
const data = (items: SteamAchievement[]): SteamAchievements => ({ appId: 440, steamId: "account", updatedAt: 1, items });
test("detail previews distinguish unavailable progress from confirmed locked and earned achievements", () => {
  const highlights = ["A", "B", "C", "D", "E"].map(name => ({ name, icon: icon(name) }));
  const unknown = achievementPreviewRows(highlights, null);
  assert.equal(unknown.length, 4);
  assert.ok(unknown.every(item => item.unlocked === undefined));
  assert.ok(achievementPreviewRows(highlights, null, true).every(item => item.unlocked === false));
  const personal = achievementPreviewRows(highlights, data([achievement("A", true), achievement("B", false), { ...achievement("C", false), hidden: true }]), true);
  assert.equal(personal[0].unlocked, true);
  assert.equal(personal[0].icon, icon("A"));
  assert.equal(personal[1].unlocked, false);
  assert.equal(personal[1].icon, icon("B-locked"));
  assert.equal(personal[2].hidden, true);
  assert.deepEqual(achievementPreviewRows(highlights, data([])), [], "a real empty personal schema must not fabricate progress from store highlights");
});
test("public data never invents personal progress from rarity or an absent account", () => {
  const rows = achievementProgressRows([{ name: "Common", description: "", icon: icon("same"), percent: 100 }, { name: "Rare", description: "", icon: icon("rare"), percent: 0 }], null);
  assert.equal(rows.length, 2);
  assert.ok(rows.every(row => row.unlocked === undefined));
});
test("Steam schema owns earned/locked state, unlock dates, identity and locked artwork", () => {
  const rows = achievementProgressRows([{ name: "Renamed global label", description: "", icon: icon("A"), percent: 15 }], data([achievement("A", true), achievement("B", false)]));
  assert.equal(rows[0].key, "A"); assert.equal(rows[0].name, "A"); assert.equal(rows[0].percent, 15); assert.equal(rows[0].unlocked, true); assert.equal(rows[0].unlockedAt, 123);
  assert.equal(rows[1].unlocked, false); assert.equal(rows[1].icon, icon("B-locked")); assert.equal(rows[1].percent, undefined);
  assert.equal(achievementProgressRows([], data([achievement("A", true)])).length, 1, "public provider failure cannot hide known progress");
});
test("global rarity is omitted for ambiguous artwork rather than matched by translated names", () => {
  const publicRows = [{ name: "Same name", description: "", icon: icon("A"), percent: 99 }, { name: "Other", description: "", icon: icon("A"), percent: 12 }];
  assert.equal(achievementProgressRows(publicRows, data([achievement("A", false)]))[0].percent, undefined);
  const shared = [achievement("A", false), { ...achievement("B", true), icon: icon("A") }];
  assert.ok(achievementProgressRows(publicRows.slice(0, 1), data(shared)).every(row => row.percent === undefined));
  assert.equal(achievementProgressRows([{ name: "A", description: "", icon: icon("different"), percent: 99 }], data([achievement("A", false)]))[0].percent, undefined);
});
