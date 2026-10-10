import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { editAchievementDraft, MAX_ACHIEVEMENT_CHANGES, acceptAchievementNotice, hasAchievementNotice, achievementNoticeKey } from "../src/lib/games/achievement-editor.ts";
import { achievementReward, achievementRewards } from "../src/lib/games/achievement-rewards.ts";
import type { LocalAchievement } from "../src/lib/games/local-achievements.ts";

const item = (id: string, unlocked = false, editable = true): LocalAchievement => ({ id, name: id, description: "", icon: "", lockedIcon: "", hidden: false, unlocked, unlockedAt: 0, editable });
test("bulk editing includes offscreen achievements but never protected entries or unchanged values", () => {
  const items = Array.from({ length: 520 }, (_, index) => item(String(index), index % 2 === 0));
  items.push(item("protected", false, false));
  const unlocked = editAchievementDraft(items, {}, "unlock");
  assert.equal(Object.keys(unlocked).length, 260);
  assert.equal(Object.hasOwn(unlocked, "protected"), false);
  const inverted = editAchievementDraft(items, unlocked, "invert");
  assert.equal(Object.keys(inverted).length, 260);
  assert.equal(inverted["0"], false);
  assert.equal(Object.hasOwn(inverted, "1"), false);
  const subset = editAchievementDraft([items[0]], inverted, "invert");
  assert.equal(Object.hasOwn(subset, "0"), false);
  assert.equal(Object.keys(subset).length, 259);
  assert.equal(Object.keys(inverted).length, 260, "previous draft is immutable");
  assert.equal(Object.keys(editAchievementDraft(items, {}, "relock")).length, 260);
});
test("oversized changes fail atomically instead of silently truncating a bulk selection", () => {
  const rows = Array.from({ length: MAX_ACHIEVEMENT_CHANGES + 1 }, (_, index) => item(String(index)));
  const draft = { existing: true };
  assert.throws(() => editAchievementDraft(rows, draft, "unlock"), /achievement_invalid_changes/);
  assert.deepEqual(draft, { existing: true });
  assert.equal(Object.keys(editAchievementDraft(rows.slice(0, MAX_ACHIEVEMENT_CHANGES), {}, "unlock")).length, MAX_ACHIEVEMENT_CHANGES);
});
test("notice is profile scoped, persists, and survives unavailable storage for the session", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
  try {
    assert.equal(hasAchievementNotice("first"), false);
    acceptAchievementNotice("first");
    assert.equal(values.get(achievementNoticeKey("first")), "accepted");
    assert.equal(hasAchievementNotice("first"), true);
    assert.equal(hasAchievementNotice("other"), false);
    values.set(achievementNoticeKey("persisted"), "accepted");
    assert.equal(hasAchievementNotice("persisted"), true);
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw Error("unavailable"); } });
    acceptAchievementNotice("session");
    assert.equal(hasAchievementNotice("session"), true);
    assert.equal(hasAchievementNotice("another"), false);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
test("reward links match the exact game and achievement with locally available source artwork", () => {
  assert.equal(achievementRewards(440).length, 27);
  assert.equal(achievementReward(630, "ASW_PARA_HAT")?.receivingAppId, 440);
  assert.equal(achievementReward(99900, "REACHED_TERMINAL_1")?.name, "Spiral Sallet");
  assert.equal(achievementReward(440, "ASW_PARA_HAT"), undefined);
  assert.deepEqual(achievementRewards(1174180), []);
  for (const appId of [440, 630, 99900]) {
    const rewards = achievementRewards(appId);
    assert.equal(new Set(rewards.map(reward => reward.achievementId)).size, rewards.length);
    for (const reward of rewards) {
      assert.ok(existsSync(new URL("../public" + reward.image, import.meta.url)));
      assert.equal(new URL(reward.source).hostname, "wiki.teamfortress.com");
    }
  }
});
test("every achievement editor locale has the English keys and matching placeholders", () => {
  const catalog = (language: string) => Object.fromEntries([...readFileSync(new URL(`../src/lib/i18n/locales/${language}/game-achievements.ts`, import.meta.url), "utf8").matchAll(/"(games\.achievementManager\.[^"]+)":\s*("(?:[^"\\]|\\.)*")/g)].map(match => [match[1], JSON.parse(match[2]) as string]));
  const english = catalog("en");
  for (const language of ["ar", "de", "es", "fr", "hi", "id", "it", "ja", "ko", "pl", "pt", "ru", "tr", "vi", "zh"]) {
    const local = catalog(language);
    for (const [key, value] of Object.entries(english)) {
      assert.equal(typeof local[key], "string", `${language}: ${key}`);
      assert.deepEqual(local[key].match(/\{[^}]+\}/g)?.sort() ?? [], value.match(/\{[^}]+\}/g)?.sort() ?? [], `${language}: ${key}`);
    }
  }
});
