// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";

const pipeline = readFileSync(
  new URL("../src/lib/streams/pipeline.ts", import.meta.url),
  "utf8",
);
const library = readFileSync(new URL("../src/lib/streams/library.ts", import.meta.url), "utf8");

test("debrid library listings start with the addons instead of after them", () => {
  assert.match(pipeline, /const libraryListsPromise: LibraryListings =/);
  assert.match(
    pipeline,
    /fetchLibraryStreams\(input\.debrids, input\.query, signal, libraryListsPromise\)/,
    "the same listing sweep must feed both the matcher and the cache cross-check",
  );
  // The provider is only asked once; fetchLibraryStreams reuses the shared promise.
  assert.match(library, /sharedListings\?: LibraryListings/);
  assert.match(library, /const settled = sharedListings/);
});

test("debrid cache verification is incremental and feeds the partials", () => {
  assert.match(pipeline, /const applyDebridFlags = \(parsed: ParsedStream\[\]\): void => \{/);
  assert.match(pipeline, /applyDebridFlags\(parsed\);/);
  assert.match(
    pipeline,
    /const fresh = hashes\.filter\(\(h\) => !checked\.has\(h\)\);/,
    "a cache check must only carry hashes that were not verified yet",
  );
  assert.match(pipeline, /const DEBRID_CHECK_MIN_INTERVAL_MS = \d+;/);
  assert.match(
    pipeline,
    /if \(cacheCheckTimer != null\) \{\s*window\.clearTimeout\(cacheCheckTimer\);/,
    "the tail of hashes must still be flushed before the final ranking",
  );
  assert.match(
    pipeline,
    /if \(!signal\.aborted\) emitPartialNow\(\);/,
    "newly verified streams must refresh the visible partial",
  );
});

test("self-hosted addons on loopback opt into local networking", () => {
  const addons = readFileSync(new URL("../src/lib/streams/addons.ts", import.meta.url), "utf8");
  assert.match(
    addons,
    /const doFetch = isLocalNetworkUrl\(base\) \? safeFetchLocal : fetch;/,
    "only a local addon URL may skip the SSRF guard; public ones keep it",
  );
  const store = readFileSync(new URL("../src/lib/addon-store.ts", import.meta.url), "utf8");
  assert.match(
    store,
    /const doFetch = isLocalNetworkUrl\(transportUrl\) \? safeFetchLocal : fetch;/,
    "installing/refreshing a self-hosted manifest must reach loopback too",
  );
});

test("a failed addon reports why instead of silently returning 0 streams", () => {
  const addons = readFileSync(new URL("../src/lib/streams/addons.ts", import.meta.url), "utf8");
  assert.match(addons, /export type AddonFailureCode = "blocked" \| "timeout" \| "http" \| "unreachable";/);
  assert.match(addons, /failures\?: AddonFailure\[\];/);
  assert.match(addons, /noteFailure\(addon\.manifest\.id, name, r\.failure\);/);
  assert.match(addons, /failures: failures\.length > 0 \? \[\.\.\.failures\] : undefined,/);
  assert.match(addons, /function failureCodeFor\(e: unknown\): AddonFailureCode \{/);
  assert.match(addons, /if \(\/blocked internal target\/i\.test\(message\)\) return "blocked";/);

  assert.match(pipeline, /addonErrors\?: AddonFailure\[\];/);
  assert.match(pipeline, /addonErrors = progress\.failures \?\? \[\];/);
  assert.match(pipeline, /addonErrors: addonErrors\.length > 0 \? addonErrors : undefined,/);
  assert.match(
    pipeline,
    /onAddonBatch,\s+handleAddonProgress,/,
    "failures ride along on the progress callback",
  );

  const picker = readFileSync(new URL("../src/views/play-picker.tsx", import.meta.url), "utf8");
  assert.match(picker, /result\?\.addonErrors && result\.addonErrors\.length > 0 && \(/);
  assert.match(picker, /addonFailureLabel\(t, e\.code\)/);
});
