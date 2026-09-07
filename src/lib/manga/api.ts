import { setItemWithRecovery } from "@/lib/storage-recovery";
import {
  activeMangaProvider,
  activeMangaSource,
  activeMangaSourceId,
  aggregateSubProviders,
  ensureMangaSources,
} from "./sources";
import {
  routeById,
  streamAll,
  streamAggregateChapters,
} from "./sources/aggregate";
import { suwayomiSourcesRevision } from "./sources/suwayomi/source-events";
import { mangaLibraryRevision } from "./library-events";
import { loadMangaLangFilter, mangaLangFilterRevision } from "./lang-filter";
import type { MangaChapter, MangaProvider, MangaSummary } from "./types";

export {
  MANGA_PAGE,
  chapterLanguages,
  languageName,
  languageFlag,
  type MangaSummary,
  type MangaChapter,
  type MangaTag,
} from "./model";

type Entry = { at: number; p: Promise<unknown> };
type DiskRecord<T> = { at: number; data: T };
type DiskOpts = { key: string; fresh: number; stale: number };
type CallOpts = { disk?: DiskOpts; timeout?: number; tries?: number };

const cache = new Map<string, Entry>();

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const CALL_TIMEOUT = 12_000;
const PAGES_TIMEOUT = 25_000;
const TRIES = 2;

const DISK_PREFIX = "harbor.manga.cache.v2.";
const DISK_MAX_AGE = 7 * DAY;
const POPULAR_DISK = { fresh: 30 * MIN, stale: 6 * HOUR };

