// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { textSyncHarness } from "./helpers/text-sync-harness.ts";
import { deferred, flushBridge } from "./helpers/mpv-bridge-harness.ts";

test("cancel after a drift preview restores the original Arabic track and offset", async () => {
  const h = textSyncHarness();
  await h.render().enter("fixture.mkv");
  h.render();
  h.at(12);
  h.render().syncFromHere(0);
  h.render();
  h.at(116);
  h.render().syncFromHere(1);
  h.render();
  h.timers();
  await flushBridge();
  assert.notEqual(h.selected(), "original");
  assert.equal(h.adds[0].lang, "ar");
  h.render().discard();
  h.render();
  assert.equal(h.selected(), "original");
  assert.equal(h.delay(), 2);
});

test("reset after a drift preview restores the source instead of double-applying corrections", async () => {
  const h = textSyncHarness();
  await h.render().enter("fixture.mkv");
  h.render();
  h.at(12);
  h.render().syncFromHere(0);
  h.render();
  h.at(116);
  h.render().syncFromHere(1);
  h.render();
  h.timers();
  await flushBridge();
  h.render().reset();
  h.render();
  assert.equal(h.selected(), "original");
  assert.equal(h.delay(), 0);
});

test("closing while subtitle extraction is pending cannot reopen Live Sync", async () => {
  const h = textSyncHarness();
  const extraction = deferred<{
    ok: true;
    source: { format: "srt"; cues: Array<{ start: number; end: number; text: string }> };
  }>();
  h.readWith(() => extraction.promise);
  const enter = h.render().enter("fixture.mkv");
  h.render();
  h.render().discard();
  h.render();
  extraction.resolve({
    ok: true,
    source: { format: "srt", cues: [{ start: 10, end: 12, text: "line" }] },
  });
  await enter;
  assert.equal(h.render().syncMode, "idle");
  assert.equal(h.delay(), 2);
});

test("saved constant correction is baked once and remains unchanged across two minutes", async () => {
  const h = textSyncHarness();
  await h.render().enter("fixture.mkv");
  h.render();
  h.at(13);
  h.render().syncFromHere(0);
  h.render();
  assert.deepEqual(await h.render().save(), { ok: true });
  h.render();
  const selected = h.selected();
  for (let second = 0; second <= 120; second++) {
    h.at(second);
    h.render();
  }
  assert.equal(h.selected(), selected);
  assert.equal(h.delay(), 0);
  assert.match(h.files.get(selected)!, /00:00:13,000 --> 00:00:15,000/);
});
