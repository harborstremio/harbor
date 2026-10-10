import assert from 'node:assert/strict';
import test from 'node:test';
import { isWebsiteApiResource, sourceCandidate, sourceInputUrl } from '../src/lib/games/source-discovery.ts';

test('source input accepts website addresses, exact catalog URLs and the upstream Hydra install-source contract',()=>{
  assert.equal(sourceInputUrl('  example.org/catalog.json  '),'https://example.org/catalog.json');
  assert.equal(sourceInputUrl('example.org:8443/catalog.json'),'https://example.org:8443/catalog.json');
  assert.equal(sourceInputUrl('https://example.org/catalog.json?token=abc#fragment'),'https://example.org/catalog.json?token=abc');
  assert.equal(sourceInputUrl('hydralauncher://install-source?urls='+encodeURIComponent('https://example.org/feed?variant=a,b')),'https://example.org/feed?variant=a,b');
  assert.equal(sourceInputUrl('github.com/publisher/repo/blob/main/catalog.json'),'https://raw.githubusercontent.com/publisher/repo/main/catalog.json');
  assert.equal(sourceInputUrl('hydralauncher://install-source?urls='+encodeURIComponent('https://github.com/publisher/repo/blob/main/catalog.json')),'https://raw.githubusercontent.com/publisher/repo/main/catalog.json');
});

test('source input cannot reinterpret unrelated protocols, launcher actions, credentials or malformed inputs as a catalog',()=>{
  for(const value of ['', 'not a website', 'javascript:alert(1)', 'file:///C:/x', 'https://user:password@example.org', 'hydralauncher://run?urls=https://example.org', 'hydralauncher://install-source', 'hydralauncher://install-source/path?urls=https://example.org', 'hydralauncher://install-source?urls=https://a.org&urls=https://b.org', 'hydralauncher://install-source?urls=javascript:alert(1)', 'https://exa\nmple.org'])assert.equal(sourceInputUrl(value),undefined,value);
});

test('discovery follows only JSON or explicitly declared catalog links, resolves relative paths and preserves named provenance',()=>{
  assert.deepEqual(sourceCandidate('../feed/catalog.json','https://example.org/sources/index.html','  Example   catalog  '),{url:'https://example.org/feed/catalog.json',name:'Example catalog'});
  assert.equal(sourceCandidate('/download','https://example.org','Download'),undefined);
  assert.equal(sourceCandidate('/feed','https://example.org','Catalog',true)?.url,'https://example.org/feed');
  assert.equal(sourceCandidate('javascript:alert(1)','https://example.org','Catalog',true),undefined);
  assert.equal(sourceCandidate('//user:pass@example.org/catalog.json','https://example.org'),undefined);
  assert.equal(sourceCandidate('hydralauncher://install-source?urls=https%3A%2F%2Fcdn.example.org%2Ffeed','https://example.org')?.url,'https://cdn.example.org/feed');
  assert.equal(sourceCandidate('https://github.com/publisher/repo/blob/main/feed.json','https://example.org')?.url,'https://raw.githubusercontent.com/publisher/repo/main/feed.json');
});

test('website entity links belong to the exact published API root, including plain permalinks',()=>{
  assert.equal(isWebsiteApiResource('https://example.org/blog/wp-json/wp/v2/posts/42','https://example.org/blog/wp-json/'),true);
  assert.equal(isWebsiteApiResource('https://example.org/blog/wp-json/wp/v2/projects/7','https://example.org/blog/wp-json'),true);
  assert.equal(isWebsiteApiResource('https://example.org/?rest_route=%2Fwp%2Fv2%2Fpages%2F12','https://example.org/?rest_route=/'),true);
  for(const url of ['https://elsewhere.example/wp-json/wp/v2/posts/42','https://example.org/another/wp-json/wp/v2/posts/42','https://example.org/wp-json/harbor/catalog','https://example.org/catalog.json','broken'])assert.equal(isWebsiteApiResource(url,'https://example.org/wp-json/'),false,url);
  assert.equal(isWebsiteApiResource('https://example.org/blog/?rest_route=/wp/v2/posts/1','https://example.org/?rest_route=/'),false);
});
