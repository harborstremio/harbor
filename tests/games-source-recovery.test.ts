import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingReleasesAsync } from '../src/lib/games/source-matches.ts';
import { recentSourceReleasesAsync } from '../src/lib/games/recent-sources.ts';
import { checkSourceAlerts } from '../src/lib/games/source-alert-check.ts';
import { browseSourceCatalog } from '../src/lib/games/source-catalog-query.ts';
import { sameSourceRevision, replaceGameSource } from '../src/lib/games/source-subscriptions.ts';
import type { GameSource } from '../src/lib/games/sources.ts';

const now = Date.parse('2026-10-03T12:00:00Z');
const game = { id: 'recovery', name: 'Recovery Project', capsule: '', platforms: [] };
const source = (id: string): GameSource => ({ id, name: id, url: `https://example.org/${id}.json`, format: 'harbor', checkedAt: now, enabled: true, skipped: 0,
  entries: [{ id: 'release', title: game.name, kind: 'game', date: '2026-10-02', files: [{ kind: 'direct', name: 'Game', url: 'https://example.org/game.zip' }] }],
});
const unavailable = (): GameSource => ({ ...source('unavailable'), entries: [], catalogIssue: { profile: 'test', version: 'known-version', parts: 1, error: 'games.sources.source_storage' } });
const signal = () => new AbortController().signal;

test('partial matching reports failed identities and preserves healthy matches on both sides', async () => {
  const failed: string[] = [], sources = [source('first'), unavailable(), source('last')];
  const result = await matchingReleasesAsync(sources, game, signal(), item => failed.push(item.id));
  assert.deepEqual(result.map(item => item.source.id), ['first', 'last']);
  assert.deepEqual(failed, ['unavailable']);
  await assert.rejects(matchingReleasesAsync(sources, game, signal()), /source_storage/);
});

test('disabled unreadable sources do not report failures or prevent healthy recent releases', async () => {
  const failed: string[] = [], bad = unavailable();
  const result = await recentSourceReleasesAsync([bad, source('healthy')], signal(), now, item => failed.push(item.id));
  assert.equal(result.length, 1);
  assert.equal(result[0].source.id, 'healthy');
  assert.deepEqual(failed, ['unavailable']);
  await assert.rejects(recentSourceReleasesAsync([bad], signal(), now), /source_storage/);
  assert.equal((await matchingReleasesAsync([{ ...bad, enabled: false }, source('healthy')], game, signal())).length, 1);
  assert.equal((await recentSourceReleasesAsync([{ ...bad, enabled: false }, source('healthy')], signal(), now)).length, 1);
});

test('unavailable catalog browsing is an error, never an empty successful result', async () => {
  await assert.rejects(browseSourceCatalog(unavailable(), '', 30, signal()), /source_storage/);
  assert.equal((await browseSourceCatalog(source('healthy'), '', 30, signal())).total, 1);
});

test('recovery revisions survive settings rereads while still rejecting changed payloads and profiles', () => {
  const reviewed = unavailable(), current = { ...unavailable(), enabled: false };
  assert.equal(sameSourceRevision(current, reviewed), true);
  assert.equal(replaceGameSource([current], reviewed, reviewed.url, source('refreshed'))[0].enabled, false);
  for (const issue of [{ ...current.catalogIssue!, profile: 'other' }, { ...current.catalogIssue!, version: 'new-version' }, { ...current.catalogIssue!, parts: 2 }]) {
    assert.equal(sameSourceRevision({ ...current, catalogIssue: issue }, reviewed), false);
  }
  assert.equal(sameSourceRevision({ ...current, checkedAt: now + 1 }, reviewed), false);
  assert.equal(sameSourceRevision({ ...current, catalogIssue: undefined }, reviewed), false);
});

test('partial-result callbacks do not swallow cancellation', async () => {
  const abort = new AbortController(); abort.abort();
  const failed = () => assert.fail('Canceled work must not be reported as an unavailable source');
  await assert.rejects(matchingReleasesAsync([unavailable(), source('healthy')], game, abort.signal, failed), { name: 'AbortError' });
  await assert.rejects(recentSourceReleasesAsync([unavailable()], abort.signal, now, failed), { name: 'AbortError' });
});

test('alerts find healthy releases and retain incomplete status for unresolved watches', async () => {
  const found: string[] = [];
  const result = await checkSourceAlerts([{ id: 'found', game, addedAt: now }, { id: 'pending', game: { ...game, id: 'missing', name: 'Missing game' }, addedAt: now }], [unavailable(), source('healthy')], {
    catalog: async () => { throw Error('Fresh local records must not fetch'); },
    website: async () => { throw Error('No website source configured'); }, yield: async () => {},
  }, signal(), async watch => { found.push(watch.id); }, new Map(), now);
  assert.deepEqual(found, ['found']);
  assert.deepEqual(result, { pending: ['pending'], failed: true });
});
