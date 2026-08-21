import type { MangaChapter, MangaProvider, MangaSummary, MangaTag } from "@/lib/manga/types";
import {
  cursorKey,
  decodeChapterId,
  decodeMangaId,
  encodeChapterId,
  makeClient,
  makeServer,
  mapManga,
  nextPage,
  recordPage,
  type BrowseKind,
} from "./model";
import {
  restBrowse,
  restChapters,
  restLibrary,
  restMangaFull,
  restPageUrls,
  restSearch,
  restSetMangaInLibrary,
  type RestChapter,
} from "./rest";
import {
  gqlBrowse,
  gqlChapters,
  gqlLibrary,
  gqlManga,
  gqlPageUrls,
  gqlSetMangaInLibrary,
} from "./graphql";
import { loadSources, pickTransport, sourceLang, withTransportFallback } from "./transport";
import { registerServerPageHeaders } from "@/lib/manga/plugins/adapter";
import { langFilterMatches, loadMangaLangFilter } from "@/lib/manga/lang-filter";

const SEARCH_ALL_CONCURRENCY = 4;

function normalizedTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isStrongSearchMatch(item: MangaSummary, query: string): boolean {
  const key = normalizedTitle(query);
  if (!key) return false;
  return [item.title, item.altTitle]
    .filter((title): title is string => !!title)
    .map(normalizedTitle)
    .some((title) => title === key || title.startsWith(key) || key.startsWith(title));
}

function mapChapters(
  sourceId: string,
  mangaId: string,
  lang: string,
  chapters: RestChapter[],
): MangaChapter[] {
  const mapped = chapters.map((c) => ({
    id: encodeChapterId(sourceId, mangaId, c.key),
    chapter: c.chapterNumber != null ? String(c.chapterNumber) : null,
    title: c.name,
    pages: c.pageCount,
    language: lang,
    group: c.scanlator,
    publishAt: c.uploadDate,
    downloaded: c.downloaded,
    serverRead: c.isRead,
    serverPage: c.lastPageRead,
  }));
  if (mapped.length > 1 && mapped.every((c) => c.chapter != null)) {
    mapped.sort((a, b) => Number(a.chapter) - Number(b.chapter));
  }
  return mapped;
}

