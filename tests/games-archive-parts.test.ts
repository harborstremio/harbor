import test from 'node:test';
import assert from 'node:assert/strict';
import { archivePartName, groupSetupArchives } from '../src/lib/games/archive-parts.ts';
import { archiveFolder, archiveError } from '../src/lib/games/archives.ts';
import type { SetupEntry } from '../src/lib/games/setup.ts';
const file = (path: string, kind: SetupEntry['kind'] = 'archive', bytes = 10): SetupEntry => ({ id: path, path, relativePath: path.split(/[\\/]/).at(-1)!, bytes, kind });

test('numbered RAR parts make one choice with ordered first file and combined size', () => {
  const entries = [file('D:/Downloads/Game.part10.rar', 'archive', 20), file('D:/Downloads/Game.part02.rar'), file('D:/Downloads/Game.part01.rar')];
  const group = groupSetupArchives(entries);
  assert.equal(group.length, 1); assert.equal(group[0].archiveParts, 3); assert.equal(group[0].bytes, 40);
  assert.equal(group[0].path, entries[2].path); assert.equal(group[0].id, entries[2].id);
  assert.equal(group[0].archiveName, 'Game'); assert.equal(entries[0].bytes, 20);
  assert.equal(archiveFolder(entries[0].path), 'Game');
});
test('legacy parts including later suffixes group from the original RAR', () => {
  const entries = ['Rain.s00', 'Rain.r01', 'Rain.rar', 'Rain.r00'].map(name => file('W:/Files/' + name));
  const [group] = groupSetupArchives(entries);
  assert.equal(group.archiveParts, 4); assert.equal(group.path, 'W:/Files/Rain.rar');
  assert.equal(archivePartName('Rain.s00')?.index, 101); assert.equal(archiveFolder('/games/Rain.r00'), 'Rain');
});
test('different folders, releases and modern/legacy schemes remain separate', () => {
  const entries = ['A/Game.part1.rar', 'B/Game.part1.rar', 'A/Game 2.part1.rar', 'A/Game.rar', 'A/Game.r00', 'A/Game.7z'].map(name => file('/downloads/' + name));
  const groups = groupSetupArchives(entries);
  assert.equal(groups.length, 5); assert.deepEqual(groups.map(g => g.archiveParts), [1, 1, 1, 2, 1]);
  assert.equal(groupSetupArchives([file('/A/Game.part1.rar'), file('/a/Game.part2.rar')]).length, 2, 'Unix folder case is significant');
  assert.equal(groupSetupArchives([file('D:/A/Game.part1.rar'), file('d:\\a\\Game.part2.rar')]).length, 1);
});
test('orphan and duplicate-number parts retain native review instead of claiming completeness', () => {
  const [orphan] = groupSetupArchives([file('/files/Game.part3.rar')]);
  assert.equal(orphan.path, '/files/Game.part3.rar'); assert.equal(orphan.archiveParts, 1);
  const [duplicate] = groupSetupArchives([file('/files/Game.part1.rar'), file('/files/Game.part01.rar')]);
  assert.equal(duplicate.archiveParts, 2); assert.equal(duplicate.bytes, 20);
  assert.equal(archiveError('archive_missing_part'), 'games.archive.archive_missing_part');
  assert.equal(archiveError('archive_parts'), 'games.archive.archive_parts');
});
test('games and installers are unchanged and unsupported split formats keep their names', () => {
  const entries = [file('/game/setup.exe', 'installer'), file('/game/Game.exe', 'game'), file('/game/Game.zip.1')];
  assert.deepEqual(groupSetupArchives(entries).map(({ archiveParts, ...entry }) => entry), entries);
  assert.equal(archiveFolder('/game/Game.zip.1'), 'Game.zip.1');
  assert.equal(archiveFolder('/game/雨.part002.rar'), '雨');
});

test('numbered ZIP groups remain separate from same-title 7z, RAR and ordinary ZIP archives', () => {
  const entries = ['Game.zip.002', 'Game.zip.001', 'Game.7z.001', 'Game.part01.rar', 'Game.zip'].map(name => file('/downloads/' + name));
  const groups = groupSetupArchives(entries);
  assert.equal(groups.length, 4); assert.equal(groups[0].archiveParts, 2); assert.equal(groups[0].bytes, 20);
  assert.equal(groups[0].path, '/downloads/Game.zip.001'); assert.equal(groups[0].archiveName, 'Game');
  assert.equal(archiveFolder('/downloads/雨.ZIP.010'), '雨');
  assert.equal(archivePartName('Game.zip.1000')?.index, 1000);
  const [orphan] = groupSetupArchives([file('/downloads/Game.zip.003')]);
  assert.equal(orphan.path, '/downloads/Game.zip.003'); assert.equal(orphan.archiveParts, 1);
  assert.equal(groupSetupArchives([file('/A/Game.zip.001'), file('/B/Game.zip.002')]).length, 2);
});

test('split 7z volumes make one ordered choice and preserve separate releases and formats', () => {
  const paths = ['Game.7z.010', 'Game.7z.002', 'Game.7z.001', 'Game.part1.rar', 'Other.7z.001', 'Game.7z'];
  const groups = groupSetupArchives(paths.map(name => file('/downloads/' + name)));
  assert.equal(groups.length, 4);
  assert.equal(groups[0].archiveParts, 3); assert.equal(groups[0].bytes, 30);
  assert.equal(groups[0].path, '/downloads/Game.7z.001'); assert.equal(groups[0].archiveName, 'Game');
  assert.equal(archiveFolder('/downloads/雨.7z.010'), '雨');
  assert.equal(archivePartName('Game.7Z.1000')?.index, 1000);
  assert.equal(archivePartName('Game.001'), undefined);
  assert.equal(archivePartName('Game.7z.1'), undefined);
  const [orphan] = groupSetupArchives([file('/downloads/Game.7z.003')]);
  assert.equal(orphan.archiveParts, 1); assert.equal(orphan.path, '/downloads/Game.7z.003');
  assert.equal(groupSetupArchives([file('/A/Game.7z.001'), file('/B/Game.7z.002')]).length, 2);
});
