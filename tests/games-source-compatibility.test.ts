import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceCompatibility } from '../src/lib/games/source-compatibility.ts';
const file = (name: string, kind: 'direct' | 'page' = 'direct') => ({ name, kind, url: 'https://example.org/' + name });
test('package targets distinguish native, compatibility tools, and other operating systems', () => {
  assert.deepEqual(sourceCompatibility({}, file('game.exe'), 'linux'), { target: 'windows', status: 'compatibility' });
  assert.deepEqual(sourceCompatibility({}, file('game.exe'), 'macos'), { target: 'windows', status: 'other' });
  assert.deepEqual(sourceCompatibility({}, file('Game.AppImage'), 'linux'), { target: 'linux', status: 'native' });
  assert.deepEqual(sourceCompatibility({}, file('Game.dmg'), 'macos'), { target: 'macos', status: 'native' });
});
test('per-file evidence supports multi-platform releases; neutral archives remain unknown', () => {
  assert.deepEqual(sourceCompatibility({ platform: 'Windows' }, file('game-linux.tar.gz'), 'linux'), { target: 'linux', status: 'native' });
  for (const name of ['game.zip','game.tar.gz','windows-mac.zip','game.sh']) assert.equal(sourceCompatibility({}, file(name), 'macos').status, 'unknown');
});
test('metadata is evidence, browser and consoles do not imply desktop compatibility', () => {
  assert.deepEqual(sourceCompatibility({ platform: 'Mac OS X' }, file('game.zip'), 'macos'), { target: 'macos', status: 'native' });
  assert.deepEqual(sourceCompatibility({ platform: 'Linux' }, file('download','page'), 'web'), { target: 'linux', status: 'browse' });
  assert.equal(sourceCompatibility({ platform: 'SNES' }, file('game.zip'), 'windows').status, 'unknown');
});
test('generic host labels use the URL filename, not query parameters or page paths', () => {
  assert.equal(sourceCompatibility({}, {name:'example.org',kind:'direct',url:'https://example.org/game.dmg?platform=windows'}, 'macos').status, 'native');
  assert.equal(sourceCompatibility({}, {name:'Download',kind:'page',url:'https://example.org/windows'}, 'linux').status, 'unknown');
});

import { archiveFolder } from '../src/lib/games/archives.ts';
import { setupExecutable } from '../src/lib/games/setup.ts';
test('Unix archives and native applications keep the right destination and game identity', () => {
  for (const extension of ['tar.gz','tgz','tar','zip']) assert.equal(archiveFolder('/Downloads/Game.' + extension), 'Game');
  assert.equal(setupExecutable(['/Applications/Game.app','/Applications/Other.app'], 'Game'), '/Applications/Game.app');
  assert.equal(setupExecutable(['/games/Game.AppImage','/games/server.AppImage'], 'Game'), '/games/Game.AppImage');
});
