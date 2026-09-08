// @ts-expect-error Node test types are outside the browser tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are outside the browser tsconfig.
import test from "node:test";
import ar from "../src/lib/i18n/locales/ar.ts";
import contextActions from "../src/lib/i18n/locales/ar/context-actions.ts";
import fallback from "../src/lib/i18n/locales/context-actions-fallback.ts";
import { LANGUAGES } from "../src/lib/i18n/languages.ts";

const placeholders = (value: string) => (value.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) ?? []).sort();
test("context menu translations preserve placeholders and override the shared fallback", () => {
  assert.ok(Object.keys(contextActions).length >= 200);
  for (const [key, translated] of Object.entries(contextActions)) {
    assert.equal(fallback[key], key, `Missing shared fallback: ${key}`);
    assert.equal(ar[key], translated, `Arabic context layer must win: ${key}`);
    assert.notEqual(translated, key, `Untranslated Arabic key: ${key}`);
    assert.deepEqual(placeholders(translated), placeholders(key), key);
    assert.ok(translated.trim().length > 0, key);
  }
});

test("every language catalog includes just the new context fallback and preserves placeholders", async () => {
  for (const { code } of LANGUAGES) {
    const { default: catalog } = await import(`../src/lib/i18n/locales/${code}.ts`);
    for (const key of Object.keys(contextActions)) {
      assert.ok(catalog[key], `${code}: missing new context key ${key}`);
      assert.deepEqual(placeholders(catalog[key]), placeholders(key), `${code}: ${key}`);
    }
  }
});

test("context destinations, precise history scope, and bulk download confirmations are translated", () => {
  for (const key of [
    "Add to list or collection",
    "Move to",
    'Remove from "{name}"',
    "Clear Stremio watch history for this title…",
    "Cancel {count} downloads? Partial files are kept.\n\n{scope}",
    "Remove {count} downloads and delete their saved or partial files? Folders are kept.\n\n{details}",
    "The active profile changed. Open the menu again.",
    "Copy comment text",
    "Checking watched status…",
    "Watched status unavailable",
    "{watched} of {total} released episodes known watched",
    "Could not check watched status: {providers}",
    "Anime watched changes are not synced to this provider. Manage progress there.",
  ])
    assert.ok(contextActions[key], key);
});
