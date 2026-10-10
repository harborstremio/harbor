import test from 'node:test';
import assert from 'node:assert/strict';
import { validSourceHttpHost } from '../src/lib/games/source-host.ts';
import { parseSourceText, sourceFileUrl, sourceUrl } from '../src/lib/games/sources.ts';
import { normalizeMagnet } from '../src/lib/games/magnet.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';

test('decoded HTTP domains reject forbidden host characters across permissive WebViews', () => {
  for (const value of ['', 'bad host.example', 'bad%20host.example', 'bad%2520host.example', 'bad%00host.example', 'bad%09host.example', 'bad%7fhost.example', 'bad%23host.example', 'bad%2fhost.example', 'bad%3ahost.example', 'bad%3chost.example', 'bad%3ehost.example', 'bad%3fhost.example', 'bad%40host.example', 'bad%5bhost.example', 'bad%5chost.example', 'bad%5dhost.example', 'bad%5ehost.example', 'bad%7chost.example', 'bad%zzhost.example', 'bad%ffhost.example']) assert.equal(validSourceHttpHost(value), false, value);
  for (const value of ['files.example', 'example.com.', 'localhost', '_service.example', 'xn--bcher-kva.example', '例え.example', '127.0.0.1', '[::1]', '[2001:db8::1234]']) assert.equal(validSourceHttpHost(value), true, value);
});

test('valid file paths, international domains, IPv6, ports and file keys are preserved', () => {
  for (const value of ['https://bücher.example/game.zip', 'https://%E4%BE%8B%E3%81%88.example/game', 'https://[2001:db8::1]:8443/game.zip', 'http://127.0.0.1:8080/game.zip', 'https://files.example/a%20b.zip?q=x%20y#key%2Fvalue', 'https://mega.nz/#!File!Key']) assert.equal(sourceFileUrl(value), new URL(value).href, value);
  for (const value of ['http://bad%20host.example/', 'https://bad%2520host.example/', 'https://bad%7chost.example/', 'https://bad%ffhost.example/']) assert.equal(sourceFileUrl(value), undefined, value);
  assert.equal(sourceUrl('https://files.example/catalog.json#section'), 'https://files.example/catalog.json');
});

test('a malformed mirror never hides a release with a usable file', () => {
  const bad = 'http://ghosts%20n%20goblins%20resurrection%20free%20download%20on%20steamgg.net/';
  const good = 'https://files.example/game.zip#key';
  const catalog = parseSourceText(JSON.stringify({ name: 'Catalog', downloads: [{ title: 'Game', uris: [bad, good] }, { title: 'Invalid only', uris: [bad] }] }));
  assert.equal(catalog.entries.length, 1); assert.equal(catalog.skipped, 1);
  assert.deepEqual(catalog.entries[0].files.map(file => file.url), [good]);
  const source = { ...catalog, id: 'catalog', url: 'https://catalog.example/feed', checkedAt: 1, enabled: true };
  source.entries[0].files.unshift({ name: 'Old invalid mirror', url: bad, kind: 'page' });
  assert.deepEqual(validateSourceStore([source])[0].entries[0].files.map(file => file.url), [good]);
});

test('invalid HTTP tracker hints are omitted without changing the torrent or valid hints', () => {
  const hash = 'a'.repeat(40), good = 'https://tracker.example/announce', udp = 'udp://tracker.example:6969/announce';
  const input = `magnet:?xt=urn:btih:${hash}&tr=${encodeURIComponent('https://bad%20host.example/announce')}&tr=${encodeURIComponent(good)}&tr=${encodeURIComponent(udp)}`;
  const normalized = normalizeMagnet(input)!;
  assert.equal(new URL(normalized).searchParams.get('xt'), `urn:btih:${hash}`);
  assert.deepEqual(new URL(normalized).searchParams.getAll('tr'), [good, udp]);
  assert.equal(normalizeMagnet(normalized), normalized);
});
