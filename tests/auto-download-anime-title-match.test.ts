// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  animeTitleEvidence,
  isSafeAnimeAutoDownload,
} from "../src/lib/auto-download/anime-title-match.ts";

const mainTitles = ["That Time I Got Reincarnated as a Slime", "Tensei Shitara Slime Datta Ken"];

test("anime release titles that match a known alias are safe for automatic selection", () => {
  assert.equal(animeTitleEvidence(mainTitles, "That Time I Got Reincarnated as a Slime"), "match");
  assert.equal(animeTitleEvidence(mainTitles, "Tensei Shitara Slime Datta Ken"), "match");
});

test("a related or extended title stays uncertain instead of passing the auto-pick gate", () => {
  assert.equal(animeTitleEvidence(mainTitles, "The Slime Diaries"), "unknown");
});

test("unrecognized aliases stay available for review but are not safe for auto-pick", () => {
  assert.equal(
    animeTitleEvidence(mainTitles, "That Time I Got Reincarnated as a Slime Diaries"),
    "unknown",
  );
  assert.equal(
    animeTitleEvidence(mainTitles, "Tensura Nikki Tensei Shitara Slime Datta Ken"),
    "unknown",
  );
  assert.equal(animeTitleEvidence(mainTitles, "Completely unrelated title"), "unknown");
  assert.equal(
    animeTitleEvidence(mainTitles, "That Time I Got Reincarnated as a Slime Diaries"),
    "unknown",
  );
});

test("a valid source-specific alias for a later anime entry is accepted exactly", () => {
  const laterEntryTitles = ["That Time I Got Reincarnated as a Slime", "Tensura Nikki"];
  assert.equal(animeTitleEvidence(laterEntryTitles, "Tensura Nikki"), "match");
  assert.equal(animeTitleEvidence(laterEntryTitles, "Tensura Nikki Diaries"), "unknown");
});

test("empty title evidence does not claim a confident match", () => {
  assert.equal(animeTitleEvidence([], "That Time I Got Reincarnated as a Slime"), "unknown");
  assert.equal(animeTitleEvidence(mainTitles, null), "unknown");
});

test("unattended downloads require a known alias for both candidate and resolved file", () => {
  assert.equal(
    isSafeAnimeAutoDownload(mainTitles, "That Time I Got Reincarnated as a Slime"),
    true,
  );
  assert.equal(
    isSafeAnimeAutoDownload(mainTitles, "That Time I Got Reincarnated as a Slime", "Tensura Nikki"),
    false,
  );
  assert.equal(isSafeAnimeAutoDownload([], "That Time I Got Reincarnated as a Slime"), false);
});
