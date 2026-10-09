import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceWorkQueue } from '../src/lib/games/source-work-queue.ts';

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
function gate() {
  let resolve!: () => void;
  return { promise: new Promise<void>(done => { resolve = done; }), release: () => resolve() };
}

test('canceling 72 waiting refreshes settles immediately and never starts their work', async () => {
  const queue = createSourceWorkQueue(), held = gate(), started: string[] = [];
  const first = queue.run(async () => { started.push('active'); await held.promise; }, false);
  await tick();
  const controllers = Array.from({ length: 72 }, () => new AbortController());
  const abandoned = controllers.map((controller, i) => queue.run(async () => { started.push(String(i)); }, false, controller.signal).then(() => false, reason => reason === controller.signal.reason));
  controllers.forEach(controller => controller.abort());
  assert.deepEqual(await Promise.all(abandoned), Array(72).fill(true));
  assert.deepEqual(started, ['active']);
  const latest = queue.run(async () => { started.push('latest'); }, true);
  held.release(); await Promise.all([first, latest]);
  assert.deepEqual(started, ['active', 'latest']);
});

test('visible searches pass waiting refreshes with FIFO order and one background turn per three queries', async () => {
  const queue = createSourceWorkQueue(), held = gate(), order: string[] = [];
  let concurrent = 0, peak = 0;
  const active = queue.run(() => held.promise, false); await tick();
  const run = (name: string, foreground: boolean) => queue.run(async () => {
    concurrent++; peak = Math.max(peak, concurrent); order.push(name); await tick(); concurrent--; return name;
  }, foreground);
  const pending = [...Array.from({ length: 3 }, (_, i) => run('refresh' + i, false)), ...Array.from({ length: 8 }, (_, i) => run('search' + i, true))];
  held.release(); await Promise.all([active, ...pending]);
  assert.equal(peak, 1);
  assert.deepEqual(order, ['search0', 'search1', 'search2', 'refresh0', 'search3', 'search4', 'search5', 'refresh1', 'search6', 'search7', 'refresh2']);
});

test('synchronous and asynchronous failures free the lane; an already canceled request is never invoked', async () => {
  const queue = createSourceWorkQueue(), canceled = new AbortController(); canceled.abort('gone');
  let calls = 0;
  await assert.rejects(queue.run(async () => { calls++; }, true, canceled.signal), reason => reason === 'gone');
  await assert.rejects(queue.run(() => { throw Error('sync'); }, false), /sync/);
  await assert.rejects(queue.run(async () => { throw Error('async'); }, true), /async/);
  assert.equal(await queue.run(async () => ++calls, false), 1);
});

test('active cancellation waits for worker cleanup while unrelated queued work survives', async () => {
  const queue = createSourceWorkQueue(), controller = new AbortController(), cleanup = gate();
  const active = queue.run(async () => {
    await new Promise<void>(resolve => controller.signal.addEventListener('abort', () => resolve(), { once: true }));
    await cleanup.promise; throw controller.signal.reason;
  }, true, controller.signal);
  const rejected = assert.rejects(active, { name: 'AbortError' }); await tick();
  let nextStarted = false;
  const next = queue.run(async () => { nextStarted = true; }, false);
  controller.abort(); await tick(); assert.equal(nextStarted, false);
  cleanup.release(); await Promise.all([rejected, next]); assert.equal(nextStarted, true);
});
