import test from "node:test";
import assert from "node:assert/strict";
import { archiveLocationChoices, recentArchiveParent } from "../src/lib/games/archive-locations";
import type { ArchiveJob } from "../src/lib/games/archives";

const location = (path: string, availableBytes: number | null = null) => ({ path, label: path, availableBytes });
test("archive shortcuts use the last successful destination from this profile", () => {
  const jobs = [
    { profile: "one", status: "complete", destination: "D:\\Games\\A", updatedAt: 2 },
    { profile: "one", status: "failed", destination: "F:\\Missing\\B", updatedAt: 9 },
    { profile: "two", status: "complete", destination: "E:\\Other\\C", updatedAt: 10 },
  ] as ArchiveJob[];
  assert.equal(recentArchiveParent(jobs, "one"), "D:\\Games");
  assert.equal(recentArchiveParent(jobs, "none"), "");
  assert.equal(jobs[0].updatedAt, 2);
});
test("archive places deduplicate Windows aliases, retain roots and preserve zero/unknown space", () => {
  const choices = archiveLocationChoices({ selected: location("D:\\Games"), drives: [location("D:\\", 0), location("F:\\", null)] }, { selected: location("d:/games"), drives: [location("d:/", 10)] });
  assert.equal(choices.length, 3);
  assert.equal(choices[0].kind, "recent");
  assert.equal(choices[0].path, "D:\\Games");
  assert.equal(choices[1].path, "D:\\");
  assert.equal(choices[1].availableBytes, 0);
  assert.equal(choices[2].availableBytes, null);
});
test("archive places preserve POSIX case sensitivity and survive one missing source", () => {
  const choices = archiveLocationChoices({ selected: null, drives: [] }, { selected: location("/games"), drives: [location("/"), location("/Games")] });
  assert.deepEqual(choices.map(value => [value.path, value.kind]), [["/games", "source"], ["/", "drive"], ["/Games", "drive"]]);
});
