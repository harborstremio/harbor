// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  isGenericEpisodeTitle,
  pickPreferredEpisodeTitle,
  waitForEpisodeTitles,
} from "../src/lib/episode-title.ts";

test("recognizes empty, unnumbered, and numbered placeholder episode titles", () => {
  assert.equal(isGenericEpisodeTitle(undefined, 1), true);
  assert.equal(isGenericEpisodeTitle("   ", 1), true);
  assert.equal(isGenericEpisodeTitle("Episode 1", 1), true);
  assert.equal(isGenericEpisodeTitle(" episode 01 ", 1), true);
  assert.equal(isGenericEpisodeTitle("EPISODE\t1", 1), true);
  assert.equal(isGenericEpisodeTitle("Untitled", 1), true);
  assert.equal(isGenericEpisodeTitle("TBD", 1), true);
  assert.equal(isGenericEpisodeTitle(" TBA ", 1), true);
});

test("preserves real titles and placeholders for a different episode", () => {
  assert.equal(isGenericEpisodeTitle("An Encounter", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode One", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode 2", 1), false);
  assert.equal(isGenericEpisodeTitle("Episode 1: The Beginning", 1), false);
});

test("provider precedence keeps a real primary title and replaces a generic one", () => {
  assert.equal(
    pickPreferredEpisodeTitle(1, "Kitsu title", "AniZip title"),
    "Kitsu title",
  );
  assert.equal(
    pickPreferredEpisodeTitle(1, "Episode 1", "AniZip title"),
    "AniZip title",
  );
  assert.equal(pickPreferredEpisodeTitle(1, undefined, undefined), null);
});

test("generic rows wait for enrichment before becoming displayable", async () => {
  const episodes = [{ number: 1, title: "Episode 1" }];
  let release!: (value: typeof episodes) => void;
  const enrichment = new Promise<typeof episodes>((resolve) => {
    release = resolve;
  });
  let settled = false;
  const ready = waitForEpisodeTitles(episodes, enrichment).then((value) => {
    settled = true;
    return value;
  });
  await Promise.resolve();
  assert.equal(settled, false);
  episodes[0].title = "An Encounter";
  release(episodes);
  assert.equal((await ready)[0].title, "An Encounter");
});

test("real episode titles do not wait for unrelated enrichment", async () => {
  const episodes = [{ number: 1, title: "An Encounter" }];
  const never = new Promise<typeof episodes>(() => {});
  assert.equal((await waitForEpisodeTitles(episodes, never))[0].title, "An Encounter");
});
