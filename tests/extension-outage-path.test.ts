// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const bridge = read("src/lib/streams/plugins/extension/bridge.ts");
const run = read("src/lib/streams/plugins/extension/run.ts");
const runtime = read("src/lib/streams/plugins/runtime.ts");
const ladder = read("src/views/play-picker/picker-empty-ladder.tsx");
const outages = read("src/views/play-picker/source-outages.tsx");

// A site that is down and a title with no sources both come back as an empty list, and the second
// is the user's problem while the first is the service's. Every link in the chain that carries the
// difference is asserted here, because losing any one of them puts the picker back to showing
// nothing and looking broken.

test("the bridge client reads the reason off every answer that can be empty", () => {
  assert.match(bridge, /\.note;/);
  for (const call of ["bridgeSearch", "bridgeLoad", "bridgeLoadLinks"]) {
    const start = bridge.indexOf(`export async function ${call}`);
    assert.ok(start > 0, `${call} is gone`);
    const body = bridge.slice(start, start + 600);
    assert.match(body, /note: note\(raw\)|note\(raw\)/, `${call} drops the note`);
  }
});

test("an empty search and a null load both report the reason instead of passing silently", () => {
  assert.match(run, /outage: \(text: string\) => void/);
  const searchEmpty = run.indexOf("if (!urls.length) {");
  assert.ok(searchEmpty > 0);
  assert.match(run.slice(searchEmpty, searchEmpty + 260), /found\.note.*outage\(provider, found\.note/s);
  const loadNull = run.indexOf("if (!media) {");
  assert.ok(loadNull > 0, "a null load is being dropped without a word again");
  assert.match(run.slice(loadNull, loadNull + 240), /loaded\.note.*outage\(provider, loaded\.note/s);
  assert.doesNotMatch(run, /if \(!media\) continue;/);
});

test("the runtime keeps the reason only for a run that produced nothing", () => {
  assert.match(runtime, /outage: \(text\) => \{/);
  assert.match(runtime, /h\.lastSkip = count === 0 \? outage : null;/);
});

test("the picker shows it above whichever empty state is on screen", () => {
  assert.match(ladder, /import \{ SourceOutages \}/);
  assert.match(ladder, /\{addonsSettled && allCount === 0 && <SourceOutages \/>\}/);
  const ladderBody = ladder.slice(ladder.indexOf("return ("));
  assert.ok(
    ladderBody.indexOf("<SourceOutages />") < ladderBody.indexOf("<EmptyState"),
    "the outage list has to come before the empty states, not after them",
  );
});

test("the picker reads published health and never claims a stale outage is happening now", () => {
  assert.match(outages, /pluginHealth|subscribeStreamPlugins/);
  assert.match(outages, /health\.lastAt == null/);
  assert.match(outages, /now - health\.lastAt > FRESH_MS/);
});
