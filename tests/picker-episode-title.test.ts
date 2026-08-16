// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  createPickerEpisodeTitleResolution,
  mergePickerEpisodeTitle,
} from "../src/views/play-picker/picker-episode-title.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test("replaces a Dateline placeholder with the matching Cinemeta name", () => {
  const episode = { season: 34, episode: 14, name: "Episode 14", videoId: "keep-me" };
  const merged = mergePickerEpisodeTitle(episode, [
    { season: 34, episode: 14, name: "Bringing Jay Home" },
  ]);
  assert.equal(merged.name, "Bringing Jay Home");
  assert.equal(merged.videoId, "keep-me");
});

test("accepts video.title and a fetched PlayEpisode name", () => {
  const untitled = { season: 2, episode: 3, name: "Untitled" };
  assert.equal(
    mergePickerEpisodeTitle(untitled, [{ season: 2, number: 3, title: "The Reveal" }]).name,
    "The Reveal",
  );
  assert.equal(
    mergePickerEpisodeTitle({ season: 2, episode: 3 }, [
      { season: 2, episode: 3, name: "Fetched title" },
    ]).name,
    "Fetched title",
  );
});

test("ignores other episodes and never replaces a real title", () => {
  const placeholder = { season: 34, episode: 14, name: "Episode 14" };
  assert.strictEqual(
    mergePickerEpisodeTitle(placeholder, [
      { season: 33, episode: 14, name: "Wrong season" },
      { season: 34, episode: 15, name: "Wrong episode" },
    ]),
    placeholder,
  );
  const real = { season: 34, episode: 14, name: "Original real title" };
  assert.strictEqual(
    mergePickerEpisodeTitle(real, [
      { season: 34, episode: 14, name: "Different provider title" },
    ]),
    real,
  );
});

test("early play, download, and invite consumers share one pending title lookup", async () => {
  const lookup = deferred<
    Array<{ season: number; episode: number; name: string }>
  >();
  let lookupCalls = 0;
  const generic = {
    season: 34,
    episode: 14,
    name: "Episode 14",
    sourceMetaId: "tt0103396",
  };
  const resolution = createPickerEpisodeTitleResolution(generic, undefined, () => {
    lookupCalls += 1;
    return lookup.promise;
  });

  const firstPromise = resolution.settleEpisode();
  const playEpisode = firstPromise.then((episode) => episode);
  const downloadEpisode = resolution.settleEpisode().then((episode) => episode);
  const invitedNames: Array<string | null | undefined> = [];
  const invite = resolution
    .settleEpisode()
    .then((episode) => invitedNames.push(episode?.name));

  assert.strictEqual(resolution.settleEpisode(), firstPromise);
  await Promise.resolve();
  assert.equal(lookupCalls, 1);
  assert.deepEqual(invitedNames, []);

  lookup.resolve([{ season: 34, episode: 14, name: "Bringing Jay Home" }]);
  const [played, downloaded] = await Promise.all([playEpisode, downloadEpisode, invite]).then(
    ([playedEpisode, downloadedEpisode]) => [playedEpisode, downloadedEpisode],
  );

  assert.equal(played?.name, "Bringing Jay Home");
  assert.equal(downloaded?.name, "Bringing Jay Home");
  assert.equal(played?.sourceMetaId, "tt0103396");
  assert.deepEqual(invitedNames, ["Bringing Jay Home"]);
});

test("failed title lookup settles every consumer with the original episode", async () => {
  const generic = { season: 1, episode: 1, name: "Episode 1" };
  const resolution = createPickerEpisodeTitleResolution(generic, undefined, async () => {
    throw new Error("provider unavailable");
  });

  const firstPromise = resolution.settleEpisode();
  assert.strictEqual(resolution.settleEpisode(), firstPromise);
  assert.strictEqual(await firstPromise, generic);
});

test("a bounded action falls back promptly while background enrichment keeps running", async () => {
  const lookup = deferred<
    Array<{ season: number; episode: number; name: string }>
  >();
  const generic = { season: 34, episode: 14, name: "Episode 14" };
  const resolution = createPickerEpisodeTitleResolution(
    generic,
    undefined,
    () => lookup.promise,
    { actionWaitMs: 0 },
  );

  const actionEpisode = resolution.settleEpisode();
  lookup.resolve([{ season: 34, episode: 14, name: "Bringing Jay Home" }]);
  assert.strictEqual(await actionEpisode, generic);
  assert.equal((await resolution.resolveEpisode())?.name, "Bringing Jay Home");
  assert.equal((await resolution.settleEpisode())?.name, "Bringing Jay Home");
});
