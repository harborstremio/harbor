import assert from "node:assert/strict";
import test from "node:test";

import { narrationWordCount } from "../src/lib/ebook/narration.ts";

test("narration word counting keeps vocalized Arabic words intact", () => {
  assert.equal(narrationWordCount("قَدْ يَبْدُو الأَمْرُ مُضْحِكًا", "ar-SA"), 4);
});

test("narration word counting handles Arabic without diacritics", () => {
  assert.equal(narrationWordCount("قبل أن يبرد الخليط", "ar-SA"), 4);
});

test("narration word counting keeps English contractions intact", () => {
  assert.equal(narrationWordCount("It doesn't break Harbor's tracker.", "en-US"), 5);
});
