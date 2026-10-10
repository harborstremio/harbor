import assert from 'node:assert/strict';
import test from 'node:test';
import { processSource } from '../src/lib/games/source-processing.ts';

test('production worker dispatch prioritizes visible queries, cancels queued work and replaces a canceled worker', async () => {
  const original = globalThis.Worker;
  const started: string[] = [], workers: ControlledWorker[] = [];
  class ControlledWorker {
    onmessage: ((event: { data: { result: unknown } }) => void) | null = null;
    onerror = null;
    terminated = false;
    constructor() { workers.push(this); }
    addEventListener() {} removeEventListener() {}
    terminate() { this.terminated = true; }
    postMessage(job: { kind: string; query?: string; value?: string }) { started.push(job.query ?? job.value!); }
    complete() { this.onmessage?.({ data: { result: [] } }); }
  }
  globalThis.Worker = ControlledWorker as unknown as typeof Worker;
  const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
  try {
    const first = processSource({ kind: 'validate', value: 'active' }); await tick();
    const canceled = new AbortController();
    const removed = assert.rejects(processSource({ kind: 'validate', value: 'abandoned' }, canceled.signal), { name: 'AbortError' });
    const maintenance = processSource({ kind: 'validate', value: 'refresh' });
    const search = processSource({ kind: 'catalogSearch', query: 'search', index: { text: 'Game', ends: new Uint32Array([4]) } });
    canceled.abort(); await removed;
    assert.deepEqual(started, ['active']); workers[0].complete(); await first; await tick();
    assert.deepEqual(started, ['active', 'search']); workers[0].complete(); await search; await tick();
    assert.deepEqual(started, ['active', 'search', 'refresh']); workers[0].complete(); await maintenance;
    const active = new AbortController();
    const canceledActive = assert.rejects(processSource({ kind: 'validate', value: 'cancel-active' }, active.signal), reason => reason === 0);
    await tick(); active.abort(0); await canceledActive;
    assert.equal(workers[0].terminated, true);
    const final = processSource({ kind: 'validate', value: 'replacement' }); await tick();
    assert.equal(workers.length, 2); workers[1].complete(); await final;
    await new Promise(resolve => setTimeout(resolve, 5100));
    assert.equal(workers[1].terminated, true);
  } finally { globalThis.Worker = original; }
});
