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

test("the line tracker keeps completed lines marked after moving backward", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(reader, /setReadThrough\(\(line\) => Math\.max\(line, current\)\)/);
  assert.match(reader, /index <= readThrough \? "reader-read"/);
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

test("the eBook reader has no mouse-driven tracker or setting", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  const state = await readFile("src/lib/ebook/reader-state.ts", "utf8");

  assert.doesNotMatch(reader, /mouseLineTrack|Mouse tracker/);
  assert.doesNotMatch(state, /mouseLineTrack/);
});

test("right-click opens the passage toolbar and bookmarks become the resume point", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");

  assert.match(reader, /onContextMenu=\{\(event\) => \{[\s\S]*?tracedLine\.current = index;[\s\S]*?persistReadingPosition\(index\);[\s\S]*?setSelection\(\{[\s\S]*?ranges: \[\{ line: index, start: 0, end: text\.length \}\]/);
  assert.match(reader, /label=\{t\("Passage bookmark"\)\}/);
  assert.match(reader, /onBookmark=\{\(\) => \{\s*addBookmark\(selection\.ranges\[0\]\?\.line \?\? current\)/);
  assert.match(reader, /label=\{t\("Listen from here"\)\}/);
  assert.match(reader, /onListenFrom=\{\(\) => \{[\s\S]*?void speakFrom\(line\)/);
  assert.match(reader, /const addBookmark = \(index = current\) => \{\s*persistReadingPosition\(index\)/);
  assert.match(reader, /window\.addEventListener\("pagehide", saveCurrentPassage\)/);
  assert.match(reader, /document\.visibilityState === "hidden"/);
  assert.match(reader, /return \(\) => \{\s*saveCurrentPassage\(\)/);
});

test("only bookmarks in the open chapter can continue narration", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");

  assert.match(reader, /bookmark\.chapterId === chapter\.id && \(\s*<button/);
  assert.match(reader, /aria-label=\{t\("Listen from here"\)\}/);
  assert.match(reader, /void speakFrom\(bookmark\.line\)/);
  assert.doesNotMatch(reader, /pendingBookmarkNarration/);
});

test("narration playback cycles through the supported speeds", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");

  assert.match(reader, /const playbackRates = \[1, 1\.5, 2, 3\] as const/);
  assert.match(reader, /player\.playbackRate = playbackRate/);
  assert.match(reader, /if \(audio\.current\) audio\.current\.playbackRate = next/);
  assert.match(reader, /\{playbackRate\}×/);
});

test("Edge TTS reuses one complete chapter track and seeks to the selected line", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(reader, /const windowEnd = paragraphs\.length/);
  assert.match(reader, /const chapterText = paragraphs\.join/);
  assert.match(reader, /const position = timeForParagraph\(duration, boundaries\)/);
  assert.match(reader, /player\.currentTime = start \+ position/);
  assert.match(reader, /boundaryWords\[cursor \+ offset\] === word/);
  assert.match(
    reader,
    /Math\.max\(0, boundary\.offsetMs \/ 1_000 - EDGE_BOUNDARY_LEAD_SECONDS\)/,
  );
  assert.doesNotMatch(reader, /NARRATION_BUDGETS|narrationWindowEnd|narrationAhead/);
});

test("Edge TTS merged chunk boundaries use the actual MP3 timeline", async () => {
  const native = await readFile("src-tauri/src/ebook_tts.rs", "utf8");
  const narration = await readFile("src/lib/ebook/narration.ts", "utf8");

  assert.match(native, /edge_mp3_duration_ticks\(chunk_audio\.len\(\)\)/);
  assert.doesNotMatch(native, /timeline_ticks\.saturating_add\(chunk_end\)/);
  assert.match(narration, /harbor-ebook-edge-narration-v2/);
});

test("reader prefers original audiobook audio unless translated text is displayed", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  const ebook = await readFile("src/views/ebook.tsx", "utf8");

  assert.match(reader, /originalAudio && !\(translation && !showOriginal\)/);
  assert.match(reader, /sourceEBookAudiobookStream/);
  assert.match(reader, /audio\.current\.currentTime = audioStart\.current \+ next/);
  assert.match(ebook, /audio\.chapter && current\.chapter/);
  assert.match(ebook, /chapters\?\.length === audioChapters\.length/);
  assert.match(ebook, /originalAudio=/);
});

test("original audiobook tracking weights passages by spoken words", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");

  assert.match(reader, /const timingLocale = originalAudio\?\.chapter\.language \?\? selectedVoice\.locale/);
  assert.match(reader, /Math\.max\(1, narrationWordCount\(text, timingLocale\)\)/);
  assert.doesNotMatch(reader, /spokenParagraphs\.map\(\(text\) => Math\.max\(1, text\.trim\(\)\.length\)\)/);
});

test("audiobooks can disable line tracking without disabling playback", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  const state = await readFile("src/lib/ebook/reader-state.ts", "utf8");

  assert.match(state, /audiobookLineTracker: true/);
  assert.match(reader, /audiobook=\{Boolean\(originalAudio\)\}/);
  assert.match(reader, /patch\(\{ audiobookLineTracker: event\.target\.checked \}\)/);
  assert.match(reader, /const usesOriginalAudiobook = Boolean\(originalAudio && !\(translation && !showOriginal\)\)/);
  assert.match(reader, /const lineTrackerEnabled = !usesOriginalAudiobook \|\| prefs\.audiobookLineTracker/);
  assert.match(reader, /if \(!lineTrackerEnabled\) return;[\s\S]*?root\.addEventListener\("wheel"/);
  assert.match(reader, /lineTrackerEnabled \? \(index === current/);
});

test("Edge TTS throttles playback UI renders without throttling line tracking", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  const update = reader.slice(reader.indexOf("player.ontimeupdate"), reader.indexOf("player.ontimeupdate") + 700);

  assert.match(update, /now - lastAudioUiUpdate\.current >= 500/);
  assert.doesNotMatch(update, /paragraphForTime/);
  assert.match(reader, /setInterval\(trackPlayback, 50\)/);
  assert.doesNotMatch(reader, /requestAnimationFrame\(trackPlayback\)/);
  assert.doesNotMatch(reader, /spokenWordEnds\.findIndex/);
  assert.match(reader, /position \+ \(boundaries\.length \? EDGE_BOUNDARY_LEAD_SECONDS : 0\)/);
  assert.match(reader, /player\.onpause = stopTracking/);
  assert.match(reader, /goTo\(line, true\)/);
  assert.match(reader, /if \(audioFollowScrolling\.current\)/);
  assert.doesNotMatch(reader, /audioFollowScrolling\.current = true;\s*setTrace\(null\)/);
});

test("rapid tracker scrolling defers storage and avoids stacked smooth scrolling", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  assert.match(reader, /setTimeout\(\(\) => \{\s*updateTrace\(\);\s*\}, 50\)/);
  assert.match(reader, /scheduleReadingPosition\(next\)/);
  assert.match(reader, /setTimeout\(\(\) => \{[\s\S]*?persistReadingPosition\(pendingProgress\.current\)[\s\S]*?\}, 180\)/);
  assert.match(reader, /scrollBy\(\{ top: offset, behavior: "auto" \}\)/);
});

test("the visible line tracker eases between passage geometry", async () => {
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");
  assert.match(
    reader,
    /transition-\[top,left,width,height\] duration-200 ease-out will-change-\[top,height\]/,
  );
});

test("the reader can return a displaced line tracker to the active audio line", async () => {
  const reader = await readFile(
    new URL("../src/views/ebook/harbor-reader.tsx", import.meta.url),
    "utf8",
  );
  assert.match(reader, /current !== narrationLine\.current/);
  assert.match(reader, /goTo\(narrationLine\.current\)/);
  assert.match(reader, /Return to the audio line/);
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

test("Book Mode uses lightweight encoded pages and eBook-only textures", async () => {
  const pages = await readFile("src/lib/ebook/book-pages.ts", "utf8");
  const reader = await readFile("src/views/ebook/harbor-reader.tsx", "utf8");

  assert.match(pages, /const WIDTH = 1050/);
  assert.match(pages, /"image\/jpeg", 0\.92/);
  assert.match(pages, /"v4"/);
  assert.match(reader, /textureSize=\{1024\}/);
  assert.match(reader, /pixelRatio=\{1\}/);
});

test("Book Mode cache hits do not rewrite every page blob", async () => {
  const cache = await readFile("src/lib/ebook/cache.ts", "utf8");
  assert.doesNotMatch(cache, /void write\(BOOK_PAGES, key, entry\)/);
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
