import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import "./_indexeddb-stub.ts";

import {
  ebookBookPageCacheGet,
  ebookBookPageCachePut,
  ebookChapterCacheGet,
  ebookChapterCachePut,
  ebookTranslationCacheGet,
  ebookTranslationCachePut,
} from "../src/lib/ebook/cache.ts";

test("raw chapter cache returns content and freshness separately", async () => {
  const key = `chapter-${Date.now()}-${Math.random()}`;
  await ebookChapterCachePut(key, {
    text: "cached source chapter",
    images: ["https://img.test/1"],
  });

  const cached = await ebookChapterCacheGet(key);
  assert.deepEqual(cached?.content, {
    text: "cached source chapter",
    images: ["https://img.test/1"],
  });
  assert.equal(cached?.stale, false);
});

test("AI translations are immutable durable cache entries", async () => {
  const key = `translation-${Date.now()}-${Math.random()}`;
  const first = { title: "العنوان", text: "الترجمة المحفوظة" };
  await ebookTranslationCachePut(key, first);
  await ebookTranslationCachePut(key, { title: "replacement", text: "must not replace" });

  assert.deepEqual(await ebookTranslationCacheGet(key), first);
});

test("Book Mode page blobs survive reader remounts", async () => {
  const key = `pages-${Date.now()}-${Math.random()}`;
  const pages = {
    blobs: [new Blob(["page one"], { type: "image/png" }), new Blob(["page two"])],
    paragraphStarts: [0, 4],
  };
  await ebookBookPageCachePut(key, pages);

  const cached = await ebookBookPageCacheGet(key);
  assert.deepEqual(cached?.paragraphStarts, [0, 4]);
  assert.equal(await cached?.blobs[0].text(), "page one");
  assert.equal(await cached?.blobs[1].text(), "page two");
});

test("storage recovery never classifies AI translations as disposable", async () => {
  const source = await readFile(new URL("../src/lib/storage-recovery.ts", import.meta.url), "utf8");
  const prunable = source.slice(
    source.indexOf("const PRUNABLE_PREFIXES"),
    source.indexOf("function isPrunable"),
  );
  assert.doesNotMatch(prunable, /harbor\.ebook\.translation\.cache/);
});

test("opening a chapter never starts a fresh AI translation", async () => {
  const providers = await readFile(
    new URL("../src/lib/ebook/providers.ts", import.meta.url),
    "utf8",
  );
  const start = providers.indexOf("export async function sourceEBookContent");
  const end = providers.indexOf("export async function prefetchSourceEBookContent", start);
  const body = providers.slice(start, end);
  assert.match(body, /options: \{ waitForTranslation\?: boolean \} = \{\}/);
  assert.match(
    body,
    /if \(options\.waitForTranslation && shouldAutomaticallyTranslateEBookChapter\(\)\)/,
  );
  assert.doesNotMatch(body, /translationPending/);

  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  const translateStart = reader.indexOf("const translateChapter = async () =>");
  const translateEnd = reader.indexOf("const toggleTranslation =", translateStart);
  const translationControls = reader.slice(translateStart, translateEnd);
  assert.doesNotMatch(translationControls, /useEffect/);
  assert.equal(reader.match(/translateEBookChapter\(/g)?.length, 1);
});

test("Book Mode generation is cached and cancellable", async () => {
  const pages = await readFile(new URL("../src/lib/ebook/book-pages.ts", import.meta.url), "utf8");
  assert.match(pages, /ebookBookPageCacheGet/);
  assert.match(pages, /ebookBookPageCachePut/);
  assert.match(pages, /AbortSignal/);
  assert.match(pages, /AbortError/);
});

test("the line tracker marks every completed line with the tracker color", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(reader, /index < current \? "reader-read"/);
  assert.match(reader, /--reader-read-color/);
  assert.match(reader, /\.reader-read\{color:var\(--reader-read-color\)\}/);
});

test("narrator voices exist only in the reader controller, not Reading settings", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  const settingsStart = reader.indexOf("function Settings(");
  const settings = reader.slice(settingsStart);
  assert.doesNotMatch(settings, /narrationVoices/);
  assert.doesNotMatch(settings, /Narrator voice/);
  assert.match(reader.slice(0, settingsStart), /<VoicePicker/);
  assert.match(settings, /Setting label=\{t\("Saved audio"\)\}/);
});

test("Book Mode keeps the current pages visible while settings regenerate replacements", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  const effectStart = reader.indexOf('if (prefs.mode !== "book") return;');
  const effectEnd = reader.indexOf("useEffect(() => {", effectStart + 1);
  const generationEffect = reader.slice(effectStart, effectEnd);
  assert.doesNotMatch(generationEffect, /setFlipPages\(\{ urls: \[\], paragraphStarts: \[\] \}\)/);
  assert.match(generationEffect, /flipPagesRef\.current/);
  assert.match(generationEffect, /replaceFlipPages/);
  assert.match(reader, /const targetParagraph = active\.urls\.length/);
});

test("Book Mode double-buffers the WebGL book until replacement pages are ready", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  const bookView = await readFile(
    new URL("../src/views/manga/manga-reader/book-view.tsx", import.meta.url),
    "utf8",
  );

  assert.match(reader, /flipLayers\.map/);
  assert.match(reader, /activateFlipLayer/);
  assert.match(reader, /activeFlipLayerId/);
  assert.match(reader, /opacity-0/);
  assert.match(reader, /ebook-book-crossfade-in/);
  assert.match(reader, /ebook-book-crossfade-out/);
  assert.doesNotMatch(reader, /ebook-book-tear/);
  assert.match(bookView, /instanceName = NAME/);
  assert.match(bookView, /name: instanceName/);
  assert.match(bookView, /d\.name !== instanceName/);
});

test("returning from Book Mode remounts and restores the Harbor line tracker", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    reader,
    /if \(prefs\.mode !== "harbor"\) return;[\s\S]*traceY\.current = null;[\s\S]*updateTrace\(\)/,
  );
  assert.match(reader, /\[prefs\.mode, updateTrace\]/);
});
