// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const sync = readFileSync(new URL("../src/lib/mal/sync.ts", import.meta.url), "utf8");

test("finished and rewatching titles sync as a rewatch instead of being skipped", () => {
  assert.doesNotMatch(
    sync,
    /if \(listStatus && \(listStatus\.status === "completed" \|\| listStatus\.is_rewatching\)\) return;/,
    "a finished entry must not bail out — that is what made rewatching impossible to record",
  );
  assert.match(sync, /if \(listStatus && \(listStatus\.status === "completed" \|\| listStatus\.is_rewatching\)\) \{/);
  assert.match(
    sync,
    /is_rewatching: "true",/,
    "a rewatch must keep the rewatch flag set, otherwise MAL treats it as a first watch",
  );
  assert.match(sync, /status: "watching",/);
});

test("a fresh rewatch ignores the completed progress, a live one is forward-only", () => {
  assert.match(sync, /if \(listStatus\.is_rewatching && target <= current\) return;/);
  assert.match(sync, /if \(target > total \+ 1\) return;/);
});

test("finished titles bypass the per-episode sent fast-path", () => {
  assert.match(
    sync,
    /if \(rewatch\[harborId\] !== true && \(sent\[sentKey\] \?\? 0\) >= \(abs \?\? ep\)\) return;/,
  );
});

test("finishing a rewatch completes the entry and bumps num_times_rewatched", () => {
  assert.match(sync, /if \(listStatus\.is_rewatching && total > 0 && target >= total\) \{/);
  assert.match(
    sync,
    /const timesRewatched = \(listStatus\.num_times_rewatched \?\? 0\) \+ 1/,
    "MAL keeps the rewatch count in its own field — completing alone does not bump it",
  );
  assert.match(sync, /num_times_rewatched: String\(timesRewatched\)/);
  assert.match(
    sync,
    /if \(completedEp != null && listStatus\.status === "completed" && ep >= completedEp\) return;/,
  );
});

test("the rewatch toast reads as a rewatch", () => {
  const toast = readFileSync(
    new URL("../src/components/mal/mal-sync-toast.tsx", import.meta.url),
    "utf8",
  );
  assert.match(toast, /t\("Rewatching on MyAnimeList"\)/);
  assert.match(toast, /t\("Rewatched on MyAnimeList"\)/);
});

test("rewatch counting is gated by the Count rewatches setting", () => {
  assert.match(sync, /countRewatches = true,/);
  assert.match(sync, /if \(!countRewatches\) return;/);
  const defaults = readFileSync(new URL("../src/lib/settings/defaults.ts", import.meta.url), "utf8");
  assert.match(defaults, /malCountRewatches: true,/, "on by default");
  const panel = readFileSync(new URL("../src/views/settings/mal-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /settings\.malCountRewatches/);
  assert.match(panel, /newId="mal:count-rewatches"/, "the new setting carries the NEW badge");
  assert.match(
    panel,
    /lockReason=\{settings\.malAutoSync \? undefined : t\("Turn on Sync watch progress first\."\)\}/,
    "rewatch counting stays locked while watch-progress sync is off",
  );
  const newSettings = readFileSync(
    new URL("../src/views/settings/settings-new.ts", import.meta.url),
    "utf8",
  );
  assert.match(newSettings, /"mal:count-rewatches"/);
});
