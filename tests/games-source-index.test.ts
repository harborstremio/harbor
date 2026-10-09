import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSourceIndex, sourceIndexCandidates } from '../src/lib/games/source-index.ts';
import { sourceMatch, type SourceRelease } from '../src/lib/games/sources.ts';

const release = (title: string, extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: title, title, kind: 'game', files: [], ...extra });
test('compact indexed candidates preserve complete matcher semantics across title, IDs, platforms and editions', () => {
  const entries = [
    release('Sengoku Rance Free Download [Build-25565749]'), release('Sengoku Rance 2'),
    release('Sengoku Rance', { steamId: 42 }), release('Unrelated title', { igdbId: 42 }),
    release('Sengoku Rance', { steamId: 10, igdbId: 42 }), release('Sengoku Rance', { platform: 'linux' }),
    release('Pokémon™ v1.2 Repack'), release('Sengoku Rance Complete Edition'), release('Go'),
  ];
  const index = buildSourceIndex(entries);
  assert.equal(index.keys.byteLength + index.rows.byteLength, entries.length * 16);
  for (const game of [{ name: 'Sengoku Rance' }, { name: 'Sengoku Rance', steamId: 42 }, { name: 'Other', igdbId: 42, steamId: 43 }, { name: 'Pokémon' }, { name: 'Pokémon™ v1.2 Repack' }, { name: 'Go' }, { name: 'Sengoku Rance Complete Edition' }, { name: 'Unknown game' }]) {
    const expected = entries.filter(entry => sourceMatch(entry, game));
    const found = sourceIndexCandidates(index, game).map(row => entries[row]).filter(entry => sourceMatch(entry, game));
    assert.deepEqual(found, expected);
  }
});

test('the final entry of a150000-release catalog stays searchable without retaining a string index', () => {
  const entries = Array.from({ length: 150000 }, (_, index) => release('Project ' + index));
  entries[149999] = release('Deep Game v1.0');
  const index = buildSourceIndex(entries);
  assert.deepEqual(sourceIndexCandidates(index, { name: 'Deep Game' }), [149999]);
  assert.deepEqual(sourceIndexCandidates(buildSourceIndex([]), { name: 'Deep Game' }), []);
});
