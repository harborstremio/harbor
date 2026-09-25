import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "./_localstorage-stub.ts";
import * as trakt from "../src/lib/trakt/pending-sync.ts";
import * as simkl from "../src/lib/simkl/pending-sync.ts";

const profile = (id) =>
  localStorage.setItem("harbor.profiles.v1", JSON.stringify({ activeId: id }));
for (const [service, queue, record, list, clear, flush] of [
  [
    "trakt",
    trakt,
    (id) => trakt.recordPendingStop(id, undefined, 100),
    trakt.listPendingStops,
    trakt.clearPendingStops,
    trakt.flushPendingStops,
  ],
  [
    "simkl",
    simkl,
    (id) => simkl.recordPendingWatch(id, undefined),
    simkl.listPendingWatches,
    simkl.clearPendingWatches,
    simkl.flushPendingWatches,
  ],
]) {
  const deps = (service, stop) => ({
    hasSession: () => true,
    resolveTarget: (id) => ({ kind: "movie", ids: { imdb: id } }),
    ...(service === "trakt"
      ? { commit: async (_target, metaId) => stop(metaId) }
      : {
          stopScrobble: async (metaId) => stop(metaId),
          recordWatched: async () => true,
        }),
  });
  test(`${service}: pending watches stay with their profile and keep newest 50`, () => {
    localStorage.clear();
    profile("first");
    for (let i = 0; i < 51; i++) record(`tt${i}`);
    assert.equal(list().length, 50);
    assert.equal(list()[0].metaId, "tt50");
    assert.equal(
      list().some((item) => item.metaId === "tt0"),
      false,
    );
    profile("second");
    assert.deepEqual(list(), []);
    record("tt900");
    clear();
    profile("first");
    assert.equal(list().length, 50);
    localStorage.clear();
  });
  test(`${service}: a profile switch during replay stops the remaining requests`, async () => {
    localStorage.clear();
    profile("first");
    record("tt1");
    record("tt2");
    let stops = 0;
    let history = 0;
    await flush({
      ...deps(service, async () => {
        stops++;
        profile("second");
        return service === "trakt" ? "recorded" : true;
      }),
      recordWatched: async () => {
        history++;
        return true;
      },
    });
    assert.equal(stops, 1);
    assert.equal(history, 0);
    profile("first");
    assert.equal(list().length, 2);
    localStorage.clear();
  });
  test(`${service}: account invalidation interrupts replay within the same profile`, async () => {
    localStorage.clear();
    record("tt1");
    record("tt2");
    let stops = 0;
    await flush(
      deps(service, async () => {
        stops++;
        clear();
        record("tt3");
        return service === "trakt" ? "recorded" : true;
      }),
    );
    assert.equal(stops, 1);
    assert.deepEqual(
      list().map((item) => item.metaId),
      ["tt3"],
    );
    const sessionSource = readFileSync(
      new URL(`../src/lib/${service}/session.ts`, import.meta.url),
      "utf8",
    );
    assert.match(sessionSource, /!session \|\| !cached \|\| session.username !== cached.username/);
    assert.ok(
      sessionSource.indexOf(`    clearPending`) < sessionSource.indexOf("  cached = session;"),
    );
    assert.ok(queue);
    localStorage.clear();
  });
}
