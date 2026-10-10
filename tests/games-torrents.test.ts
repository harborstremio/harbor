import assert from 'node:assert/strict';
import test from 'node:test';
import { torrentSelection, torrentSpace, torrentFolder, type TorrentPlan } from '../src/lib/games/torrents.ts';
const plan: TorrentPlan = { token: 'fixture', name: 'files', infoHash: 'a'.repeat(40), pieceLength: 32768, totalBytes: 200001, private: false, files: [100000, 1, 100000].map((bytes, index) => ({ index, bytes, path: `file-${index}` })) };
test('space forecast includes the real extent of adjacent shared pieces, not just selected bytes', () => {
  const selected = new Set([1]);
  assert.equal(torrentSelection(plan, selected), 1);
  assert.equal(torrentSpace(plan, selected), 131072);
  assert.equal(torrentSpace(plan, new Set([0,1,2])), 200001);
  assert.equal(torrentSpace(plan, new Set()), 0);
  assert.equal(torrentSpace({ ...plan, files: plan.files.map(file => ({ ...file, padding: file.index === 0 })) }, selected), 31072);
});
test('suggested folder preserves readable Unicode while removing path syntax and reserved device names', () => {
  assert.equal(torrentFolder('Night garden 雨'), 'Night garden 雨');
  assert.equal(torrentFolder('../outside'), '.._outside');
  assert.equal(torrentFolder('CON.txt'), 'Game files');
  assert.equal(torrentFolder('.harbor-torrent'), 'Game files');
});
