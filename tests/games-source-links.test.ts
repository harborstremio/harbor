import test from 'node:test';
import assert from 'node:assert/strict';
import { connectedSourceLinkProviders, sourceLinkError } from '../src/lib/games/source-links.ts';

test('source-link options include supported instant and job services while excluding empty connections', () => {
  assert.deepEqual(connectedSourceLinkProviders({rd:' key ',pm:'second',tb:'third'}),['rd','tb','pm']);
  assert.deepEqual(connectedSourceLinkProviders({rd:' ',tb:'key'}),['tb']);
  assert.deepEqual(connectedSourceLinkProviders({pm:'key'}),['pm']);
  assert.deepEqual(connectedSourceLinkProviders({ad:'key'}),['ad']);
  assert.deepEqual(connectedSourceLinkProviders({rd:'first',ad:'second'}),['rd','ad']);
});

test('source-link errors remain actionable without revealing provider payloads or keys', () => {
  for(const [code,key] of [['cloud_key','account'],['cloud_rate_limit','rate'],['cloud_limit','limit'],['cloud_missing','empty'],['cloud_link','invalid'],['cloud_metadata','invalid']]) assert.equal(sourceLinkError(new Error(code)),`games.sources.links.${key}`);
  assert.equal(sourceLinkError('secret-key:provider-payload'),'games.sources.links.failed');
  assert.equal(sourceLinkError({url:'https://private.invalid/?token=secret'}),'games.sources.links.failed');
});
