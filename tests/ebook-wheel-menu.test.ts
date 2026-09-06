import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const view = readFileSync(new URL("../src/views/ebook.tsx", import.meta.url), "utf8");
const wheel = readFileSync(
  new URL("../src/views/ebook/ebook-wheel-menu.tsx", import.meta.url),
  "utf8",
);
const exporter = readFileSync(
  new URL("../src/lib/ebook/offline-export.ts", import.meta.url),
  "utf8",
);
const api = readFileSync(new URL("../src/lib/ebook/api.ts", import.meta.url), "utf8");
const readerState = readFileSync(
  new URL("../src/lib/ebook/reader-state.ts", import.meta.url),
  "utf8",
);
const downloads = readFileSync(
  new URL("../src/views/downloads/download-row.tsx", import.meta.url),
  "utf8",
);
const providers = readFileSync(new URL("../src/lib/ebook/providers.ts", import.meta.url), "utf8");

test("eBook cards and the featured book open the dedicated wheel menu", () => {
  assert.match(view, /onContextMenu=\{\(event\) => openMenu\(ebook, event\)\}/);
  assert.match(view, /onContextMenu=\{\(event\) => current && openMenu\(current, event\)\}/);
  assert.match(view, /<EBookWheelMenu/);
});

test("eBook pages suppress the native context menu without removing wheel handlers", () => {
  assert.match(view, /document\.addEventListener\("contextmenu", preventNativeMenu, true\)/);
  assert.match(view, /closest\("\[data-ebook-page\]"\)/);
  assert.match(view, /data-ebook-page/);
  assert.match(view, /onContextMenu=\{\(event\) => openMenu\(ebook, event\)\}/);
});

test("duplicate books retain all readable sources and expose the details source picker", () => {
  assert.match(api, /export function eBooksMatch/);
  assert.match(api, /explicitSourceIdentityMatch\(left, right\)/);
  assert.match(api, /sourceAliases/);
  assert.match(api, /verifiedAliases/);
  assert.match(api, /crossLanguageAlias/);
  assert.match(api, /Script=Arabic/);
  assert.match(api, /mergedAlternativeTitles/);
  assert.match(api, /meta\.title/);
  assert.match(api, /authorListsMatch\(left\.authors, right\.authors\)/);
  assert.match(api, /export function dedupeEBooks/);
  assert.match(api, /books: ordered\.length > 1 \? ordered : undefined/);
  assert.match(api, /Script=Latin/);
  assert.match(view, /buttonLabel=\{t\("Source"\)\}/);
  assert.match(view, /setSourceRoute/);
  assert.match(view, /sourceEBookChapters\(sourceRoute\)/);
  assert.match(view, /searchSourceEBookCatalog\(query, "all"\)/);
  assert.match(providers, /crossScript/);
  assert.match(providers, /job\.provider\.search\(job\.query, 0\)/);
  assert.match(providers, /matchingCompanions/);
  assert.match(providers, /eBooksMatch\(item, candidate\)/);
});

test("the wheel exposes every requested eBook action", () => {
  for (const label of [
    "Start Reading",
    "Continue Reading",
    "Book Details",
    "Download",
    "Add to Shelf",
    "Bookmark",
    "Mark as Read",
  ])
    assert.match(wheel, new RegExp(label));
  assert.match(wheel, /ebook\.description/);
  assert.match(wheel, /detailBook\.genres\.slice/);
  assert.match(wheel, /sourceName\(ebook\)/);
});

test("book details resolve source metadata and chapter statistics without a loading loop", () => {
  assert.match(wheel, /sourceEBookDetail\(route\)[\s\S]*?\.then/);
  assert.match(wheel, /sourceEBookChapters\(route\)/);
  assert.match(wheel, /authors: detail\.authors\.length \? detail\.authors : ebook\.authors/);
  assert.match(view, /if \(current\.id !== detail\.id\) return \{ \.\.\.current, books \}/);
  assert.match(view, /currentItemsRef\.current\.get\(ebookId\)/);
  assert.match(view, /\}, \[ebookId, uiLanguage\]\);/);
  assert.doesNotMatch(view, /sourceCandidateKey/);
  assert.match(view, /\.\.\.sourceCandidatesRef\.current/);
  assert.doesNotMatch(wheel, /\[ebook, mode, stats, statsLoading\]/);
  assert.match(wheel, /if \(active\) setStatsLoading\(false\)/);
});

