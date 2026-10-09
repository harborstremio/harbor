import test from 'node:test';
import assert from 'node:assert/strict';
import { SETUP_STARTING_MS, setupProgress, setupRunStage } from '../src/lib/games/setup-progress.ts';
import { downloadSetupLabel, setupIsBusy } from '../src/lib/games/download-setup.ts';
import type { SetupJob } from '../src/lib/games/setup.ts';

const start = 100_000;
const job: SetupJob = { id: 'startup', profile: 'test', source: 'D:/Downloads/Game', installer: 'D:/Downloads/Game/setup.exe', destination: 'D:/Games/Game', engine: 'inno', startedAt: start, updatedAt: start, status: 'running', error: null, exitCode: null, activity: { bytes: 0, files: 0, truncated: false } };

test('launch and silent process samples never invent installation progress', () => {
  assert.equal(setupRunStage(job, start), 'starting');
  assert.equal(setupRunStage(job, start + SETUP_STARTING_MS), 'waiting');
  const silent = { ...job, progress: { observedAt: start + 60_000, percent: null, phase: null, currentFile: null, ioBytesPerSecond: 0, canReveal: false, canObserve: false } };
  assert.equal(setupRunStage(silent, start + 60_000), 'waiting');
  assert.equal(setupProgress(silent, start + 60_000)?.percent, undefined);
  assert.equal(downloadSetupLabel({ job: silent, phase: 'installing' }, start + 60_000), 'games.setup.state.waiting');
  assert.equal(setupIsBusy({ job: silent, phase: 'installing' }), true);
});

test('an available installer window ends startup but does not prove unpacking began', () => {
  const visible = { ...job, progress: { observedAt: start, canReveal: true } };
  assert.equal(setupRunStage(visible, start), 'waiting');
  assert.equal(setupProgress(visible, start)?.canReveal, true);
});

test('real installation signals and observed files establish installation; percentages can be zero', () => {
  for (const signal of [{ percent: 0 }, { percent: 30.7 }, { phase: 'Unpacking...' }, { currentFile: '28.fgpack' }, { elapsedSeconds: 1 }, { remainingSeconds: 10 }]) {
    const observed = { ...job, progress: { observedAt: start, ...signal } };
    assert.equal(setupRunStage(observed, start), 'installing');
    assert.equal(setupRunStage(observed, start + 20_000), 'installing');
    assert.equal(setupProgress(observed, start + 20_000), undefined);
  }
  assert.equal(setupRunStage({ ...job, activity: { bytes: 3, files: 1, truncated: false } }, start), 'installing');
});

test('invalid progress and process I/O alone do not masquerade as unpacking', () => {
  for (const input of [{ percent: 101 }, { percent: -1 }, { percent: NaN }, { phase: '\u0000  ' }, { elapsedSeconds: 0 }, { elapsedSeconds: -1 }, { remainingSeconds: Infinity }, { ioBytesPerSecond: 1024 }]) {
    assert.equal(setupRunStage({ ...job, progress: { observedAt: start, ...input } }, start + SETUP_STARTING_MS), 'waiting');
  }
  assert.equal(setupRunStage({ ...job, progress: { observedAt: start + 60_000, percent: 50 } }, start + SETUP_STARTING_MS), 'waiting');
});

test('checker history and terminal states are preserved when telemetry expires', () => {
  const checking = { ...job, progress: { observedAt: start, stage: 'checking' as const } };
  assert.equal(setupRunStage(checking, start + 20_000), 'checking');
  for (const status of ['finished', 'failed', 'interrupted', 'external'] as const) assert.equal(setupRunStage({ ...checking, status }, start), undefined);
  assert.equal(downloadSetupLabel({ job: { ...job, status: 'finished', exitCode: 0 }, phase: 'attention' }), 'games.setup.review');
});
