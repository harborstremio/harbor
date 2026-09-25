// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { beforeEach, test } from "node:test";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { registerHooks } from "node:module";
// @ts-expect-error Node test types are outside the browser tsconfig.
import { readFileSync } from "node:fs";

const endpointsUrl = new URL("../src/lib/config/endpoints.ts", import.meta.url).href;
const hook = registerHooks({
  load(url, context, nextLoad) {
    return url === endpointsUrl
      ? {
          format: "module-typescript",
          shortCircuit: true,
          source: `import.meta.env = {};\n${readFileSync(new URL(url), "utf8")}`,
        }
      : nextLoad(url, context);
  },
});
const history = await import("../src/lib/stremio-history.ts").catch((error) => {
  if (error.code === "ERR_MODULE_NOT_FOUND") return {};
  throw error;
});
hook.deregister();
let values: Map<string, string>;
let writes: unknown[];
let getFailure = false;
let putFailure = false;
let onRead = () => {};
let onWrite = () => {};
const profile = { activeId: "a", settingsLinked: false };
const original = {
  _id: "tt1",
  type: "series",
  name: "Title",
  removed: false,
  temp: false,
  _ctime: "old",
  _mtime: "old",
  poster: "poster",
  behaviorHints: { keep: true },
  state: {
    timeOffset: 23,
    duration: 90,
    flaggedWatched: 1,
    timesWatched: 2,
    watched: "bits",
    timeWatched: 45,
    overallTimeWatched: 100,
    lastWatched: "yesterday",
    season: 2,
    episode: 3,
    video_id: "tt1:2:3",
    noNotif: true,
    custom: { keep: true },
  },
};
beforeEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { hostname: "fixture.invalid", origin: "https://fixture.invalid" } },
  });
  values = new Map([
    [
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "a", profiles: [{ id: "a", settingsLinked: false }] }),
    ],
    ["harbor.auth.a", JSON.stringify({ authKey: "fixture-key", user: { _id: "fixture" } })],
  ]);
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null },
  });
  writes = [];
  getFailure = false;
  putFailure = false;
  onRead = () => {};
  onWrite = () => {};
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    if (body.changes) {
      writes.push(body.changes[0]);
      onWrite();
      return new Response(
        JSON.stringify(putFailure ? { error: { message: "fixture failure" } } : { result: true }),
        { status: putFailure ? 500 : 200 },
      );
    }
    if (getFailure) throw new Error("fixture read failure");
    onRead();
    return new Response(JSON.stringify({ result: [original] }));
  };
});
const clear = (id = "tt1") => {
  assert.equal(typeof history.clearStremioTitleHistory, "function");
  return history.clearStremioTitleHistory({ id, authKey: "fixture-key", profile });
};
test("clearing title history preserves bookmark membership and unrelated metadata", async () => {
  await clear();
  assert.equal(writes.length, 1);
  const updated = writes[0];
  assert.equal(updated.removed, false);
  assert.equal(updated.temp, false);
  assert.equal(updated._ctime, original._ctime);
  assert.deepEqual(updated.behaviorHints, original.behaviorHints);
  assert.deepEqual(updated.state.custom, original.state.custom);
  assert.equal(updated.state.noNotif, true);
  for (const key of [
    "timeOffset",
    "timeWatched",
    "overallTimeWatched",
    "flaggedWatched",
    "timesWatched",
  ])
    assert.equal(updated.state[key], 0);
  assert.equal(updated.state.watched, "");
  assert.equal(updated.state.lastWatched, undefined);
  assert.equal(updated.state.video_id, undefined);
  assert.equal(original.state.timeOffset, 23);
});
test("history clear propagates strict read and write failures", async () => {
  getFailure = true;
  await assert.rejects(clear(), /read failure/);
  assert.equal(writes.length, 0);
  getFailure = false;
  putFailure = true;
  await assert.rejects(clear(), /failure/);
  assert.equal(writes.length, 1);
});
test("history clear rejects unsupported IDs and missing current title", async () => {
  await assert.rejects(clear("kitsu:1"), /support/i);
  await assert.rejects(clear("tt-missing"), /no longer/i);
  assert.equal(writes.length, 0);
});
test("history clear revalidates profile and auth after fresh read", async () => {
  onRead = () => values.set("harbor.auth.a", JSON.stringify({ authKey: "changed", user: {} }));
  await assert.rejects(clear(), /profile|account/i);
  assert.equal(writes.length, 0);
  values.set("harbor.auth.a", JSON.stringify({ authKey: "fixture-key", user: {} }));
  onRead = () =>
    values.set(
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
    );
  await assert.rejects(clear(), /profile|account/i);
  assert.equal(writes.length, 0);
});

test("an acknowledged history clear does not update a newly switched profile view", async () => {
  let visible = [original];
  onWrite = () =>
    values.set(
      "harbor.profiles.v1",
      JSON.stringify({ activeId: "b", profiles: [{ id: "b", settingsLinked: false }] }),
    );
  await assert.rejects(
    clear().then(() => {
      visible = [];
    }),
    /previous account.*current view/i,
  );
  assert.equal(writes.length, 1);
  assert.deepEqual(visible, [original]);
});

test("an acknowledged history clear reports an account switch during its write", async () => {
  onWrite = () => values.set("harbor.auth.a", JSON.stringify({ authKey: "changed", user: {} }));
  await assert.rejects(clear(), /previous account.*current view/i);
  assert.equal(writes.length, 1);
});
