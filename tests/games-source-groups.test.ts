import assert from 'node:assert/strict';
import test from 'node:test';
import { groupSourceMatches, type SourceMatch } from '../src/lib/games/source-groups.ts';
import type { GameSource } from '../src/lib/games/sources.ts';
const source: GameSource = { id: 'one', name: 'Publisher', url: 'https://source.example/catalog.json', format: 'community', enabled: true, checkedAt: 1, skipped: 0, entries: [] };
const hash = '1'.repeat(40);
const match = (id: string, tracker: string): SourceMatch => ({ source, match: 'title', release: { id, title: 'Project v1.0', kind: 'game', files: [{ name: 'Torrent', kind: 'magnet', url: `magnet:?xt=urn:btih:${hash}&tr=${encodeURIComponent(tracker)}` }] } });
test('same publisher and edition collapse exact payload duplicates while retaining tracker discovery', () => {
  const groups = groupSourceMatches([match('one', 'https://one.example/announce'), match('two', 'https://two.example/announce')]);
  assert.equal(groups.length, 1); assert.equal(groups[0].matches.length, 1);
  assert.equal(new URL(groups[0].matches[0].release.files[0].url).searchParams.getAll('tr').length, 2);
});
test('grouping preserves distinct publishers, editions, platforms and files with their original download context', () => {
  const base = match('one', 'https://one.example/announce');
  const others: SourceMatch[] = [
    { ...base, source: { ...source, id: 'two' } },
    { ...base, release: { ...base.release, id: 'v2', title: 'Project v2.0' } },
    { ...base, release: { ...base.release, id: 'linux', platform: 'linux' } },
    { ...base, release: { ...base.release, id: 'different', files: [{ name: 'Archive', kind: 'page', url: 'https://files.example/project.zip' }] } },
  ];
  const grouped = groupSourceMatches([base, ...others]);
  assert.deepEqual(grouped.map(group => [group.source.id, group.matches.length]), [['one', 4], ['two', 1]]);
  assert.equal(grouped[1].matches[0], others[0]);
});
