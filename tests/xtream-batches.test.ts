import assert from "node:assert/strict";
import test from "node:test";
import { processInBatches } from "../src/lib/iptv/xtream-batches.ts";

test("publishes mapped rows in order and yields between batches", async () => {
  const events: string[] = [];
  const published: number[][] = [];

  const result = await processInBatches([1, 2, 3, 4, 5], {
    batchSize: 2,
    map: (value) => value * 10,
    onBatch: (batch, progress) => {
      published.push([...batch]);
      events.push(`publish:${progress.processed}/${progress.total}`);
    },
    yieldControl: async () => {
      events.push("yield");
    },
  });

  assert.deepEqual(result, [10, 20, 30, 40, 50]);
  assert.deepEqual(published, [[10, 20], [30, 40], [50]]);
  assert.deepEqual(events, ["publish:2/5", "yield", "publish:4/5", "yield", "publish:5/5"]);
});

test("skips rejected rows without losing progress", async () => {
  const progress: string[] = [];

  const result = await processInBatches([1, 2, 3, 4], {
    batchSize: 2,
    map: (value) => (value % 2 === 0 ? value : null),
    onBatch: (_batch, state) => {
      progress.push(`${state.processed}/${state.total}`);
    },
    yieldControl: async () => {},
  });

  assert.deepEqual(result, [2, 4]);
  assert.deepEqual(progress, ["2/4", "4/4"]);
});

test("stops processing when the publisher rejects a stale request", async () => {
  let yields = 0;

  const result = await processInBatches([1, 2, 3, 4, 5, 6], {
    batchSize: 2,
    map: (value) => value,
    onBatch: (_batch, progress) => progress.processed < 4,
    yieldControl: async () => {
      yields += 1;
    },
  });

  assert.deepEqual(result, [1, 2, 3, 4]);
  assert.equal(yields, 1);
});

test("processes a 16,113-item provider catalog without an implicit cap", async () => {
  const rows = Array.from({ length: 16_113 }, (_, index) => index);
  let batches = 0;

  const result = await processInBatches(rows, {
    batchSize: 256,
    map: (value) => value,
    onBatch: () => {
      batches += 1;
    },
    yieldControl: async () => {},
  });

  assert.equal(result.length, 16_113);
  assert.equal(batches, 63);
});
