import assert from 'node:assert/strict';
import test from 'node:test';
import { MessageChannel } from 'node:worker_threads';
import { matchingReleases, parseSourceManifest, parseSourceText, sourceMatch, SOURCE_SCHEMA, type GameSource } from '../src/lib/games/sources.ts';
import { sourceNeedsPlatformIdentity, sourcePlatformId } from '../src/lib/games/source-platform.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';
import { catalogInput, receiveCatalogTransfer, type CatalogReply } from '../src/lib/games/source-catalog-transfer.ts';

const item = { title: 'My classic game', uris: ['https://example.org/game.zip'], fileSize: '530 MB', uploadDate: '2026-06-15T08:00:00.000Z' };
const parse = (entry: Record<string, unknown>) => parseSourceManifest({ name: 'Classic collection', downloads: [{ ...item, ...entry }] });
const source = (platform: string): GameSource => ({ ...parse({ platform }), id: 'classic-source', url: 'https://example.org/classics.json', checkedAt: 1, enabled: true });

test('documented classic platform codes survive community JSON import and stored reload', () => {
  const platforms = ['ps1', 'ps2', 'ps3', 'psp', 'nes', 'snes', 'n64', 'gb', 'gbc', 'gba', 'gc', 'wii'];
  const manifest = parseSourceText(JSON.stringify({ name: 'Classic collection', downloads: platforms.map(platform => ({ ...item, title: `Classic game ${platform}`, platform })) }));
  assert.deepEqual(manifest.entries.map(entry => entry.platform), platforms);
  assert.equal(manifest.skipped, 0);
  const saved = { ...source('ps1'), ...manifest };
  const restored = validateSourceStore(JSON.parse(JSON.stringify([saved])))[0];
  assert.deepEqual(restored.entries, manifest.entries);
  assert.equal(restored.format, 'community');
  assert.ok(restored.entries.every(entry => entry.steamId === undefined && entry.igdbId === undefined));
});

test('existing nested platform precedence is unchanged and top-level support is limited to community format', () => {
  assert.equal(parse({ platform: 'ps1', game: { platform: 'ps2' } }).entries[0].platform, 'ps2');
  assert.equal(parse({ platform: 'ps1', game: { platform: ' ps1 ' } }).entries[0].platform, 'ps1');
  assert.equal(parse({ platform: 'ps1', game: { platform: '', steamId: 1, igdbId: 2 } }).entries[0].platform, 'ps1');
  assert.equal(parse({ platform: 'ps1', game: { steamId: 1, igdbId: 2 } }).entries[0].steamId, undefined);
  const harbor = (game?: object) => parseSourceManifest({ schema: SOURCE_SCHEMA, name: 'Harbor source', items: [{ id: 'classic', title: item.title, platform: 'ps1', game, files: [{ url: item.uris[0], kind: 'direct' }] }] }).entries[0];
  assert.equal(harbor().platform, undefined);
  assert.equal(harbor({ platform: 'ps2' }).platform, 'ps2');
});

test('platform metadata is bounded explicit text and never inferred from a game title', () => {
  for (const platform of [undefined, null, 123, {}, [], '', ' '.repeat(5), 'x'.repeat(101)]) {
    const result = parse({ platform, title: 'Game Boy Advance game' });
    assert.equal(result.entries[0].platform, undefined);
    assert.equal(result.entries.length, 1);
  }
  assert.equal(parse({ platform: '  Custom platform  ' }).entries[0].platform, 'Custom platform');
  assert.equal(parse({ platform: 'ps1\u0000' }).entries[0].platform, 'ps1 ');
  assert.equal(parse({ platform: 'ps1', game: { platform: 42 } }).entries[0].platform, 'ps1');
});

test('worker catalog transfer retains classic platform through validation and chunked output', async () => {
  const input = catalogInput(source('ps1')), { port1, port2 } = new MessageChannel();
  const entries: unknown[] = [];
  const complete = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { port1.close(); port2.close(); reject(Error('Catalog transfer did not finish')); }, 2000);
    port1.on('message', (reply: CatalogReply) => {
      if (reply.kind === 'input') { const part = input.next(); port1.postMessage(part ? { kind: 'input', entries: part } : { kind: 'validate' }); }
      else if (reply.kind === 'entries') { entries.push(...reply.entries); port1.postMessage({ kind: 'output' }); }
      else { clearTimeout(timer); port1.close(); port2.close(); if (reply.kind === 'error') reject(Error(reply.error)); else resolve(); }
    });
  });
  receiveCatalogTransfer({ kind: 'catalogTransfer', source: input.source, port: port2 as unknown as MessagePort });
  await complete;
  assert.deepEqual(entries, source('ps1').entries);
});

test('classic title matches require the actual console and never appear as compatible Steam PC releases', () => {
  const entry = source('ps1').entries[0];
  const pc = { id: 'steam:123', steamId: 123, name: entry.title, platforms: ['Windows'] };
  const consoleGame = { id: 'igdb:456', igdbId: 456, name: entry.title, platforms: ['PlayStation'] };
  assert.equal(sourceMatch(entry, pc), null);
  assert.equal(sourceMatch(entry, { ...pc, igdbId: 456, platforms: ['Windows', 'PlayStation'] }), null);
  assert.equal(sourceMatch(entry, { ...consoleGame, platforms: ['PlayStation 2'] }), null);
  assert.equal(sourceMatch(entry, { ...consoleGame, platforms: [] }), null);
  assert.equal(sourceMatch(entry, consoleGame), 'title');
  assert.equal(matchingReleases([source('ps1')], pc).length, 0);
  assert.equal(matchingReleases([source('ps1')], consoleGame).length, 1);
  assert.equal(sourceMatch({ ...entry, platform: undefined }, pc), 'title');
  assert.equal(sourceMatch({ ...entry, platform: 'Windows' }, pc), 'title');
  assert.equal(sourceMatch({ ...entry, platform: 'linux' }, { ...pc, platforms: ['Linux'] }), 'title');
  assert.equal(sourceMatch({ ...entry, platform: 'macOS' }, { ...pc, platforms: ['Mac'] }), 'title');
});

test('platform gates preserve explicit provider identity checks and never invent unknown platform mappings', () => {
  const entry = source('ps1').entries[0], pc = { name: entry.title, steamId: 123, igdbId: 456, platforms: ['Windows'] };
  assert.equal(sourceMatch({ ...entry, steamId: 123 }, pc), 'identity');
  assert.equal(sourceMatch({ ...entry, steamId: 999 }, pc), null);
  assert.equal(sourceMatch({ ...entry, steamId: 123, igdbId: 789 }, pc), null);
  const expected = { ps1: 7, ps2: 8, ps3: 9, psp: 38, nes: 18, snes: 19, n64: 4, gb: 33, gbc: 22, gba: 24, gc: 21, wii: 5 };
  for (const [platform, id] of Object.entries(expected)) { assert.equal(sourcePlatformId(platform), id); assert.equal(sourceNeedsPlatformIdentity(platform), true); }
  assert.equal(sourcePlatformId('Unknown system'), undefined);
  assert.equal(sourceMatch({ ...entry, platform: 'Unknown system' }, pc), null);
  assert.equal(sourceMatch({ ...entry, platform: 'Unknown system' }, { name: entry.title, igdbId: 456, platforms: ['PlayStation'] }), null);
  assert.equal(sourceMatch({ ...entry, platform: 'Unknown system' }, { name: entry.title, igdbId: 456, platforms: ['Unknown system'] }), 'title');
});
