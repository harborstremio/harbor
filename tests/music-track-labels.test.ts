import assert from "node:assert/strict";
import test from "node:test";
import { musicTrackLabels } from "../src/lib/music/track-labels.ts";

test("unknown or non-explicit metadata does not imply a clean edit", () => {
  assert.deepEqual(musicTrackLabels({ title: "Live Forever" }), []);
  assert.deepEqual(musicTrackLabels({ title: "Clean", explicit: false }), []);
  assert.deepEqual(musicTrackLabels({ title: "Song", explicit: true }), ["explicit"]);
});
test("version badges use annotated or provider-supplied versions", () => {
  assert.deepEqual(musicTrackLabels({ title: "Song (Radio Edit)" }), ["radioEdit"]);
  assert.deepEqual(musicTrackLabels({ title: "Song", version: "Live at Wembley" }), ["live"]);
  assert.deepEqual(musicTrackLabels({ title: "Song - Artist Remix" }), ["remix"]);
  assert.deepEqual(musicTrackLabels({ title: "Song [Clean]", explicit: true }), ["explicit"]);
});