function isEmpty(data: unknown): boolean {
  return data == null || (Array.isArray(data) && data.length === 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Manga source timed out")), ms);
    p.then(
      (v) => {
        window.clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function attempt<T>(run: () => Promise<T>, tries: number, ms: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await sleep(350 * 2 ** (i - 1));
    try {
      return await withTimeout(run(), ms);
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Manga source failed");
}

function diskRead<T>(key: string): DiskRecord<T> | null {
  try {
    const raw = localStorage.getItem(DISK_PREFIX + key);
    if (!raw) return null;
    const rec = JSON.parse(raw) as DiskRecord<T>;
    if (!rec || typeof rec.at !== "number" || isEmpty(rec.data)) return null;
    if (Date.now() - rec.at > DISK_MAX_AGE) return null;
    return rec;
  } catch {
    return null;
  }
}

function diskWrite<T>(key: string, data: T): void {
  if (isEmpty(data)) return;
  try {
    setItemWithRecovery(DISK_PREFIX + key, JSON.stringify({ at: Date.now(), data }));
  } catch {
    return;
  }
}

function settle<T>(key: string, data: T): void {
  cache.set(key, { at: Date.now(), p: Promise.resolve(data) });
}

function remember<T>(key: string, p: Promise<T>, disk: string): Promise<T> {
  const entry: Entry = { at: Date.now(), p };
  cache.set(key, entry);
  p.then(
    (data) => {
      if (isEmpty(data)) {
        if (cache.get(key) === entry) cache.delete(key);
        return;
      }
      if (disk) diskWrite(disk, data);
    },
    () => {
      if (cache.get(key) === entry) cache.delete(key);
    },
  );
  return p;
}

async function cached<T>(
  kind: string,
  parts: string,
  ttl: number,
  run: (p: MangaProvider) => Promise<T>,
  opts: CallOpts = {},
): Promise<T> {
  await ensureMangaSources();
  const sid = activeMangaSourceId();
  const key = `${sid}|${kind}|${parts}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.p as Promise<T>;

  const call = () =>
    attempt(() => run(activeMangaProvider()), opts.tries ?? TRIES, opts.timeout ?? CALL_TIMEOUT);

  if (!opts.disk) return remember(key, call(), "");

  const disk = `${sid}|${opts.disk.key}`;
  const rec = diskRead<T>(disk);
  const age = rec ? Date.now() - rec.at : Number.POSITIVE_INFINITY;

  if (rec && age < opts.disk.fresh) {
    settle(key, rec.data);
    return rec.data;
  }

  if (rec && age < opts.disk.stale) {
    settle(key, rec.data);
    void call().then(
      (data) => {
        if (isEmpty(data)) return;
        diskWrite(disk, data);
        settle(key, data);
      },
      () => {},
    );
    return rec.data;
  }

  try {
    return await remember(key, call(), disk);
  } catch (e) {
    if (!rec) throw e;
    settle(key, rec.data);
    return rec.data;
  }
}

export function clearMangaCache(): void {
  cache.clear();
  try {
    const stale: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(DISK_PREFIX)) stale.push(k);
    }
    for (const k of stale) localStorage.removeItem(k);
  } catch {
    return;
  }
}

export function popularManga(offset = 0, tagId?: string) {
  const tag = tagId ?? "";
  // Extension installs/updates/uninstalls change the sources behind the merged
  // popular feed, so include the source revision in the key (same pattern as
  // searchMangaEverywhere) to invalidate both the in-memory and disk caches.
  const revision = suwayomiSourcesRevision();
  return cached("pop2", `${revision}|${offset}|${tag}`, 5 * MIN, (p) => p.popular(offset, tagId), {
    tries: 3,
    timeout: 10_000,
    disk: offset === 0 ? { key: `pop2|${revision}|${tag}`, ...POPULAR_DISK } : undefined,
  });
}

export function searchManga(query: string, offset = 0, tagId?: string) {
  return cached("search", `${query}|${offset}|${tagId ?? ""}`, 5 * MIN, (p) =>
    p.search(query, offset, tagId),
  );
}

export function searchMangaEverywhere(query: string) {
  const revision = suwayomiSourcesRevision();
  return cached(
    "searchAll",
    `${revision}|${query}`,
    5 * MIN,
    (p) => p.searchAll?.(query) ?? p.search(query, 0),
    {
      tries: 1,
      timeout: 30_000,
    },
  );
}

/** Search every configured source and return IDs routed back to the source that owns them. */
export async function searchMangaAcrossSources(query: string): Promise<MangaSummary[]> {
  await ensureMangaSources();
  return streamAll(
    (provider) => provider.searchAll?.(query) ?? provider.search(query, 0),
    () => {},
  );
}

type Chunk = (items: MangaSummary[]) => void;

async function streamOrCall(
  kind: string,
  parts: string,
  ttl: number,
  run: (p: MangaProvider) => Promise<MangaSummary[]>,
  opts: CallOpts,
  onChunk: Chunk,
): Promise<MangaSummary[]> {
  await ensureMangaSources();
  const sid = activeMangaSourceId();
  if (sid !== "all") {
    const data = (await cached(kind, parts, ttl, run, opts)) as MangaSummary[];
    onChunk(data);
    return data;
  }

  const key = `${sid}|${kind}|${parts}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) {
    const data = (await hit.p) as MangaSummary[];
    onChunk(data);
    return data;
  }

  const disk = opts.disk ? `${sid}|${opts.disk.key}` : "";
  if (disk && opts.disk) {
    const rec = diskRead<MangaSummary[]>(disk);
    const age = rec ? Date.now() - rec.at : Number.POSITIVE_INFINITY;
    if (rec && age < opts.disk.fresh) {
      settle(key, rec.data);
      onChunk(rec.data);
      return rec.data;
    }
    if (rec && age < opts.disk.stale) {
      settle(key, rec.data);
      onChunk(rec.data);
      void streamAll(run, () => {}).then((m) => {
        if (!m.length) return;
        settle(key, m);
        diskWrite(disk, m);
      });
      return rec.data;
    }
  }

  const merged = await streamAll(run, onChunk);
  if (merged.length) {
    settle(key, merged);
    if (disk) diskWrite(disk, merged);
  }
  return merged;
}

export function popularMangaStream(offset: number, tagId: string | undefined, onChunk: Chunk) {
  const tag = tagId ?? "";
  return streamOrCall(
    "pop2",
    `${offset}|${tag}`,
    5 * MIN,
    (p) => p.popular(offset, tagId),
    {
      tries: 3,
      timeout: 10_000,
      disk: offset === 0 ? { key: `pop2|${tag}`, ...POPULAR_DISK } : undefined,
    },
    onChunk,
  );
}

export function searchMangaStream(
  query: string,
  offset: number,
  tagId: string | undefined,
  onChunk: Chunk,
) {
  return streamOrCall(
    "search",
    `${query}|${offset}|${tagId ?? ""}`,
    5 * MIN,
    (p) => p.search(query, offset, tagId),
    {},
    onChunk,
  );
}

export function mangaDetail(id: string) {
  return cached(
    "detail",
    id,
    20 * MIN,
    (provider) => {
      const routed = routeById(id);
      return routed ? routed.provider.detail(routed.orig) : provider.detail(id);
    },
    { timeout: 15_000 },
  );
}

export function mangaChapters(id: string, opts?: { tries?: number; timeout?: number }) {
  return cached(
    "chapters",
    id,
    20 * MIN,
    (provider) => {
      const routed = routeById(id);
      return routed ? routed.provider.chapters(routed.orig) : provider.chapters(id);
    },
    { timeout: 15_000, ...opts },
  );
}

export function resumeChapters(id: string): Promise<MangaChapter[]> {
  // With a single configured source the details page streams raw provider
  // chapter ids (no provider prefix) and the progress record's chapterId is a
  // verbatim copy from that list, so the resume lookup must use the same id
  // namespace. mangaChapters shares that list's cache entry, so a resume
  // after a details visit is served from memory and the exact copy id hits.
  // With several sources the aggregate view labels every copy with its
  // provider id, own copies through the active provider (see streamChapters),
  // so resume must search the same prefixed namespace.
  if (aggregateSubProviders().length > 1) {
    return cached(
      "chapters.own",
      id,
      20 * MIN,
      async () => {
        const all: MangaChapter[] = [];
        await streamAggregateChapters(id, (chunk) => all.push(...chunk), activeMangaProvider().id);
        return all;
      },
      {
        tries: 1,
        timeout: 9_000,
      },
    );
  }
  return mangaChapters(id, { tries: 1, timeout: 9_000 });
}

export async function streamChapters(
  id: string,
  onChunk: (chs: MangaChapter[]) => void,
): Promise<void> {
  await ensureMangaSources();
  const subs = aggregateSubProviders();
  if (subs.length < 2) {
    const chs = await mangaChapters(id).catch(() => [] as MangaChapter[]);
    if (chs.length) onChunk(chs);
    return;
  }
  const key = `all|chaptersAll|${id}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 20 * MIN) {
    onChunk((await hit.p) as MangaChapter[]);
    return;
  }
  const all: MangaChapter[] = [];
  await streamAggregateChapters(
    id,
    (chunk) => {
      all.push(...chunk);
      onChunk(chunk);
    },
    activeMangaProvider().id,
  );
  if (all.length) settle(key, all);
}

export function chapterPages(chapterId: string) {
  const routed = routeById(chapterId);
  const run = routed
    ? () => routed.provider.pageUrls(routed.orig)
    : (p: MangaProvider) => p.pageUrls(chapterId);
  return cached("pages", chapterId, 5 * MIN, run, { timeout: PAGES_TIMEOUT });
}

export function mangaTags() {
  const revision = suwayomiSourcesRevision();
  const lib = mangaLibraryRevision();
  const langRev = mangaLangFilterRevision();
  // Key by the selection itself (not just a counter) so entries stay valid across app restarts.
  const serverBase = activeMangaSource()?.baseUrl;
  const langKey = encodeURIComponent(loadMangaLangFilter(serverBase).slice().sort().join("+"));
  return cached(
    "tags",
    `${revision}|${lib}|${langRev}|${langKey}`,
    30 * MIN,
    (p) => (p.tags ? p.tags() : Promise.resolve([])),
    { tries: 1 },
  );
}

export async function setMangaInLibrary(id: string, inLibrary: boolean): Promise<boolean> {
  await ensureMangaSources();
  const routed = routeById(id);
  const provider = routed?.provider ?? activeMangaProvider();
  const mangaId = routed?.orig ?? id;
  if (!provider.setLibrary) return false;
  await provider.setLibrary(mangaId, inLibrary);
  return true;
}
