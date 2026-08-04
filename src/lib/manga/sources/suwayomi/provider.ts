import { collapseMangaDuplicates } from "@/lib/manga/dedupe";
import type { MangaChapter, MangaProvider, MangaSummary, MangaTag } from "@/lib/manga/types";
import {
  cursorKey,
  decodeChapterId,
  decodeMangaGroup,
  decodeMangaId,
  encodeChapterId,
  encodeMangaGroup,
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
  type RestChapter,
} from "./rest";
import { gqlBrowse, gqlChapters, gqlLibrary, gqlManga, gqlPageUrls } from "./graphql";
import { loadSources, pickTransport, sourceLang, withTransportFallback } from "./transport";
import { registerServerPageHeaders } from "@/lib/manga/plugins/adapter";

function mapChapters(
  sourceId: string,
  mangaId: string,
  lang: string,
  chapters: RestChapter[],
  sourceName?: string,
): MangaChapter[] {
  const mapped = chapters.map((c) => ({
    id: encodeChapterId(sourceId, mangaId, c.key),
    chapter: c.chapterNumber != null ? String(c.chapterNumber) : null,
    title: c.name,
    pages: c.pageCount,
    language: lang,
    group: [sourceName, c.scanlator].filter(Boolean).join(" · ") || undefined,
    publishAt: c.uploadDate,
    downloaded: c.downloaded,
  }));
  if (mapped.length > 1 && mapped.every((c) => c.chapter != null)) {
    mapped.sort((a, b) => Number(a.chapter) - Number(b.chapter));
  }
  return mapped;
}

export function makeSuwayomiProvider(baseUrl: string, basicAuth?: string): MangaProvider {
  const server = makeServer(baseUrl, basicAuth);
  const client = makeClient(server);
  let knownSourceNames = new Map<string, string>();

  async function browse(
    sourceId: string,
    kind: BrowseKind,
    offset: number,
    query: string,
  ): Promise<MangaSummary[]> {
    const key = cursorKey(server.base, sourceId, kind, query);
    const page = nextPage(key, offset);
    if (page < 0) return [];
    const res = await withTransportFallback(client, (t) =>
      t === "rest"
        ? kind === "search"
          ? restSearch(client, sourceId, query, page)
          : restBrowse(client, sourceId, kind, page)
        : gqlBrowse(client, sourceId, kind, page, kind === "search" ? query : undefined),
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

  function groupManga(items: MangaSummary[]): MangaSummary[] {
    return collapseMangaDuplicates(items).map((item) => ({
      ...item,
      id: encodeMangaGroup(item.variantIds),
    }));
  }

  async function browseInstalledSources(
    kind: BrowseKind,
    offset: number,
    query: string,
  ): Promise<MangaSummary[]> {
    const transport = await pickTransport(client);
    const sources = await loadSources(client, transport);
    knownSourceNames = new Map(sources.map((source) => [source.id, source.name]));
    if (sources.length === 0) {
      if (offset > 0) return [];
      const saved = await library();
      if (kind !== "search") return groupManga(saved);
      const lower = query.toLowerCase();
      return groupManga(saved.filter((m) => m.title.toLowerCase().includes(lower)));
    }

    const pages = await Promise.allSettled(
      sources.map((source) => browse(source.id, kind, offset, query)),
    );
    const available = pages.filter(
      (page): page is PromiseFulfilledResult<MangaSummary[]> => page.status === "fulfilled",
    );
    if (available.length === 0) {
      const failure = pages.find((page) => page.status === "rejected");
      throw failure?.reason ?? new Error("Suwayomi sources did not respond");
    }

    const merged: MangaSummary[] = [];
    const seen = new Set<string>();
    const longest = Math.max(0, ...available.map((page) => page.value.length));
    for (let index = 0; index < longest; index++) {
      for (const page of available) {
        const item = page.value[index];
        if (!item || seen.has(item.id)) continue;
        seen.add(item.id);
        merged.push(item);
      }
    }
    return groupManga(merged);
  }

  async function popular(offset: number, tagId?: string): Promise<MangaSummary[]> {
    if (!tagId) return browseInstalledSources("popular", offset, "");
    return browse(tagId, "popular", offset, "");
  }

  async function search(query: string, offset: number, tagId?: string): Promise<MangaSummary[]> {
    const q = query.trim();
    if (!q) return popular(offset, tagId);
    if (tagId) return browse(tagId, "search", offset, q);
    return browseInstalledSources("search", offset, q);
  }

  async function detail(id: string): Promise<MangaSummary | null> {
    for (const variantId of decodeMangaGroup(id)) {
      const parsed = decodeMangaId(variantId);
      if (!parsed) continue;
      const raw = await withTransportFallback(client, (t) =>
        t === "rest" ? restMangaFull(client, parsed.mangaId) : gqlManga(client, parsed.mangaId),
      ).catch(() => null);
      const mapped = raw ? mapManga(server, parsed.sourceId, raw) : null;
      if (mapped) return { ...mapped, id };
    }
    return null;
  }

  async function chapters(id: string): Promise<MangaChapter[]> {
    const transport = await pickTransport(client);
    if (knownSourceNames.size === 0) {
      const sources = await loadSources(client, transport).catch(() => []);
      knownSourceNames = new Map(sources.map((source) => [source.id, source.name]));
    }
    const lists = await Promise.all(
      decodeMangaGroup(id).map(async (variantId) => {
        const parsed = decodeMangaId(variantId);
        if (!parsed) return [];
        return withTransportFallback(client, async (t) => {
          const raw =
            t === "rest"
              ? await restChapters(client, parsed.mangaId)
              : await gqlChapters(client, parsed.mangaId);
          const lang = await sourceLang(client, t, parsed.sourceId);
          return mapChapters(
            parsed.sourceId,
            parsed.mangaId,
            lang,
            raw,
            knownSourceNames.get(parsed.sourceId),
          );
        }).catch(() => []);
      }),
    );
    return lists.flat();
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
    return (await loadSources(client, t)).map((s) => ({
      id: s.id,
      name: s.lang && s.lang !== "en" ? `${s.name} (${s.lang.toUpperCase()})` : s.name,
      group: "Sources",
    }));
  }

  return { id: "suwayomi", name: "My Server", popular, search, detail, chapters, pageUrls, tags };
}

export * from "./api";
export type { SuwayomiSource, SuwayomiExtension } from "./model";
