// @ts-expect-error Node test types are outside browser config.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside browser config.
import test from "node:test";
import { pickerExitStack, samePickerRequest } from "../src/lib/picker-return.ts";
import type { Frame } from "../src/lib/view.tsx";

const meta = { id: "tt-controlled", type: "series" as const, name: "Controlled series" };
const ep = { season: 2, episode: 3, videoId: "controlled:2:3" };
const home: Frame = { kind: "home" };
const detail: Frame = { kind: "meta", meta };

test("ordinary picker cancellation retains the existing Details destination", () => {
  const picker: Frame = { kind: "picker", meta, episode: ep, intent: "download" };
  assert.deepEqual(pickerExitStack([home, picker], meta), [home, detail]);
  assert.deepEqual(pickerExitStack([home, detail, picker], meta), [home, detail]);
});

test("only a matching contextual download request returns to its original page", () => {
  const picker: Frame = {
    kind: "picker",
    meta,
    episode: ep,
    intent: "download",
    returnTo: "previous",
    contextRequestId: "panel-1",
  };
  assert.deepEqual(pickerExitStack([home, picker], meta), [home]);
  assert.deepEqual(pickerExitStack([home, detail, picker], meta), [home, detail]);
  assert.deepEqual(pickerExitStack([home, { ...picker, contextRequestId: undefined }], meta), [
    home,
    detail,
  ]);
  assert.deepEqual(pickerExitStack([home, { ...picker, intent: "play" }], meta), [home, detail]);
  const other = { ...meta, id: "other-series" };
  assert.deepEqual(pickerExitStack([home, picker], other), [home, { kind: "meta", meta: other }]);
});

test("picker identity distinguishes episodes, physical video IDs and contextual requests", () => {
  const picker: Frame = {
    kind: "picker",
    meta,
    episode: ep,
    intent: "download",
    contextRequestId: "panel-1",
  };
  const options = { intent: "download" as const, contextRequestId: "panel-1" };
  assert.equal(samePickerRequest(picker, meta, ep, options), true);
  assert.equal(samePickerRequest(picker, meta, { ...ep, episode: 4 }, options), false);
  assert.equal(samePickerRequest(picker, meta, { ...ep, videoId: "other-file" }, options), false);
  assert.equal(
    samePickerRequest(picker, meta, ep, { ...options, contextRequestId: "panel-2" }),
    false,
  );
  assert.equal(samePickerRequest(picker, { ...meta, type: "movie" }, undefined, options), false);
});
