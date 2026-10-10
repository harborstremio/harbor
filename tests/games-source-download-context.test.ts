import assert from 'node:assert/strict';
import test from 'node:test';
import { createSourceDownloadContext, sourceDownloadTitle, uniqueSourceDownloadGame } from '../src/lib/games/source-download-context.ts';
import type { SourceRelease } from '../src/lib/games/sources.ts';
import type { GameSummary } from '../src/lib/games/types.ts';

const release = (title = 'Nivalis Nights – v1.0.4 + 3 DLCs', extra: Partial<SourceRelease> = {}): SourceRelease => ({ id: 'release-1', title, kind: 'game', files: [], ...extra });
const game = (name = 'Nivalis Nights', steamId = 1488490): GameSummary => ({ id: `steam:${steamId}`, name, steamId, capsule: '', platforms: ['Windows'] });
const artwork = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1488490/library_hero.jpg?t=1773680448';
const detail = (candidate: GameSummary) => ({ ...candidate, artwork, logo: 'https://cdn.example/logo.png' });

test('packaging is removed without collapsing named editions, subtitles, sequels or DLC names', () => {
  assert.equal(sourceDownloadTitle('Nivalis Nights – v1.0.4 + 3 DLCs'), 'Nivalis Nights');
  assert.equal(sourceDownloadTitle('Nivalis Nights [FitGirl Repack]'), 'Nivalis Nights');
  assert.equal(sourceDownloadTitle('Nivalis Nights + 3 DLCs'), 'Nivalis Nights');
  for (const name of ['Nivalis Nights – Remastered', 'Nivalis Nights Deluxe Edition', 'Nivalis Nights 2', 'Nivalis Nights – The Final Chapter', 'Nivalis Nights Soundtrack']) {
    assert.equal(sourceDownloadTitle(`${name} – v1.4`), name);
    assert.equal(uniqueSourceDownloadGame(release(`${name} – v1.4`), [game()]), undefined);
    assert.equal(uniqueSourceDownloadGame(release(`${name} – v1.4`), [game(name)])?.name, name);
  }
});

test('title lookup accepts only one exact normalized identity and does not guess by broad sourceMatch', () => {
  assert.equal(uniqueSourceDownloadGame(release('NÍVALIS NIGHTS™ – v1.0'), [game()])?.id, game().id);
  assert.equal(uniqueSourceDownloadGame(release(), [game(), game('Nivalis Nights', 22)]), undefined);
  assert.equal(uniqueSourceDownloadGame(release(), [game(), { ...game(), steamId: undefined, igdbId: 33, id: 'igdb:33' }]), undefined);
  assert.equal(uniqueSourceDownloadGame(release(), [game(), { ...game(), igdbId: 33 }])?.id, game().id);
  assert.equal(uniqueSourceDownloadGame(release(), [{ ...game(), igdbId: 33 }, { ...game(), igdbId: 34 }]), undefined);
  assert.equal(uniqueSourceDownloadGame(release('Nivalis Nights', { kind: 'patch' }), [game()]), undefined);
});

test('explicit provider identities bypass title search, verify both IDs and never fall back on mismatch', async () => {
  let searches = 0;
  const resolver = createSourceDownloadContext({ search: async () => { searches++; return [game()]; }, detail: async candidate => detail({ ...candidate, name: 'Publisher renamed title' }) });
  const result = await resolver(release('Unrelated packaging title', { steamId: 1488490, igdbId: 33 }), 'Publisher');
  assert.equal(result?.id, 'steam:1488490'); assert.equal(result?.name, 'Publisher renamed title'); assert.equal(searches, 0);
  const mismatch = createSourceDownloadContext({ search: async () => { searches++; return [game()]; }, detail: async candidate => detail({ ...candidate, igdbId: 34 }) });
  assert.equal(await mismatch(release('Nivalis Nights', { steamId: 1488490, igdbId: 33 }), 'Publisher'), undefined);
  assert.equal(await resolver(release('Nivalis Nights', { steamId: -1 }), 'Publisher'), undefined);
  assert.equal(searches, 0);
});

test('exact detail context wins immediately; new catalog context retains safe art and separate source name', async () => {
  let calls = 0;
  const resolver = createSourceDownloadContext({ search: async title => { calls++; assert.equal(title, 'Nivalis Nights'); return [game()]; }, detail: async candidate => detail(candidate) });
  const supplied = { id: 'igdb:55', name: 'Known exact edition', artwork: 'https://cdn.example/known.jpg', sourceName: 'Known source' };
  assert.deepEqual(await resolver(release(), 'Other source', supplied), { ...supplied, logo: undefined, contentKind:'game' }); assert.equal(calls, 0);
  const result = await resolver(release(), 'FitGirl Repacks');
  assert.equal(result?.id, 'steam:1488490'); assert.equal(result?.artwork, artwork.split('?')[0]); assert.equal(result?.sourceName, 'FitGirl Repacks');
  assert.equal((await resolver(release(), 'Another source'))?.sourceName, 'Another source'); assert.equal(calls, 1);
});

