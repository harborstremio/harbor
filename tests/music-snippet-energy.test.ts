import test from "node:test";
import assert from "node:assert/strict";
import { measureSnippetEnergy } from "../src/lib/music/snippet-energy.ts";

test("preview energy follows actual quiet, loud and silent samples", () => {
  const rate = 22050;
  const samples = Float32Array.from({ length: rate * 3 }, (_, i) => Math.sin(i / rate * 2 * Math.PI * 80) * (i < rate ? .05 : i < rate * 2 ? .6 : 0));
  const measured = measureSnippetEnergy([samples], rate);
  assert.equal(measured.rate, 30);
  assert.ok(measured.level[45] > measured.level[15] * 5);
  assert.ok(measured.bass[45] > measured.bass[15] * 5);
  assert.equal(measured.level[75], 0);
  assert.equal(measured.bass[75], 0);
});

test("bass energy distinguishes a low beat from high-frequency audio", () => {
  const rate = 22050;
  const tone = (frequency: number) => Float32Array.from({ length: rate }, (_, i) => .5 * Math.sin(i / rate * 2 * Math.PI * frequency));
  const lows = measureSnippetEnergy([tone(80)], rate), highs = measureSnippetEnergy([tone(7000)], rate);
  assert.ok(lows.bass[15] > highs.bass[15] * 3);
  assert.ok(highs.level[15] > .8);
});
