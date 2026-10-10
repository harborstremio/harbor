import test from "node:test";
import assert from "node:assert/strict";
import { musicVideoIdentity } from "../src/lib/music/video-discovery";

const same = (a: [string, string], b: [string, string]) =>
  musicVideoIdentity(a[0], a[1]) === musicVideoIdentity(b[0], b[1]);

test("re-uploads of one song collapse to a single entry", () => {
  const base: [string, string] = ["F**kin' Problems (feat. Drake, 2 Chainz & Kendrick Lamar)", "A$AP Rocky"];
  assert.ok(same(base, ["F**kin' Problems (feat. Kendrick Lamar, Drake & 2 Chainz)", "A$AP Rocky"]));
  assert.ok(same(base, ["F**kin' Problems", "A$AP Rocky"]));
  assert.ok(same(base, ["F**kin' Problems (Clean - Official Video) (feat. Drake, 2 Chainz & Kendrick Lamar)", "A$AP Rocky"]));
});

test("different songs by the same artist stay distinct", () => {
  assert.ok(!same(["Wild for the Night", "A$AP Rocky"], ["F**kin' Problems", "A$AP Rocky"]));
  assert.ok(!same(["Praise the Lord", "A$AP Rocky"], ["Everyday", "A$AP Rocky"]));
});

test("the same title by different artists stays distinct", () => {
  assert.ok(!same(["Antarctica", "$uicideboy$"], ["Antarctica", "Pouya"]));
});

test("marketing words alone never merge unrelated songs", () => {
  assert.ok(!same(["Official Secrets", "Artist"], ["Video Games", "Artist"]));
});
