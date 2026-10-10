import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const RUNTIME = readFileSync("src/lib/streams/plugins/runtime.ts", "utf8");
const COPY = readFileSync("src/views/settings/plugins-panel/copy.ts", "utf8");
const ROW = readFileSync("src/views/settings/plugins-panel/plugin-row.tsx", "utf8");

test("a plugin that answers again is not left stood down", () => {
  // Clearing only the count left the pause behind, and a paused plugin is never asked again, so
  // the state outlived the failure that set it and nothing could get out of it.
  assert.match(
    RUNTIME,
    /async function recordSuccess[\s\S]*?saveStreamPlugin\(\{ \.\.\.fresh, failures: 0, autoPaused: false \}\)/,
    "an answer has to lift the pause as well as clear the count",
  );
});

test("the pause follows the failures rather than latching", () => {
  assert.ok(
    !/\|\| fresh\.autoPaused/.test(RUNTIME),
    "a latch outlives the failure that set it, and nothing asks a paused plugin",
  );
  assert.match(RUNTIME, /autoPaused: autoPausedAt\(failures\)/);
  assert.match(
    RUNTIME,
    /function autoPausedAt\(failures: number\): boolean \{\r?\n  return failures >= AUTO_PAUSE_FAILURES;/,
  );
});

test("the message says what happened and the row carries the way back", () => {
  const found = /case "auto-paused":[\s\S]{0,400}?warn: t\("([^"]+)"/.exec(COPY);
  const warn = found?.[1] ?? "";
  assert.match(warn, /Stopped after \{n\} failures\./, "the message names the failure");
  assert.ok(
    !/Turn it back on/.test(warn),
    "the plugin is still switched on, so pointing at the switch is a dead end",
  );
});

test("the retry is offered on the row, and only while it is stood down", () => {
  assert.match(
    ROW,
    /const retryable = plugin\.state === "auto-paused" && !masterOff;/,
    "a retry is pointless with every plugin paused, and wrong for a state Harbor did not set",
  );
  assert.match(
    ROW,
    /retryable && adapter\.check && \([\s\S]{0,500}?t\("Try again"\)/,
    "the button sits with the row's other actions, beside the message",
  );
  const runners = ROW.match(/run\("check", checkNow\)/g) ?? [];
  assert.equal(
    runners.length,
    2,
    "the retry and the expanded check have to be one runner, or they drift apart",
  );
});

test("a retry that ran shows its outcome in place of the message", () => {
  assert.match(
    ROW,
    /const note = error \?\? \(retryable && check \? checkText : copy\.warn\);/,
    "a failed retry would otherwise look exactly like one that never ran",
  );
});

test("one refresh runs everything the panel stood down", () => {
  const tab = readFileSync("src/views/settings/plugins-panel/installed-tab.tsx", "utf8");
  assert.match(
    tab,
    /p\.state === "auto-paused"/,
    "the bulk run is the stood-down set and nothing that is already working",
  );
  assert.match(
    tab,
    /stoodDown\.length > 0 && settings\.pluginsEnabled/,
    "offered only while there is something to try and the plugins are not all paused",
  );
  assert.match(
    tab,
    /stoodDown\.map\(\(\{ plugin, adapter \}\) => adapter\.check\?\.\(plugin\.id, waitMs\)\)/,
    "the bulk run is the same check a row's Try again makes",
  );
});
