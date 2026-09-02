import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const api = readFileSync(new URL("../src/lib/ebook/api.ts", import.meta.url), "utf8");
const providers = readFileSync(
  new URL("../src/lib/ebook/providers.ts", import.meta.url),
  "utf8",
);
const view = readFileSync(new URL("../src/views/ebook.tsx", import.meta.url), "utf8");

test("eBook metadata persists merged provider results and coalesces duplicate requests", () => {
  assert.match(api, /harbor\.ebook\.metadata\.v1/);
  assert.match(api, /const metadataInflight = new Map<string, Promise<EBook\[\]>>/);
  assert.match(api, /const jsonInflight = new Map<string, Promise<unknown>>/);
  assert.match(api, /metadataInflight\.get\(metadataRequestKey\(ebook\)\)/);
});

test("eBook metadata publishes provider results before every provider has settled", () => {
  assert.match(api, /fetchGoogleMetadata\(ebooks, publish\)/);
  assert.match(api, /fetchWikidataMetadata\(ebooks, publish\)/);
  assert.match(api, /await Promise\.allSettled\(\[google, wikidata\]\)/);
  assert.match(api, /onPartial\?\.\(cached\)/);
});

test("source browse enrichment does not block on a detail request per card", () => {
  const start = providers.indexOf("async function withMetadata(");
  const end = providers.indexOf("export async function listEBookProviders", start);
  const implementation = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.doesNotMatch(implementation, /sourceDetail\(/);
  assert.match(implementation, /Math\.min\(2, batches\.length\)/);
  assert.match(implementation, /fetchEBookMetadata\(batch, \(partial\)/);
});

test("local EPUB catalog entries expose their embedded cover before metadata merging", () => {
  const start = providers.indexOf("function localProvider(");
  const end = providers.indexOf("function pluginProvider(", start);
  const implementation = providers.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(implementation, /localPackage\(book\.paths\[0\]\)/);
  assert.match(implementation, /cover: epub\.cover/);
  assert.match(implementation, /internalCover: epub\.cover/);
});

test("eBook collections use the installed source catalog without reverse metadata searches", () => {
  assert.match(view, /buildSourceEBookCollections\(/);
  assert.match(
    view,
    /loadSourceEBookCatalogPage\(\s*providerId,\s*nextCursor,\s*browseTagRef\.current,\s*\)/,
  );
  assert.match(view, /searchSourceEBookCatalog\(title, providerId\)/);
  assert.doesNotMatch(view, /ebookCollections\(/);
  assert.doesNotMatch(view, /searchSourceEBooks\(book\.title/);
});

test("the Popular eBooks rail fetches metadata only when the source has no popular books", () => {
  assert.match(view, /const needsPopularMetadata =/);
  assert.match(view, /if \(!needsPopularMetadata\) return/);
  assert.match(view, /items: popularBooks/);
});