export function makeSuwayomiProvider(baseUrl: string, basicAuth?: string): MangaProvider {
  const server = makeServer(baseUrl, basicAuth);
  const client = makeClient(server);

  async function browse(
    sourceId: string,
    kind: BrowseKind,
    offset: number,
    query: string,
    requestClient = client,
  ): Promise<MangaSummary[]> {
    const key = cursorKey(server.base, sourceId, kind, query);
    const page = nextPage(key, offset);
    if (page < 0) return [];
    const res = await withTransportFallback(requestClient, (t) =>
      t === "rest"
        ? kind === "search"
          ? restSearch(requestClient, sourceId, query, page)
          : restBrowse(requestClient, sourceId, kind, page)
        : gqlBrowse(requestClient, sourceId, kind, page, kind === "search" ? query : undefined),
    );
    recordPage(key, res.items.length, res.hasNextPage, page);
    return res.items
      .map((m) => mapManga(server, sourceId, m))
      .filter((m): m is MangaSummary => !!m);
  }

  async function library(): Promise<MangaSummary[]> {
    const list = await withTransportFallback(client, (t) =>
      t === "rest" ? restLibrary(client) : gqlLibrary(client),
    );
    return list
      .map((m) => mapManga(server, String(m?.sourceId ?? ""), m))
      .filter((m): m is MangaSummary => !!m);
  }

  let popularCache: { key: string; at: number; items: MangaSummary[] } | null = null;
  const POPULAR_CACHE_TTL = 5 * 60_000;
  const POPULAR_PAGES = 3;
  const POPULAR_SOURCE_CAP = 20;
  const POPULAR_MAX_TOTAL = 150;

  async function mergedPopular(): Promise<MangaSummary[]> {
    const filter = loadMangaLangFilter();
    const cacheKey = `${server.base}|${[...filter].sort().join("+")}`;
    if (popularCache && popularCache.key === cacheKey && Date.now() - popularCache.at < POPULAR_CACHE_TTL) {
      return popularCache.items;
    }
    const t = await pickTransport(client);
    const sources = (await loadSources(client, t))
      .filter((s) => langFilterMatches(filter, s.lang))
      .slice(0, POPULAR_SOURCE_CAP);
    if (sources.length === 0) {
      popularCache = { key: cacheKey, at: Date.now(), items: [] };
      return [];
    }
    const seen = new Set<string>();
    const out: MangaSummary[] = [];
    let next = 0;
    const worker = async () => {
      while (next < sources.length) {
        const source = sources[next++];
        try {
          let offset = 0;
          for (let page = 0; page < POPULAR_PAGES; page++) {
            const items = await browse(source.id, "popular", offset, "");
            if (items.length === 0) break;
            for (const m of items) {
              if (seen.has(m.id)) continue;
              seen.add(m.id);
              out.push(m);
            }
            offset += items.length;
            if (out.length >= POPULAR_MAX_TOTAL) return;
          }
        } catch {
          /* skip source that fails to return popular */
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, sources.length) }, () => worker()));
    popularCache = { key: cacheKey, at: Date.now(), items: out };
    return out;
  }

  async function popular(offset: number, tagId?: string): Promise<MangaSummary[]> {
    if (!tagId) return offset > 0 ? [] : mergedPopular();
    return browse(tagId, "popular", offset, "");
  }

  async function search(query: string, offset: number, tagId?: string): Promise<MangaSummary[]> {
    const q = query.trim();
    if (!q) return popular(offset, tagId);
    if (tagId) return browse(tagId, "search", offset, q);
    if (offset > 0) return [];
    const lower = q.toLowerCase();
    return (await library()).filter((m) => m.title.toLowerCase().includes(lower));
  }

  async function searchAll(query: string): Promise<MangaSummary[]> {
    const q = query.trim();
    if (!q) return [];
    const sources = await loadSources(client, await pickTransport(client));
    if (!sources.length) return [];

    const unique = new Map<string, MangaSummary>();
    let nextSource = 0;
    let exactFound = false;
    let releaseExact: () => void = () => {};
    const exact = new Promise<void>((resolve) => {
      releaseExact = resolve;
    });

    const worker = async () => {
      while (!exactFound) {
        const source = sources[nextSource++];
        if (!source) return;
        const requestClient = makeClient(server, 0);
        const items = await browse(source.id, "search", 0, q, requestClient).catch(() => []);
        for (const item of items) unique.set(item.id, item);
        if (items.some((item) => isStrongSearchMatch(item, q))) {
          exactFound = true;
          releaseExact();
        }
      }
    };

    const workers = Array.from({ length: Math.min(SEARCH_ALL_CONCURRENCY, sources.length) }, () =>
      worker(),
    );
    const all = Promise.all(workers).then(() => undefined);
    await Promise.race([all, exact]);
    return [...unique.values()];
  }

  async function detail(id: string): Promise<MangaSummary | null> {
    const parsed = decodeMangaId(id);
    if (!parsed) return null;
    const raw = await withTransportFallback(client, (t) =>
      t === "rest" ? restMangaFull(client, parsed.mangaId) : gqlManga(client, parsed.mangaId),
    );
    return raw ? mapManga(server, parsed.sourceId, raw) : null;
  }

  async function chapters(id: string): Promise<MangaChapter[]> {
    const parsed = decodeMangaId(id);
    if (!parsed) return [];
    return withTransportFallback(client, async (t) => {
      const raw =
        t === "rest"
          ? await restChapters(client, parsed.mangaId)
          : await gqlChapters(client, parsed.mangaId);
      const lang = await sourceLang(client, t, parsed.sourceId);
      return mapChapters(parsed.sourceId, parsed.mangaId, lang, raw);
    });
  }

  function registerPageAuth(urls: string[]): void {
    if (!server.authHeader) return;
    let host = "";
    try {
      host = new URL(server.base).host;
    } catch {
      return;
    }
    for (const u of urls) {
      try {
        if (new URL(u).host === host)
          registerServerPageHeaders(u, { authorization: server.authHeader });
      } catch {
        /* skip */
      }
    }
  }

  async function pageUrls(chapterId: string): Promise<string[]> {
    const parsed = decodeChapterId(chapterId);
    if (!parsed) return [];
    const urls = await withTransportFallback(client, (t) =>
      t === "rest"
        ? restPageUrls(client, parsed.mangaId, parsed.key)
        : gqlPageUrls(client, parsed.key),
    );
    registerPageAuth(urls);
    return urls;
  }

  async function tags(): Promise<MangaTag[]> {
    const t = await pickTransport(client);
    const filter = loadMangaLangFilter();
    return (await loadSources(client, t))
      .filter((s) => langFilterMatches(filter, s.lang))
      .map((s) => ({
        id: s.id,
        name:
          s.lang.toLowerCase() === "localsourcelang"
            ? "Local Source"
            : s.lang && s.lang !== "en"
              ? `${s.name} (${s.lang.toUpperCase()})`
              : s.name,
        group: "Sources",
      }));
  }

  async function setLibrary(id: string, inLibrary: boolean): Promise<void> {
    const parsed = decodeMangaId(id);
    if (!parsed) return;
    await withTransportFallback(client, async (t) => {
      const ok =
        t === "rest"
          ? await restSetMangaInLibrary(client, parsed.mangaId, inLibrary)
          : await gqlSetMangaInLibrary(client, parsed.mangaId, inLibrary);
      if (!ok) throw new Error("suwayomi_library_update_failed");
    });
  }

  return {
    id: "suwayomi",
    name: "My Server",
    popular,
    search,
    searchAll,
    detail,
    chapters,
    pageUrls,
    tags,
    setLibrary,
  };
}

export * from "./api";
export type { SuwayomiSource, SuwayomiExtension } from "./model";
