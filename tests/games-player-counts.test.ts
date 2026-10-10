import assert from 'node:assert/strict';
import test from 'node:test';
import { GamePlayerCounts, parseCurrentPlayers, PLAYER_COUNT_TTL } from '../src/lib/games/player-count-data.ts';

test('current-player response requires success and a real nonnegative integer, including zero', () => {
  assert.equal(parseCurrentPlayers({ response: { result: 1, player_count: 0 } }), 0);
  assert.equal(parseCurrentPlayers({ response: { result: 1, player_count: 1200500 } }), 1200500);
  for (const value of [null, {}, { response: { result: 2, player_count: 0 } }, ...['4', -1, 1.2, Infinity].map(player_count => ({ response: { result: 1, player_count } }))]) assert.throws(() => parseCurrentPlayers(value));
});

test('overlapping requests deduplicate, cap concurrency and batch size; timestamps do not refresh on cache reads', async () => {
  let now = 10000, calls = 0, active = 0, peak = 0;
  const counts = new GamePlayerCounts(async id => { calls++; peak = Math.max(peak, ++active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return { response: { result: 1, player_count: id * 10 } }; }, () => now);
  const [a, b] = await Promise.all([counts.load([1, 2, 3, 4]), counts.load([1, 3, 5])]);
  assert.equal(calls, 5); assert.equal(peak, 3); assert.equal(a[0].currentPlayers, 10); assert.equal(b[0].playersObservedAt, 10000);
  now += 1000; assert.equal((await counts.load([1]))[0].playersObservedAt, 10000); assert.equal(calls, 5);
  now += PLAYER_COUNT_TTL; await counts.load([1]); assert.equal(calls, 6);
  assert.equal((await counts.load(Array.from({ length: 30 }, (_, i) => i + 1))).length, 12);
});

test('expired counts are withheld on failure; partial success survives and failure is not a zero', async () => {
  let now = 1000, fail = false;
  const counts = new GamePlayerCounts(async id => { if (fail && id === 1) throw Error('offline'); return { response: { result: 1, player_count: id } }; }, () => now);
  await counts.load([1]); now += PLAYER_COUNT_TTL; fail = true;
  assert.deepEqual((await counts.load([1, 2])).map(v => v.appId), [2]);
  assert.deepEqual(await counts.load([1]), []);
});

test('one subscriber cancelling leaves shared work alive, while all cancelled queued work never starts', async () => {
  let calls = 0;
  const counts = new GamePlayerCounts((id, signal) => new Promise((resolve, reject) => {
    calls++;
    const timer = setTimeout(() => resolve({ response: { result: 1, player_count: id } }), 25);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
  }));
  const a = new AbortController(), b = new AbortController();
  const cancelled = counts.load([1, 2, 3, 4, 5], a.signal);
  const survived = counts.load([1], b.signal);
  a.abort();
  await assert.rejects(cancelled); assert.equal((await survived)[0].currentPlayers, 1); assert.equal(calls, 1);
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(counts.load([8], aborted.signal));
});
