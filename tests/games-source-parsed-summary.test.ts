import assert from 'node:assert/strict';
import test from 'node:test';
import { freezeParsedEntries, parsedSourceSummary, rememberParsedSummary } from '../src/lib/games/source-parsed-summary.ts';
import { parseSourceText } from '../src/lib/games/sources.ts';
import { sourceEntryLayout } from '../src/lib/games/source-store-format.ts';
import { sourceRecentPreview } from '../src/lib/games/source-recent-preview.ts';

test('parsed snapshot authority cannot survive record edits or be inherited by copied arrays', () => {
  const { entries } = parseSourceText(JSON.stringify({ name: 'Original', downloads: [{ title: 'Original game', uris: ['https://files.example/game.zip'] }] }));
  const prepared = { layout: sourceEntryLayout(entries), recent: entries.map(sourceRecentPreview), recentAt: 1, recentUntil: Infinity };
  assert.throws(() => rememberParsedSummary(entries, prepared), /source_processing/);
  freezeParsedEntries(entries); rememberParsedSummary(entries, prepared);
  assert.equal(parsedSourceSummary(entries), prepared);
  assert.throws(() => { entries[0].files[0].url = 'https://files.example/changed.zip'; }, TypeError);
  assert.throws(() => { entries[0].title = 'Different game'; }, TypeError);
  assert.throws(() => { entries[0].files.push(entries[0].files[0]); }, TypeError);
  assert.throws(() => { entries.splice(0, 1); }, TypeError);
  assert.throws(() => { prepared.layout.bytes = 2; }, TypeError);
  const edited = entries.map(entry => ({ ...entry, title: 'Reviewed different game' }));
  assert.equal(parsedSourceSummary(edited), undefined);
  assert.equal(entries[0].title, 'Original game');
});
