export type CachedEBookChapterContent = {
  text?: string;
  images?: string[];
};

export type CachedEBookTranslation = {
  title: string;
  text: string;
};

export type CachedEBookBookPages = {
  blobs: Blob[];
  paragraphStarts: number[];
};

const DB_NAME = "harbor-ebook-reader-cache";
const DB_VERSION = 1;
const CHAPTERS = "chapters";
const TRANSLATIONS = "translations";
const BOOK_PAGES = "book-pages";

const CHAPTER_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const CHAPTER_MAX_ENTRIES = 400;
const CHAPTER_MAX_BYTES = 64 * 1024 * 1024;
const CHAPTER_MAX_ENTRY_BYTES = 6 * 1024 * 1024;
const BOOK_PAGE_MAX_ENTRIES = 24;
const BOOK_PAGE_MAX_BYTES = 128 * 1024 * 1024;
const BOOK_PAGE_MAX_ENTRY_BYTES = 32 * 1024 * 1024;

type ChapterEntry = {
  key: string;
  content: CachedEBookChapterContent;
  fetchedAt: number;
  accessedAt: number;
  bytes: number;
};

type TranslationEntry = {
  key: string;
  value: CachedEBookTranslation;
  createdAt: number;
  accessedAt: number;
};

type BookPageEntry = CachedEBookBookPages & {
  key: string;
  createdAt: number;
  accessedAt: number;
  bytes: number;
};

let dbPromise: Promise<IDBDatabase | null> | null = null;
const chapterMemory = new Map<string, ChapterEntry>();
const translationMemory = new Map<string, CachedEBookTranslation>();
const pageMemory = new Map<string, BookPageEntry>();

function remember<T>(map: Map<string, T>, key: string, value: T, limit: number): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > limit) map.delete(map.keys().next().value!);
}

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      for (const store of [CHAPTERS, TRANSLATIONS, BOOK_PAGES])
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return dbPromise;
}

async function read<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    const request = db.transaction(store, "readonly").objectStore(store).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => resolve(undefined);
  });
}

async function write(store: string, key: string, value: unknown): Promise<boolean> {
  const db = await openDb();
  if (!db) return false;
  return new Promise((resolve) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
}

async function all<T>(store: string): Promise<T[]> {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const request = db.transaction(store, "readonly").objectStore(store).getAll();
    request.onsuccess = () => resolve((request.result ?? []) as T[]);
    request.onerror = () => resolve([]);
  });
}

async function drop(store: string, key: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const transaction = db.transaction(store, "readwrite");
    transaction.objectStore(store).delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
}

function chapterBytes(content: CachedEBookChapterContent): number {
  return (
    (content.text?.length ?? 0) * 2 +
    (content.images ?? []).reduce((total, image) => total + image.length * 2, 0)
  );
}

async function prune(
  store: string,
  maxEntries: number,
  maxBytes: number,
  memory: Map<string, unknown>,
): Promise<void> {
  const entries = await all<{ key: string; accessedAt: number; bytes: number }>(store);
  let bytes = entries.reduce((total, entry) => total + Math.max(0, entry.bytes || 0), 0);
  if (entries.length <= maxEntries && bytes <= maxBytes) return;
  entries.sort((left, right) => left.accessedAt - right.accessedAt);
  let count = entries.length;
  for (const entry of entries) {
    if (count <= maxEntries && bytes <= maxBytes) break;
    await drop(store, entry.key);
    memory.delete(entry.key);
    count--;
    bytes -= Math.max(0, entry.bytes || 0);
  }
}

export async function ebookChapterCacheGet(
  key: string,
): Promise<{ content: CachedEBookChapterContent; stale: boolean } | null> {
  const now = Date.now();
  let entry = chapterMemory.get(key);
  if (!entry) entry = await read<ChapterEntry>(CHAPTERS, key);
  if (!entry?.content || (!entry.content.text && !entry.content.images?.length)) return null;
  entry = { ...entry, accessedAt: now };
  remember(chapterMemory, key, entry, 24);
  void write(CHAPTERS, key, entry);
  return { content: entry.content, stale: now - entry.fetchedAt > CHAPTER_FRESH_MS };
}

export async function ebookChapterCachePut(
  key: string,
  content: CachedEBookChapterContent,
): Promise<void> {
  const bytes = chapterBytes(content);
  if ((!content.text && !content.images?.length) || bytes > CHAPTER_MAX_ENTRY_BYTES) return;
  const now = Date.now();
  const entry: ChapterEntry = { key, content, fetchedAt: now, accessedAt: now, bytes };
  remember(chapterMemory, key, entry, 24);
  if (await write(CHAPTERS, key, entry))
    void prune(CHAPTERS, CHAPTER_MAX_ENTRIES, CHAPTER_MAX_BYTES, chapterMemory);
}

export async function ebookTranslationCacheGet(
  key: string,
): Promise<CachedEBookTranslation | null> {
  const memory = translationMemory.get(key);
  if (memory) {
    remember(translationMemory, key, memory, 8);
    return memory;
  }
  const entry = await read<TranslationEntry>(TRANSLATIONS, key);
  if (!entry?.value?.text) return null;
  remember(translationMemory, key, entry.value, 8);
  void write(TRANSLATIONS, key, { ...entry, accessedAt: Date.now() });
  return entry.value;
}

export async function ebookTranslationCachePut(
  key: string,
  value: CachedEBookTranslation,
): Promise<boolean> {
  if (!value.text) return false;
  const existing = await ebookTranslationCacheGet(key);
  if (existing) return true;
  const now = Date.now();
  const entry: TranslationEntry = { key, value, createdAt: now, accessedAt: now };
  const stored = await write(TRANSLATIONS, key, entry);
  if (stored) remember(translationMemory, key, value, 8);
  return stored;
}

export async function ebookBookPageCacheGet(key: string): Promise<CachedEBookBookPages | null> {
  const now = Date.now();
  let entry = pageMemory.get(key);
  if (!entry) entry = await read<BookPageEntry>(BOOK_PAGES, key);
  if (!entry?.blobs?.length || entry.blobs.some((blob) => !(blob instanceof Blob))) return null;
  entry = { ...entry, accessedAt: now };
  remember(pageMemory, key, entry, 4);
  void write(BOOK_PAGES, key, entry);
  return { blobs: entry.blobs, paragraphStarts: entry.paragraphStarts };
}

export async function ebookBookPageCachePut(
  key: string,
  value: CachedEBookBookPages,
): Promise<void> {
  const bytes = value.blobs.reduce((total, blob) => total + blob.size, 0);
  if (!value.blobs.length || bytes > BOOK_PAGE_MAX_ENTRY_BYTES) return;
  const now = Date.now();
  const entry: BookPageEntry = { ...value, key, createdAt: now, accessedAt: now, bytes };
  remember(pageMemory, key, entry, 4);
  if (await write(BOOK_PAGES, key, entry))
    void prune(BOOK_PAGES, BOOK_PAGE_MAX_ENTRIES, BOOK_PAGE_MAX_BYTES, pageMemory);
}
