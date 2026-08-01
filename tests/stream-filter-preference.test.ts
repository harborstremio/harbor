// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
const filterPreference = (await import("../src/lib/streams/filter-preference.ts").catch(
  () => ({}),
)) as Record<string, unknown>;

const filters = [
  {
    id: "4k",
    name: "4K only",
    resolution: ["4K"],
  },
  {
    id: "empty",
    name: "Anything",
  },
] as const;

const streams = [
  { id: "1080", resolution: "1080p" },
  { id: "4k", resolution: "4K" },
] as const;

test("active filter resolution rejects missing and empty saved filters", () => {
  const resolve = filterPreference.resolveActiveStreamFilter;
  assert.equal(typeof resolve, "function");
  const resolveActive = resolve as (saved: unknown[], id: string | null) => { id: string } | null;

  assert.equal(resolveActive(filters as unknown as unknown[], null), null);
  assert.equal(resolveActive(filters as unknown as unknown[], "missing"), null);
  assert.equal(resolveActive(filters as unknown as unknown[], "empty"), null);
  assert.equal(resolveActive(filters as unknown as unknown[], "4k")?.id, "4k");
});

test("active preference narrows matching candidates while retaining allRaw", () => {
  const apply = filterPreference.applyActiveStreamFilterPreference;
  assert.equal(typeof apply, "function");
  const applyPreference = apply as (
    streams: unknown[],
    filter: unknown,
    bypass?: boolean,
  ) => { all: Array<{ id: string }>; allRaw: Array<{ id: string }>; fellBack: boolean };

  const result = applyPreference(streams as unknown as unknown[], filters[0]);
  assert.deepEqual(
    result.all.map((stream) => stream.id),
    ["4k"],
  );
  assert.deepEqual(
    result.allRaw.map((stream) => stream.id),
    ["1080", "4k"],
  );
  assert.equal(result.fellBack, false);
});

test("active preference falls back without a dead end and host matching bypasses it", () => {
  const apply = filterPreference.applyActiveStreamFilterPreference;
  assert.equal(typeof apply, "function");
  const applyPreference = apply as (
    streams: unknown[],
    filter: unknown,
    bypass?: boolean,
  ) => { all: Array<{ id: string }>; allRaw: Array<{ id: string }>; fellBack: boolean };
  const noMatch = { id: "720", name: "720p only", resolution: ["720p"] };

  const fallback = applyPreference(streams as unknown as unknown[], noMatch);
  assert.deepEqual(
    fallback.all.map((stream) => stream.id),
    ["1080", "4k"],
  );
  assert.equal(fallback.fellBack, true);

  const hostOverride = applyPreference(streams as unknown as unknown[], filters[0], true);
  assert.deepEqual(
    hostOverride.all.map((stream) => stream.id),
    ["1080", "4k"],
  );
  assert.equal(hostOverride.fellBack, false);
});
