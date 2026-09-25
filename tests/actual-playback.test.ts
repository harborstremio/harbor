import assert from "node:assert/strict";
import test from "node:test";
import * as history from "../src/lib/playback-history";

const values = new Map<string, string>();
let failWrite = false;
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrite) throw new Error("fixture storage failure");
      values.set(key, value);
    },
    removeItem: (key: string) => values.delete(key),
  },
});

function actor(profileId = "one", accountId = "account-one", shared?: string) {
  values.set(
    "harbor.profiles.v1",
    JSON.stringify({
      activeId: profileId,
      profiles: [
        { id: "one", isPrimary: true },
        { id: "two", shareStremioWith: shared },
      ],
    }),
  );
  values.set(
    `harbor.auth.${shared ?? profileId}`,
    JSON.stringify({ authKey: `key-${accountId}`, user: { _id: accountId } }),
  );
  return history.capturePlaybackActor();
}

function fixture(id: string, path: string, at: number, captured = actor()) {
  return {
    id,
    actor: captured,
    playedAt: at,
    positionMs: 12345,
    durationMs: 180000,
    completed: false,
    src: {
      meta: { id: "local:fixture", type: "movie" as const, name: "Fixture" },
      url: path,
      title: "Fixture",
      notWebReady: true,
    },
  };
}

test("actual playback does not derive recency from source selections or manual history", () => {
  values.clear();
  actor();
  history.savePlayback("tt-not-played", { title: "Opened source" });
  assert.equal(history.readLastActualPlayback(), null);
  const first = fixture("played-one", "C:/fixture/first.mp4", Date.now());
  assert.equal(history.recordActualPlayback(first), true);
  history.savePlayback("local:fixture", {
    url: "https://fixture.invalid/unplayed",
    title: "Not yet playing",
  });
  history.savePlayback("tt-newer-manual", { title: "Manually watched" });
  assert.equal(history.readLastActualPlayback()?.id, "played-one");
  assert.equal(history.readLastActualPlayback()?.src.url, first.src.url);
});

test("exact physical source and position survive storage round trip without title merging", () => {
  values.clear();
  actor();
  const one = fixture("file-one", "C:/fixture/one.mp4", Date.now());
  const two = { ...fixture("file-two", "C:/fixture/two.mp4", Date.now() + 1), positionMs: 67890 };
  history.recordActualPlayback(one);
  history.recordActualPlayback(two);
  const read = history.readLastActualPlayback();
  assert.equal(read?.src.url, two.src.url);
  assert.equal(read?.positionMs, 67890);
  assert.notEqual(read, two);
});

test("actor changes reject delayed writes and account changes hide previous account playback", () => {
  values.clear();
  const one = actor();
  history.recordActualPlayback(fixture("old", "C:/fixture/a.mp4", Date.now(), one));
  actor("two", "account-two");
  assert.equal(
    history.recordActualPlayback(fixture("late", "C:/fixture/a.mp4", Date.now() + 1, one)),
    false,
  );
  assert.equal(history.readLastActualPlayback(), null);
  actor("one", "new-account");
  assert.equal(history.readLastActualPlayback(), null);
});

test("intentional shared Stremio history scope is preserved but delayed actor writes are rejected", () => {
  values.clear();
  const one = actor();
  history.recordActualPlayback(fixture("shared", "C:/fixture/a.mp4", Date.now(), one));
  actor("two", "account-one", "one");
  assert.equal(history.readLastActualPlayback()?.id, "shared");
  assert.equal(
    history.recordActualPlayback(fixture("late", "C:/fixture/a.mp4", Date.now(), one)),
    false,
  );
});

test("failed persistence preserves existing record and does not report a saved replacement", () => {
  values.clear();
  actor();
  history.recordActualPlayback(fixture("saved", "C:/fixture/a.mp4", Date.now()));
  failWrite = true;
  try {
    assert.equal(
      history.recordActualPlayback(fixture("not-saved", "C:/fixture/b.mp4", Date.now() + 1)),
      false,
    );
  } finally {
    failWrite = false;
  }
  assert.equal(history.readLastActualPlayback()?.id, "saved");
});

test("rejecting an unplayed bad source clears its preference but retains actual last playback", () => {
  values.clear();
  actor();
  history.recordActualPlayback(fixture("played", "C:/fixture/a.mp4", Date.now()));
  history.savePlayback("local:fixture", { infoHash: "bad-source", fileIdx: 2 });
  history.clearPlayback("local:fixture");
  assert.equal(history.readPlayback("local:fixture")?.infoHash, undefined);
  assert.equal(history.readLastActualPlayback()?.id, "played");
});

test("EOF without mpv tracks persists the last valid audio from that same playback session", () => {
  values.clear();
  const first = fixture("same-session", "C:/fixture/a.mp4", Date.now());
  const audioTrack = {
    id: "2",
    lang: "ara",
    title: "Commentary",
    channels: "stereo",
    channelCount: 2,
  };
  history.recordActualPlayback({ ...first, audioTrack });
  history.recordActualPlayback({
    ...first,
    playedAt: first.playedAt + 1,
    positionMs: 179600,
    completed: true,
  });
  const ended = history.readLastActualPlayback();
  assert.deepEqual(ended?.audioTrack, audioTrack);
  assert.equal(ended?.completed, true);
  assert.equal(ended?.positionMs, 179600);
});

test("EOF audio preservation never crosses a physical source, session, or actor", () => {
  for (const change of ["source", "session", "actor"] as const) {
    values.clear();
    const first = fixture("one-session", "C:/fixture/a.mp4", Date.now());
    history.recordActualPlayback({ ...first, audioTrack: { id: "2", lang: "ara" } });
    const second = {
      ...first,
      completed: true,
      playedAt: first.playedAt + 1,
      id: change === "session" ? "two-session" : first.id,
      src: change === "source" ? { ...first.src, url: "C:/fixture/b.mp4" } : first.src,
      actor: change === "actor" ? actor("one", "new-account") : first.actor,
    };
    history.recordActualPlayback(second);
    assert.equal(history.readLastActualPlayback()?.audioTrack, undefined, change);
  }
});

test("an invalid prior snapshot cannot supply EOF audio or prevent the new snapshot from saving", () => {
  values.clear();
  const first = fixture("same-session", "C:/fixture/a.mp4", Date.now());
  history.recordActualPlayback({ ...first, audioTrack: { id: "2", lang: "ara" } });
  const key = "harbor.playback-history.v1.one";
  const stored = JSON.parse(values.get(key)!);
  delete stored["local:fixture"].actual.actor;
  values.set(key, JSON.stringify(stored));
  assert.equal(history.recordActualPlayback({ ...first, completed: true }), true);
  assert.equal(history.readLastActualPlayback()?.audioTrack, undefined);
});
