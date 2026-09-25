// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const sync = readFileSync(new URL("../src/lib/anilist/sync.ts", import.meta.url), "utf8");

test("finished and rewatching titles sync as a rewatch instead of being skipped", () => {
  assert.doesNotMatch(
    sync,
    /if \(entryStatus === "COMPLETED" \|\| entryStatus === "REPEATING"\) return;/,
    "a finished entry must not bail out — that is what made rewatching impossible to record",
  );
  assert.match(sync, /if \(entryStatus === "COMPLETED" \|\| entryStatus === "REPEATING"\) \{/);
  assert.match(
    sync,
    /status: "REPEATING",/,
    "a rewatch must be pushed as REPEATING, never CURRENT (CURRENT resets the entry's progress)",
  );
});

test("a fresh rewatch ignores the completed progress, a live one is forward-only", () => {
  // Starting a rewatch on a Completed entry sends the watched episode even though
  // it is numerically lower than the completed total.
  assert.match(sync, /if \(entryStatus === "REPEATING" && target <= current\) return;/);
  // Continues the existing cour-corruption guard.
  assert.match(sync, /if \(target > total \+ 1\) return;/);
});

test("finished titles bypass the per-episode sent fast-path", () => {
  assert.match(
    sync,
    /if \(rewatch\[harborId\] !== true && \(sent\[sentKey\] \?\? 0\) >= \(abs \?\? ep\)\) return;/,
    "the sent map is keyed by episode, so it would swallow a second pass over pinned episodes",
  );
});

test("reaching the finale marks the title rewatch-eligible", () => {
  assert.match(sync, /if \(status === "COMPLETED"\) \{/);
});

test("finishing a rewatch completes the entry and bumps the repeat counter", () => {
  assert.match(sync, /SAVE_REWATCH_DONE_MUTATION/);
  assert.match(
    sync,
    /const repeat = \(media\.mediaListEntry\?\.repeat \?\? 0\) \+ 1/,
    "repeat is a plain input on SaveMediaListEntry — a bare status change does not bump it",
  );
  assert.match(sync, /if \(entryStatus === "REPEATING" && total > 0 && target >= total\) \{/);
  // The finale keeps emitting progress after we complete it; without the guard the
  // next tick would read COMPLETED and start the rewatch again.
  assert.match(sync, /if \(completedEp != null && entryStatus === "COMPLETED" && ep >= completedEp\) return;/);
});

test("rewatch syncs are flagged and the toast reads as a rewatch", () => {
  assert.match(sync, /rewatch: true/);
  const toast = readFileSync(
    new URL("../src/components/anilist/anilist-sync-toast.tsx", import.meta.url),
    "utf8",
  );
  assert.match(toast, /t\("Rewatching on AniList"\)/);
  assert.match(toast, /t\("Rewatched on AniList"\)/);
});

test("rewatch counting is gated by the Count rewatches setting", () => {
  assert.match(sync, /countRewatches = true,/);
  assert.match(sync, /if \(!countRewatches\) return;/);
  const defaults = readFileSync(new URL("../src/lib/settings/defaults.ts", import.meta.url), "utf8");
  assert.match(defaults, /anilistCountRewatches: true,/, "on by default");
  const panel = readFileSync(
    new URL("../src/views/settings/anilist-panel.tsx", import.meta.url),
    "utf8",
  );
  assert.match(panel, /settings\.anilistCountRewatches/);
  assert.match(panel, /newId="anilist:count-rewatches"/, "the new setting carries the NEW badge");
  assert.match(
    panel,
    /lockReason=\{\s*settings\.anilistAutoSync \? undefined : t\("Turn on Sync watch progress first\."\)/,
    "rewatch counting stays locked while watch-progress sync is off",
  );
  const newSettings = readFileSync(
    new URL("../src/views/settings/settings-new.ts", import.meta.url),
    "utf8",
  );
  assert.match(newSettings, /"anilist:count-rewatches"/);
});
