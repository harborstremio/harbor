// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import {
  discoverReviewRows,
  resolveReviewSelections,
} from "../src/lib/download/review-operations.ts";

test("canceling resolution stops waiting episodes and suppresses stale progress", async () => {
  const controller = new AbortController();
  const attempted: number[] = [];
  const progress: number[] = [];
  await resolveReviewSelections(
    [1, 2, 3, 4].map((episode) => ({ episode, candidate: episode })),
    async (episode) => {
      attempted.push(episode);
      controller.abort();
      throw new Error("Canceled");
    },
    controller.signal,
    (done) => progress.push(done),
  );
  assert.deepEqual(attempted, [1]);
  assert.deepEqual(progress, []);
});

test("discovery returns candidates without resolving or queueing any candidate", async () => {
  const episodes = [1, 2, 3];
  const operations: string[] = [];
  let active = 0;
  let maxActive = 0;
  const rows = await discoverReviewRows(
    episodes,
    async (episode) => {
      operations.push(`find:${episode}`);
      maxActive = Math.max(maxActive, ++active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active -= 1;
      return [`candidate-${episode}`];
    },
    new AbortController().signal,
  );
  assert.deepEqual(rows, [
    { episode: 1, candidates: ["candidate-1"] },
    { episode: 2, candidates: ["candidate-2"] },
    { episode: 3, candidates: ["candidate-3"] },
  ]);
  assert.deepEqual(operations.sort(), ["find:1", "find:2", "find:3"]);
  assert.equal(maxActive, 2);
});

test("confirmation resolves only chosen candidates, skips null choices, and continues after failure", async () => {
  const chosenA = { id: "selected-A" };
  const alternativeA = { id: "unselected-A" };
  const chosenB = { id: "selected-B" };
  const selected: string[] = [];
  const results = await resolveReviewSelections(
    [
      { episode: "S1E1", candidate: chosenA },
      { episode: "S1E2", candidate: null },
      { episode: "S1E3", candidate: chosenB },
    ],
    async (episode, candidate) => {
      selected.push(candidate.id);
      if (episode === "S1E1") throw new Error("source failed");
    },
    new AbortController().signal,
  );
  assert.deepEqual(selected.sort(), ["selected-A", "selected-B"]);
  assert.equal(selected.includes(alternativeA.id), false);
  assert.deepEqual(
    results.sort((a, b) => a.episode.localeCompare(b.episode)),
    [
      { episode: "S1E1", status: "failed" },
      { episode: "S1E2", status: "skipped" },
      { episode: "S1E3", status: "queued" },
    ],
  );
});
