import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchVerifiedSource, sourceNeedsVerification, sourceVerificationAvailable, verifySource } from '../src/lib/games/source-verification.ts';

type Call = { command: string; args: Record<string, unknown> };
const calls: Call[] = [];
let handler: (command: string, args: Record<string, unknown>) => Promise<unknown> = async () => null;
Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
  invoke: (command: string, args: Record<string, unknown>) => { calls.push({ command, args }); return handler(command, args); },
} } });
const fresh = () => { calls.length = 0; return new AbortController(); };

test('verification is offered for challenged/retry states, never missing or legally restricted catalogs', () => {
  assert.equal(sourceVerificationAvailable(), true);
  for (const error of ['source_blocked', 'source_verify_failed', 'source_verify_timeout']) assert.equal(sourceNeedsVerification(`games.sources.${error}`), true);
  for (const error of ['source_missing', 'source_restricted', 'source_network']) assert.equal(sourceNeedsVerification(`games.sources.${error}`), false);
  assert.equal(sourceNeedsVerification(), false);
});

test('explicit verification binds its profile, source and request; abort cancels immediately and ignores late completion', async () => {
  const abort = fresh(); let finish!: () => void;
  handler = async command => command === 'games_source_verify' ? new Promise<void>(resolve => { finish = resolve; }) : undefined;
  const pending = verifySource('one', 'https://catalog.example/feed.json', abort.signal);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.profile, 'one');
  assert.equal(calls[0].args.url, 'https://catalog.example/feed.json');
  assert.match(String(calls[0].args.session), /^[a-f0-9-]{36}$/);
  abort.abort(); await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(calls[1], { command: 'games_source_verify_cancel', args: { profile: 'one', session: calls[0].args.session } });
  finish(); await Promise.resolve();
  assert.equal(calls.length, 2);
});

test('already canceled verification never opens a window and closing the native window is cancellation', async () => {
  const abort = fresh(); abort.abort();
  await assert.rejects(verifySource('one', 'https://catalog.example/feed', abort.signal), { name: 'AbortError' });
  assert.equal(calls.length, 0);
  handler = async () => { throw 'source_verify_canceled'; };
  await assert.rejects(verifySource('one', 'https://catalog.example/feed', new AbortController().signal), { name: 'AbortError' });
});

test('verified fetch returns bounded UTF-8 bytes and final URL without passing cookies through IPC', async () => {
  const abort = fresh();
  handler = async () => ({ status: 200, body: Buffer.from('{"name":"日本語"}').toString('base64'), headers: { 'content-type': 'application/json' }, url: 'https://catalog.example/feed' });
  const response = await fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, 100);
  assert.equal(await response?.text(), '{"name":"日本語"}');
  assert.equal(response?.headers.get('x-harbor-final-url'), 'https://catalog.example/feed');
  assert.deepEqual(calls[0].args, { profile: 'one', url: 'https://catalog.example/feed', maxBytes: 100 });
  await assert.rejects(fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, 4), /source_limit/);
});

test('no-profile/missing grants fall back without opening windows and canceled fetches cannot publish late bodies', async () => {
  const abort = fresh(); handler = async () => null;
  assert.equal(await fetchVerifiedSource(undefined, 'https://catalog.example/feed', abort.signal, 100), null);
  assert.equal(calls.length, 0);
  assert.equal(await fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, 100), null);
  let finish!: (value: unknown) => void;
  handler = () => new Promise(resolve => { finish = resolve; });
  const pending = fetchVerifiedSource('two', 'https://catalog.example/feed', abort.signal, 100);
  abort.abort(); await assert.rejects(pending, { name: 'AbortError' });
  finish({ status: 200, body: 'e30=', headers: {} }); await Promise.resolve();
  assert(calls.every(call => call.command === 'games_source_verified_fetch'));
});

test('large catalog decoding yields to cancellation and preserves bytes across base64 chunk boundaries', async () => {
  const abort = fresh(), bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 0xa7);
  const document = { status: 200, body: bytes.toString('base64'), headers: {} };
  handler = async () => document;
  const pending = fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, bytes.length);
  setTimeout(() => abort.abort(), 0);
  await assert.rejects(pending, { name: 'AbortError' });
  const response = await fetchVerifiedSource('one', 'https://catalog.example/feed', new AbortController().signal, bytes.length);
  assert.deepEqual(Buffer.from(await response!.arrayBuffer()), bytes);
});

test('older native builds retain normal fetching but explicit verification explains the restart requirement', async () => {
  const abort = fresh(); handler = async command => { throw `Command ${command} not found`; };
  assert.equal(await fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, 100), null);
  assert.equal(await fetchVerifiedSource('one', 'https://catalog.example/feed', abort.signal, 100), null);
  assert.equal(calls.length, 1);
  await assert.rejects(verifySource('one', 'https://catalog.example/feed', abort.signal), /source_verify_unavailable/);
});
