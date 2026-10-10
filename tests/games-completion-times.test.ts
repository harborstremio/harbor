import test from "node:test";
import assert from "node:assert/strict";
import { completionTimeQuery, parseCompletionTimes } from "../src/lib/games/completion-time-data.ts";

test("completion data requires an exact unambiguous numeric game identity", () => {
  assert.throws(() => completionTimeQuery(-1));
  assert.throws(() => completionTimeQuery(1.2));
  assert.equal(parseCompletionTimes([{ game_id: 2, count: 50, hastily: 3600 }], 1), null);
  assert.equal(parseCompletionTimes([{ game_id: "1", count: 50, hastily: 3600 }], 1), null);
  assert.throws(() => parseCompletionTimes([{ game_id: 1 }, { game_id: 1 }], 1));
});
test("missing estimates and zero submissions stay unavailable rather than invented zero-hour playtimes", () => {
  assert.equal(parseCompletionTimes([{ game_id: 1, count: 0, hastily: 3600 }], 1), null);
  assert.equal(parseCompletionTimes([{ game_id: 1, count: 10, hastily: 0, normally: -1, completely: "100" }], 1), null);
  assert.deepEqual(parseCompletionTimes([{ game_id: 1, count: 10, hastily: 3600, normally: 5400, completely: 9000 }], 1), { gameId: 1, count: 10, main: 3600, extras: 5400, complete: 9000 });
});