test("continue reading persists a profile-scoped chapter resume", () => {
  assert.match(readerState, /harbor\.ebook\.resume\.v1/);
  assert.match(view, /loadEBookResume\(profile, ebook\.id\)/);
  assert.match(view, /saveEBookResume\(profile, ebook\.id/);
  assert.match(view, /chapter\.id === resume\?\.chapterId/);
  assert.match(readerState, /previous\?\.chapterId === resume\.chapterId/);
  assert.match(readerState, /previous\?\.chapterId === resume\.chapterId \? previous : undefined/);
});

test("reopening the same chapter preserves persisted percentages", async () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { addEventListener() {}, dispatchEvent() {} },
  });
  const { loadEBookResume, saveEBookResume } = await import("../src/lib/ebook/reader-state.ts");
  saveEBookResume("profile", "book", {
    chapterId: "chapter-4",
    chapterTitle: "Chapter 4",
    chapterProgress: 63,
    bookProgress: 21,
    chapterIndex: 3,
    totalChapters: 20,
  });
  saveEBookResume("profile", "book", {
    chapterId: "chapter-4",
    chapterTitle: "Chapter 4",
  });
  assert.equal(loadEBookResume("profile", "book")?.chapterProgress, 63);
  assert.equal(loadEBookResume("profile", "book")?.bookProgress, 21);

  saveEBookResume("profile", "book", {
    chapterId: "chapter-5",
    chapterTitle: "Chapter 5",
  });
  assert.equal(loadEBookResume("profile", "book")?.chapterProgress, undefined);
});

test("offline export builds a valid EPUB and preserves a Unicode PDF print path", () => {
  assert.match(exporter, /application\/epub\+zip/);
  assert.match(exporter, /META-INF\/container\.xml/);
  assert.match(exporter, /EPUB\/package\.opf/);
  assert.match(exporter, /<meta charset="utf-8">/);
  assert.match(exporter, /windowRef\?\.print\(\)/);
  assert.match(exporter, /downloadedBytes/);
  assert.match(exporter, /estimatedTotalBytes/);
  assert.match(exporter, /bytesPerSecond/);
  assert.match(exporter, /etaSeconds/);
  assert.match(wheel, /enqueueEBookExport/);
  assert.match(wheel, /setView\("downloads"\)/);
  assert.match(downloads, /fmtSpeed\(d\.bytesPerSec\)/);
  assert.match(downloads, /fmtEta\(d\)/);
  assert.doesNotMatch(exporter, /waitForTranslation:\s*true/);
  assert.match(exporter, /phase: "discovering"/);
  assert.match(exporter, /zip\(files, \{ level: 6 \}/);
  assert.match(exporter, /batchSize = 12/);
  assert.match(exporter, /<dc:title>\$\{xml\(ebook\.title\)\}<\/dc:title>/);
  assert.match(exporter, /<dc:creator>/);
  assert.match(exporter, /<dc:description>/);
  assert.match(exporter, /properties="cover-image"/);
  assert.doesNotMatch(exporter, /Reading original EPUB/);
});

test("the eBook home replaces Universes with the live Shelf view", () => {
  assert.doesNotMatch(view, /EBookUniverses(?:Cta)?/);
  assert.match(view, /screen === "shelf"/);
  assert.match(view, /setScreen\("shelf"\)/);
  assert.match(view, /items=\{displaySaved\}/);
  assert.match(view, /Books you add to your shelf will appear here/);
  assert.match(view, /harbor:ebook-library/);
});

test("the home bookmark rail is distinct from the Shelf collection", () => {
  assert.match(view, /title: t\("Continue your bookmarks"\)/);
  assert.match(view, /resume: loadEBookResume\(activeId \?\? "default", ebook\.id\)/);
  assert.match(view, /items: continueBookmarks/);
  assert.match(view, /resumeReading: true/);
  assert.match(view, /if \(rail\.resumeReading\) setReadIntent\(ebook\.id\)/);
  assert.match(view, /harbor:ebook-resume/);
  assert.match(view, /items=\{displaySaved\}/);
  assert.match(view, /resumeProfile=\{activeId \?\? "default"\}/);
  assert.match(view, /hideZeroProgress/);
});

test("book showcases distinguish read and partially read titles", () => {
  assert.match(view, /tracking\.status === "COMPLETED"/);
  assert.match(view, /savedLine > 0/);
  assert.match(view, /status: "read" \| "partial"/);
  assert.match(view, /complete \? t\("Read"\) : t\("Reading"\)/);
  assert.match(view, /aria-label=\{complete \? t\("Read"\) : t\("Partially read"\)\}/);
  assert.match(view, /const readStatus = useEBookReadStatus\(ebook, profile\)/);
  assert.match(view, /ebook-details-book-cover/);
  assert.match(view, /ebook-details-book-spine/);
});

test("book details recommendations come from installed sources and share a genre", () => {
  assert.match(view, /loadSourceEBookPage\(undefined, "all"\)/);
  assert.match(view, /genreScore\(item\)/);
  assert.match(view, /filter\(\(\{ score \}\) => score > 0\)/);
  assert.match(view, /Same-genre picks from your installed sources/);
});
