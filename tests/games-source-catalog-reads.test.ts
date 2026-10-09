import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceCatalogReads } from '../src/lib/games/source-catalog-reads.ts';
import type { GameSource } from '../src/lib/games/sources.ts';

function harness() {
  const calls: { profile: string; signal: AbortSignal; resolve: (value: GameSource[]) => void; reject: (error: unknown) => void }[] = [];
  const reader = createSourceCatalogReads((profile, signal) => new Promise((resolve, reject) => {
    calls.push({ profile, signal, resolve, reject });
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  }));
  return { calls, reader };
}
const tick = () => new Promise<void>(resolve => queueMicrotask(resolve));

test('one canceled source view does not interrupt another view sharing its profile', async () => {
  const { calls, reader } = harness(), first = new AbortController(), second = new AbortController();
  const a = reader.read('profile', first.signal), b = reader.read('profile', second.signal);
  await tick(); assert.equal(calls.length, 1);
  const reason = Error('left first view'), canceled = assert.rejects(a, error => error === reason);
  first.abort(reason); await canceled;
  assert.equal(calls[0].signal.aborted, false);
  const result: GameSource[] = [];
  calls[0].resolve(result); assert.equal(await b, result);
  second.abort(); assert.equal(calls[0].signal.aborted, false);
});

test('the last canceled reader stops its worker request and permits an immediate replacement', async () => {
  const { calls, reader } = harness(), controller = new AbortController();
  const old = reader.read('profile', controller.signal); await tick();
  const canceled = assert.rejects(old, { name: 'AbortError' }); controller.abort(); await canceled;
  assert.equal(calls[0].signal.aborted, true);
  const next = reader.read('profile'); await tick();
  assert.equal(calls.length, 2); assert.equal(calls[1].signal.aborted, false);
  calls[1].resolve([]); await next;
});

test('pre-canceled and immediately canceled restores never begin loading', async () => {
  const { calls, reader } = harness(), before = new AbortController(); before.abort();
  await assert.rejects(reader.read('profile', before.signal), { name: 'AbortError' });
  const queued = new AbortController(), pending = reader.read('profile', queued.signal);
  const canceled = assert.rejects(pending, { name: 'AbortError' }); queued.abort(); await canceled; await tick();
  assert.equal(calls.length, 0);
});

test('an uncancelable consumer retains shared work and another profile has independent lifetime', async () => {
  const { calls, reader } = harness(), controller = new AbortController();
  const held = reader.read('first'), leaving = reader.read('first', controller.signal), other = reader.read('second');
  await tick(); assert.deepEqual(calls.map(call => call.profile), ['first', 'second']);
  const canceled = assert.rejects(leaving); controller.abort(); await canceled;
  assert.equal(calls[0].signal.aborted, false); assert.equal(calls[1].signal.aborted, false);
  calls[0].resolve([]); calls[1].resolve([]); await Promise.all([held, other]);
});

test('invalidation detaches the old generation without letting its cancellation remove the new one', async () => {
  const { calls, reader } = harness(), controller = new AbortController();
  const old = reader.read('profile', controller.signal); await tick(); reader.forget('profile');
  const current = reader.read('profile'); await tick();
  const canceled = assert.rejects(old); controller.abort(); await canceled;
  const joined = reader.read('profile'); await tick();
  assert.equal(calls.length, 2); assert.equal(calls[1].signal.aborted, false);
  const result: GameSource[] = []; calls[1].resolve(result);
  assert.equal(await current, result); assert.equal(await joined, result);
});

test('settled success and failure never cache snapshots or poison subsequent restores', async () => {
  const { calls, reader } = harness();
  const failed = reader.read('profile'); await tick();
  const rejected = assert.rejects(failed, /source_storage/); calls[0].reject(Error('source_storage')); await rejected;
  const retry = reader.read('profile'); await tick(); calls[1].resolve([]); await retry;
  const later = reader.read('profile'); await tick(); assert.equal(calls.length, 3); calls[2].resolve([]); await later;
});