test('an exact Steam candidate does not require incidental IGDB enrichment to open review', async () => {
  const resolver = createSourceDownloadContext({ search: async () => [{ ...game(), igdbId: 999 }], detail: async candidate => {
    assert.equal(candidate.steamId, 1488490);
    assert.equal(candidate.igdbId, undefined);
    return detail(candidate);
  } });
  assert.equal((await resolver(release(), 'Source'))?.id, 'steam:1488490');
});

test('ambiguous matches, unavailable providers, changed details and unsafe artwork fail without invented identity', async () => {
  for (const candidates of [[], [game(), game('Nivalis Nights', 123)]]) {
    const resolver = createSourceDownloadContext({ search: async () => candidates, detail: async () => { throw Error('Must not load ambiguous detail'); } });
    assert.equal(await resolver(release(), 'Source'), undefined);
  }
  const unavailable = createSourceDownloadContext({ search: async () => { throw Error('offline'); }, detail: async () => undefined });
  assert.equal(await unavailable(release(), 'Source'), undefined);
  const changed = createSourceDownloadContext({ search: async () => [game()], detail: async () => detail(game('Another title')) });
  assert.equal(await changed(release(), 'Source'), undefined);
  const unsafe = createSourceDownloadContext({ search: async () => [game()], detail: async candidate => ({ ...candidate, artwork: 'https://cdn.example/art?token=secret', logo: 'https://user:pass@cdn.example/logo.png' }) });
  const result = await unsafe(release(), 'Source');
  assert.equal(result?.id, game().id); assert.equal(result?.artwork, undefined); assert.equal(result?.logo, undefined);
});

test('expansion/action share the pending lookup, concurrency stays bounded and deadlines unblock downloads', async () => {
  let active = 0, peak = 0, calls = 0;
  const resolver = createSourceDownloadContext({ search: async title => {
    calls++; active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5)); active--; return [game(title)];
  }, detail: async candidate => detail(candidate) });
  await Promise.all([resolver(release(), 'One'), resolver(release(), 'Two'), ...Array.from({ length: 4 }, (_, index) => resolver(release(`Other Game ${index}`), 'Source'))]);
  assert.equal(calls, 5); assert.equal(peak, 2);
  let aborted = false;
  const slow = createSourceDownloadContext({ search: async (_title, signal) => new Promise(resolve => signal.addEventListener('abort', () => { aborted = true; resolve([]); }, { once: true })), detail: async () => undefined }, 15);
  const started = Date.now();
  assert.equal(await slow(release(), 'Source'), undefined);
  assert.equal(aborted, true); assert.ok(Date.now() - started < 500);
});

test('resolved identity cache is bounded instead of retaining every browsed release', async () => {
  let calls = 0;
  const resolver = createSourceDownloadContext({ search: async title => { calls++; return [game(title)]; }, detail: async candidate => detail(candidate) });
  for (let index = 0; index < 100; index++) await resolver(release(`Game ${index}`), 'Source');
  await resolver(release('Game 0'), 'Source');
  assert.equal(calls, 101);
});

test('console context uses matching IGDB identity and does not reuse a same-title PC cache or Steam port', async () => {
  let searches = 0;
  const consoleGame = { ...game(), igdbId: 33, platforms: ['PlayStation', 'Windows'] };
  const resolver = createSourceDownloadContext({ search: async (_title, _signal, platform) => {
    searches++; return platform === 'ps1' ? [consoleGame] : [game()];
  }, detail: async candidate => detail(candidate) });
  assert.equal((await resolver(release(), 'Source'))?.id, 'steam:1488490');
  assert.equal((await resolver(release(undefined, { platform: 'ps1' }), 'Source'))?.id, 'igdb:33');
  assert.equal(searches, 2, 'platform is part of the lookup cache key');
  assert.equal((await resolver(release(undefined, { platform: 'ps1' }), 'Source', { id: 'steam:1488490', name: 'Nivalis Nights' }))?.id, 'igdb:33', 'a conflicting supplied PC identity cannot override declared console context');
  const pcOnly = createSourceDownloadContext({ search: async () => [game()], detail: async () => { throw Error('PC detail must not be loaded for a console title match'); } });
  assert.equal(await pcOnly(release(undefined, { platform: 'ps1' }), 'Source'), undefined);
  const changed = createSourceDownloadContext({ search: async () => [consoleGame], detail: async candidate => detail({ ...candidate, platforms: ['Windows'] }) });
  assert.equal(await changed(release(undefined, { platform: 'ps1' }), 'Source'), undefined, 'detail revalidates platform evidence');
});

test('desktop and explicitly identified source actions retain their existing context behavior', async () => {
  let searches = 0;
  const resolver = createSourceDownloadContext({ search: async () => { searches++; return [game()]; }, detail: async candidate => detail(candidate) });
  assert.equal((await resolver(release(undefined, { platform: 'Windows' }), 'Source'))?.id, 'steam:1488490');
  const existing = { id: 'steam:1488490', name: 'Nivalis Nights' };
  assert.equal((await resolver(release(undefined, { platform: 'Windows' }), 'Source', existing))?.id, existing.id);
  assert.equal(searches, 1);
  assert.equal((await resolver(release(undefined, { platform: 'ps1', steamId: 1488490 }), 'Source'))?.id, 'steam:1488490', 'an explicit provider ID remains authoritative');
  assert.equal(searches, 1);
});
