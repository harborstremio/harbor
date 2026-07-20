// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { mergeDoc } from "../src/lib/sync/merge.ts";

test("uses document-level last-write-wins for ordinary keys", () => {
  assert.equal(mergeDoc("harbor.settings", "local", "remote", true), "local");
  assert.equal(mergeDoc("harbor.settings", "local", "remote", false), "remote");
  assert.equal(mergeDoc("harbor.settings", null, "remote", true), null);
  assert.equal(mergeDoc("harbor.settings", "local", null, false), null);
});

test("merges continue-watching entries by their latest timestamp", () => {
  const local = JSON.stringify({
    movie: { id: "movie", t: 30, name: "Local movie" },
    localOnly: { id: "localOnly", t: 20 },
  });
  const remote = JSON.stringify({
    movie: { id: "movie", t: 40, name: "Remote movie" },
    remoteOnly: { id: "remoteOnly", t: 10 },
  });

  const merged = mergeDoc("harbor.localcw.v1", local, remote, true);
  assert.deepEqual(JSON.parse(merged ?? "{}"), {
    movie: { id: "movie", t: 40, name: "Remote movie" },
    localOnly: { id: "localOnly", t: 20 },
    remoteOnly: { id: "remoteOnly", t: 10 },
  });
});

test("merges profile-scoped continue-watching keys", () => {
  const local = JSON.stringify({ episode: { id: "episode", t: 20 } });
  const remote = JSON.stringify({
    episode: { id: "episode", t: 10 },
    other: { id: "other", t: 15 },
  });

  assert.deepEqual(
    JSON.parse(mergeDoc("harbor.localcw.v1.profile-abc", local, remote, false) ?? "{}"),
    {
      episode: { id: "episode", t: 20 },
      other: { id: "other", t: 15 },
    },
  );
});

test("falls back to last-write-wins for unparseable or null continue-watching documents", () => {
  assert.equal(mergeDoc("harbor.localcw.v1", "not json", "{}", true), "not json");
  assert.equal(mergeDoc("harbor.localcw.v1", "{}", "not json", false), "not json");
  assert.equal(mergeDoc("harbor.localcw.v1", null, "{}", true), null);
  assert.equal(mergeDoc("harbor.localcw.v1", "{}", null, false), null);
});
