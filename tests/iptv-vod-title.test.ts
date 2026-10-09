// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { cleanTitle, showTitleFromEpisode } from "../src/lib/iptv/vod-title.ts";

const resolve = (raw: string) => showTitleFromEpisode(raw) || cleanTitle(raw);

test("a provider region tag never becomes the series title", () => {
  // Regression: "AR-MA - <arabic>" resolved to "MA" and threw the title away, so
  // 84% of one provider's 46k series were named "AR"/"MA"/"CH" and unsearchable.
  assert.equal(resolve("AR-MA - الدم المشروك"), "الدم المشروك");
  assert.equal(resolve("AR - خلي الدماغ صاحي"), "خلي الدماغ صاحي");
  assert.equal(resolve("AR-CH - جبل الدم الأم دولاجي وأولادها"), "جبل الدم الأم دولاجي وأولادها");
});

test("tags carrying digits or symbols are stripped too", () => {
  assert.equal(resolve("4K-OSN+ - Game of Thrones (2011) (US)"), "Game of Thrones");
  assert.equal(resolve("NF - Lupin (2021) (FR)"), "Lupin");
});

test("a real all-caps title is kept, not mistaken for a tag", () => {
  assert.equal(resolve("NF - BLUE LOCK (2022) (JP)"), "BLUE LOCK");
  assert.equal(resolve("NF - ER (1994) (US)"), "ER");
});

test("the show/episode split still keeps the show name", () => {
  assert.equal(resolve("Breaking Bad - Pilot"), "Breaking Bad");
  assert.equal(resolve("The Office - Episode 3"), "The Office");
  assert.equal(resolve("EN - Breaking Bad S01 E01"), "Breaking Bad");
  assert.equal(resolve("US | Severance S02 E05"), "Severance");
});

test("a non-Latin title on the left of a delimiter is never treated as a tag", () => {
  assert.equal(resolve("الدم المشروك - الحلقة 1"), "الدم المشروك");
});

test("titles never come back empty or starting with a delimiter", () => {
  for (const raw of [
    "AR-MA - الدم المشروك",
    "IN -- Crushed (2022) (IN)",
    "TR-4K- Kara (2023) (TR)",
    "4K-OSN+ - Game of Thrones (2011) (US)",
  ]) {
    const got = resolve(raw);
    assert.ok(got.trim().length > 0, `${raw} produced an empty title`);
    assert.doesNotMatch(got, /^[-|:]/, `${raw} produced "${got}"`);
  }
});
