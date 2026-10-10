import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchNativeSource } from '../src/lib/games/source-http.ts';
type Call = { command: string; args: Record<string, unknown> };
const calls: Call[] = [];
let handler: (command: string, args: Record<string, unknown>) => Promise<unknown> = async () => undefined;
Object.defineProperty(globalThis, 'window', { configurable: true, value: { __TAURI_INTERNALS__: {
  invoke: (command: string, args: Record<string, unknown>) => { calls.push({ command, args }); return handler(command, args); },
} } });
const fresh = () => { calls.length = 0; return new AbortController(); };
const document = { status: 200, body: Buffer.from('{"name":"日本語"}').toString('base64'), headers: { 'content-type': 'application/json' }, url: 'https://catalog.example/final.json' };

test('catalog requests bind native cancellation to exact profile and UUID; late replies stay discarded', async () => {
  const c = fresh(); let finish!: (value: unknown) => void;
  handler = async command => command === 'games_source_http_fetch' ? new Promise(resolve => { finish = resolve; }) : undefined;
  const pending = fetchNativeSource('one', 'https://catalog.example/feed', c.signal, 100);
  const start = calls[0]; assert.equal(start.command, 'games_source_http_fetch'); assert.equal(start.args.profile, 'one');
  assert.match(String(start.args.session), /^[a-f0-9-]{36}$/);
  c.abort(0); await assert.rejects(pending, reason => reason === 0);
  assert.deepEqual(calls[1], { command: 'games_source_http_cancel', args: { profile: 'one', session: start.args.session } });
  finish(document); await Promise.resolve(); assert.equal(calls.length, 2);
});

test('completed requests remove listeners; no-profile requests stay anonymous and return exact bytes', async () => {
  const c = fresh(); handler = async () => document;
  const response = await fetchNativeSource(undefined, 'https://catalog.example/feed', c.signal, 100);
  assert.equal(calls[0].args.profile, null); assert.equal(calls[0].args.maxBytes, 100);
  assert.equal(await response!.text(), '{"name":"日本語"}'); assert.equal(response!.headers.get('x-harbor-final-url'), document.url);
  c.abort(); assert.equal(calls.length, 1);
});

test('already canceled requests never invoke; failures do not silently use an unbounded fallback', async () => {
  const c = fresh(); c.abort(); await assert.rejects(fetchNativeSource('one', 'https://catalog.example/feed', c.signal, 100), { name: 'AbortError' });
  assert.equal(calls.length, 0);
  for (const error of ['source_network', 'source_limit']) {
    handler = async () => { throw error; };
    await assert.rejects(fetchNativeSource('one', 'https://catalog.example/feed', new AbortController().signal, 100), reason => reason === error);
  }
  handler = async () => { throw 'source_canceled'; };
  await assert.rejects(fetchNativeSource('one', 'https://catalog.example/feed', new AbortController().signal, 100), { name: 'AbortError' });
});

test('native response decode is bounded and cancellation during large decoding retains the same request identity', async () => {
  const c = fresh(); const bytes = Buffer.alloc(2 * 1024 * 1024 + 17, 0xa7);
  handler = async () => ({ ...document, body: bytes.toString('base64') });
  await assert.rejects(fetchNativeSource('one', 'https://catalog.example/feed', c.signal, 100), /source_limit/);
  const pending = fetchNativeSource('two', 'https://catalog.example/feed', c.signal, bytes.length);
  setTimeout(() => c.abort(), 0); await assert.rejects(pending, { name: 'AbortError' });
  const started = calls.filter(call => call.command === 'games_source_http_fetch').at(-1)!;
  assert.deepEqual(calls.at(-1), { command: 'games_source_http_cancel', args: { profile: 'two', session: started.args.session } });
});

test('only a missing new native command enables the legacy path', async () => {
  const c = fresh(); handler = async command => { throw `Command ${command} not found`; };
  assert.equal(await fetchNativeSource('one', 'https://catalog.example/feed', c.signal, 100), null);
  assert.equal(await fetchNativeSource('one', 'https://catalog.example/feed', c.signal, 100), null);
  assert.equal(calls.length, 1);
});
