import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { patchErrorKey } from '../src/lib/games/patching.ts';

test('ROM discovery, hack acquisition and patch errors resolve in every shipped catalog', async () => {
  const base = new URL('../src/', import.meta.url);
  const names = (await readdir(new URL('views/games/', base))).filter(name => /^(game-(?:rom|hack).*|game-patch)\.tsx$/.test(name));
  const keys = new Set<string>();
  for (const name of names) {
    const source = await readFile(new URL(`views/games/${name}`, base), 'utf8');
    for (const match of source.matchAll(/["'](games\.(?:hub|patch|roms|atlas)\.[\w.]+)["']/g)) keys.add(match[1]);
  }
  const patching = await readFile(new URL('lib/games/patching.ts', base), 'utf8');
  for (const match of patching.matchAll(/"(patch_[a-z_]+)"/g)) keys.add(patchErrorKey(match[1]));
  keys.add(patchErrorKey('unknown'));
  const english = (await import('../src/lib/i18n/locales/en.ts')).default as Record<string, string>;
  for (const lang of ['en', 'ar', 'de', 'es', 'fr', 'hi', 'id', 'it', 'ja', 'ko', 'pl', 'pt', 'ru', 'tr', 'vi', 'zh']) {
    const catalog = (await import(`../src/lib/i18n/locales/${lang}.ts`)).default as Record<string, string>;
    for (const key of keys) {
      assert.ok(catalog[key]?.trim() && catalog[key] !== key, `${lang}: missing ${key}`);
      assert.deepEqual(catalog[key].match(/\{\w+\}/g)?.sort() ?? [], english[key].match(/\{\w+\}/g)?.sort() ?? [], `${lang}: placeholders for ${key}`);
    }
  }
});
