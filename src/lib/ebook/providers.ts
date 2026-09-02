import { loadEBookExtensions, installedEBookPlugins, subscribeEBookExtensions } from "./extensions";
import {
  dedupeEBooks,
  eBooksMatch,
  fetchEBookMetadata,
  mergeEBookMetadata,
  type EBook,
} from "./api";
import { parseEpub, readEpubChapter, type EpubBook } from "./epub";
import {
  gutendexDetail,
  gutendexEpub,
  gutendexPopular,
  gutendexSearch,
  type GutendexBook,
} from "./gutendex";
import { listEBookSources, type EBookHtmlSourceConfig, type EBookSource } from "./sources";
import gutenbergLogo from "@/assets/gutenberg.png";
import { safeFetch } from "@/lib/safe-fetch";
import {
  cachedEBookTranslation,
  shouldAutomaticallyTranslateEBookChapter,
  translateEBookChapter,
} from "./translation";
import { ebookChapterCacheGet, ebookChapterCachePut } from "./cache";
import { PluginWorker } from "@/lib/manga/plugins/worker-host";
import type { InstalledPlugin } from "@/lib/manga/plugins/types";

export type EBookChapter = {
  id: string;
  title: string;
  chapter?: string;
  position?: number;
  volume?: string;
  volumeTitle?: string;
  publishAt?: string;
  views?: number | string;
};

export type EBookChapterContent = {
  text?: string;
  images?: string[];
  translated?: boolean;
  originalText?: string;
  translatedTitle?: string;
};

type Provider = {
  id: string;
  name: string;
  iconUrl?: string;
  popular(offset: number, tagId?: string): Promise<EBook[]>;
  search(query: string, offset: number, tagId?: string): Promise<EBook[]>;
  detail(id: string): Promise<EBook | null>;
  chapters(id: string): Promise<EBookChapter[]>;
  content(id: string): Promise<EBookChapterContent>;
};

const workers = new Map<string, PluginWorker>();
const htmlPages = new Map<string, Map<string, Map<number, number>>>();
const details = new Map<string, Promise<EBook | null>>();
const localBooks = new Map<string, Map<string, { title: string; paths: string[] }>>();
const localEpubs = new Map<string, Promise<EpubBook>>();
const LOCAL_EPUB_CACHE_LIMIT = 6;
const chapterContentPending = new Map<string, Promise<EBookChapterContent>>();
let extensionsReady: Promise<void> | null = null;

subscribeEBookExtensions(() => {
  workers.forEach((worker) => worker.dispose());
  workers.clear();
  details.clear();
});

function routeId(providerId: string, itemId: string): string {
  return `source:${encodeURIComponent(providerId)}:${encodeURIComponent(itemId)}`;
}

function routeParts(id: string): { providerId: string; itemId: string } | null {
  if (!id.startsWith("source:")) return null;
  const rest = id.slice(7);
  const split = rest.indexOf(":");
  if (split < 1) return null;
  try {
    return {
      providerId: decodeURIComponent(rest.slice(0, split)),
      itemId: decodeURIComponent(rest.slice(split + 1)),
    };
  } catch {
    return null;
  }
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function scalarText(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value) ? String(value) : text(value);
}

function positiveInt(value: unknown): number | undefined {
  const number = typeof value === "number" ? value : Number(text(value));
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function titleVolume(value?: string): string | undefined {
  return value
    ?.match(
      /(?:\bvol(?:ume)?\b\.?|\bbook\b|\bpart\b|المجلد|مجلد|الجزء|جزء|الكتاب|كتاب)\s*[:#.-]?\s*[\p{L}\p{N}]+/iu,
    )?.[0]
    .replace(/\s+/g, " ")
    .trim();
}

function sourceTitle(value: unknown): string | undefined {
  return text(value)
    ?.replace(/[^\p{L}\p{N}'’]+/gu, " ")
    .replace(/\s+(?:كول|kol)$/iu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function url(value: unknown): string | undefined {
  const candidate = text(value);
  return candidate && /^https?:\/\//i.test(candidate) ? candidate : undefined;
}

function pluginEBook(provider: Provider, value: unknown): EBook | null {
  const item = record(value);
  if (item.isFanMade === true) return null;
  const id = text(item.id);
  const rawTitle = text(item.title);
  const title = sourceTitle(rawTitle);
  if (!id || !title) return null;
  const authors = Array.isArray(item.authors)
    ? item.authors.map(text).filter((author): author is string => !!author)
    : [text(item.author)].filter((author): author is string => !!author);
  const altTitles = [
    text(item.altTitle),
    ...(Array.isArray(item.altTitles) ? item.altTitles.map(text) : []),
    rawTitle !== title ? rawTitle : undefined,
  ].filter((title): title is string => !!title);
  return {
    id: routeId(provider.id, id),
    source: "source",
    providerId: provider.id,
    sourceItemId: id,
    providerName: provider.name,
    anilistId: positiveInt(item.anilistId),
    googleBooksId: text(item.googleBooksId),
    openLibraryId: text(item.openLibraryId)?.replace(/^\/works\//, ""),
    wikidataId: text(item.wikidataId)
      ?.toUpperCase()
      .match(/^Q\d+$/)?.[0],
    isbn: text(item.isbn)?.replace(/[^0-9X]/gi, ""),
    seriesTitle: sourceTitle(item.seriesTitle),
    sourceAliases: [...new Set(altTitles)],
    sourceIdentity: {
      anilistId: positiveInt(item.anilistId),
      googleBooksId: text(item.googleBooksId),
      openLibraryId: text(item.openLibraryId)?.replace(/^\/works\//, ""),
      wikidataId: text(item.wikidataId)
        ?.toUpperCase()
        .match(/^Q\d+$/)?.[0],
      isbn: text(item.isbn)?.replace(/[^0-9X]/gi, ""),
    },
    title,
    altTitle: altTitles.length ? [...new Set(altTitles)].join("|") : undefined,
    authors,
    cover: url(item.cover),
    internalCover: url(item.internalCover),
    description: text(item.description) ?? "",
    year: typeof item.year === "number" ? Math.trunc(item.year) : undefined,
    status: text(item.status),
    originalLanguage: text(item.originalLanguage) ?? text(item.language),
    genres: Array.isArray(item.genres)
      ? item.genres.map(text).filter((genre): genre is string => !!genre)
      : [],
    chapters: typeof item.chapters === "number" ? Math.trunc(item.chapters) : undefined,
    volumes: typeof item.volumes === "number" ? Math.trunc(item.volumes) : undefined,
    score: typeof item.score === "number" ? item.score : undefined,
    trendingScore: typeof item.trendingScore === "number" ? item.trendingScore : undefined,
    siteUrl: url(item.siteUrl),
  };
}

function pluginChapters(
  value: unknown,
  parentVolume?: string,
  parentVolumeTitle?: string,
): EBookChapter[] {
  if (!Array.isArray(value)) return [];
  const chapters: EBookChapter[] = [];
  let activeVolume = parentVolume;
  let activeVolumeTitle = parentVolumeTitle;
  for (const entry of value) {
    const item = record(entry);
    const nested = Array.isArray(item.chapters);
    const title = text(item.title);
    const markedVolume = titleVolume(title);
    const volume =
      scalarText(item.volume) ??
      scalarText(item.volumeNumber) ??
      scalarText(item.book) ??
      scalarText(item.part) ??
      (nested ? title : activeVolume);
    const explicitVolumeTitle = text(item.volumeTitle) ?? text(item.volumeName);
    const volumeTitle =
      explicitVolumeTitle ??
      (nested ? title : volume === activeVolume ? activeVolumeTitle : undefined);
    if (nested) {
      chapters.push(...pluginChapters(item.chapters, volume, volumeTitle));
      continue;
    }
    const id = text(item.id);
    const chapter = scalarText(item.chapter);
    if (markedVolume && !chapter && title === markedVolume) {
      activeVolume = markedVolume;
      activeVolumeTitle = title;
      continue;
    }
    if (!id) continue;
    if (volume) activeVolume = volume;
    if (volumeTitle) activeVolumeTitle = volumeTitle;
    chapters.push({
      id,
      chapter,
      position:
        typeof item.position === "number" && Number.isFinite(item.position)
          ? item.position
          : undefined,
      title: title ?? (chapter ? `Chapter ${chapter}` : id),
      volume,
      volumeTitle,
      publishAt: text(item.publishAt),
      views: typeof item.views === "number" ? item.views : text(item.views),
    });
  }
  return chapters;
}

function pluginContent(value: unknown): EBookChapterContent {
  if (typeof value === "string") return { text: cleanSourceText(value) };
  const item = record(value);
  const body = text(item.text) ?? text(item.content) ?? text(item.body);
  const images = (Array.isArray(item.images) ? item.images : [])
    .map(url)
    .filter((image): image is string => !!image)
    .slice(0, 2_000);
  return { text: body ? cleanSourceText(body) : undefined, images };
}

function cleanSourceText(value: string): string {
  const text = value.replace(/\r/g, "").trim();
  const boundary = [
    /(?:^|\s)(?:background|border|color|cursor|display|font-size|line-height|opacity|position)\s*:\s*[^;{}]+;\s*(?:[\w-]+\s*:|})/i,
    /\b(?:document\.(?:getElementById|querySelector)|function\s+[\w$]+\s*\(|querySelectorAll\s*\(|classList\.(?:add|remove)\s*\()/i,
    /(?:^|\s)[.#][\w-]+(?::[\w-]+)?\s*\{(?=[^}]{0,400}\b(?:background|border|color|display|position)\s*:)/i,
  ].reduce((cut, pattern) => {
    const index = text.search(pattern);
    return index < 0 ? cut : Math.min(cut, index);
  }, text.length);
  const cleaned = text.slice(0, boundary).trim();
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : "";
}

async function localJoin(parent: string, child: string): Promise<string> {
  if (/^file:\/\//i.test(parent))
    return new URL(encodeURIComponent(child), parent.endsWith("/") ? parent : `${parent}/`).href;
  return (await import("@tauri-apps/api/path")).join(parent, child);
}

function localTitle(name: string): string {
  return (
    name
      .replace(/\.epub$/i, "")
      .replaceAll(/[_-]+/g, " ")
      .trim() || "Untitled eBook"
  );
}

async function localPackage(path: string): Promise<EpubBook> {
  let pending = localEpubs.get(path);
  if (pending) {
    localEpubs.delete(path);
    localEpubs.set(path, pending);
  }
  if (!pending) {
    pending = import("@tauri-apps/plugin-fs")
      .then(({ readFile }) => readFile(path))
      .then((bytes) => parseEpub(bytes.slice().buffer));
    localEpubs.set(path, pending);
    pending.catch(() => localEpubs.delete(path));
    pending.then(
      () => {
        while (localEpubs.size > LOCAL_EPUB_CACHE_LIMIT) {
          const oldest = localEpubs.keys().next().value;
          if (oldest) localEpubs.delete(oldest);
          else break;
        }
      },
      () => undefined,
    );
  }
  return pending;
}

async function scanLocalBooks(
  source: EBookSource,
): Promise<Map<string, { title: string; paths: string[] }>> {
  const { readDir } = await import("@tauri-apps/plugin-fs");
  const entries = await readDir(source.location);
  const books = new Map<string, { title: string; paths: string[] }>();
  for (const item of entries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true }),
  )) {
    const path = await localJoin(source.location, item.name);
    if (item.isFile && /\.epub$/i.test(item.name))
      books.set(path, { title: localTitle(item.name), paths: [path] });
    if (!item.isDirectory) continue;
    const files = await readDir(path).catch(() => []);
    const epubs = files
      .filter((file) => file.isFile && /\.epub$/i.test(file.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (epubs.length)
      books.set(path, {
        title: localTitle(item.name),
        paths: await Promise.all(epubs.map((file) => localJoin(path, file.name))),
      });
  }
  localBooks.set(source.id, books);
  return books;
}

const gutendexEpubs = new Map<string, Promise<EpubBook>>();

function gutendexPackage(id: string, url: string): Promise<EpubBook> {
  let pending = gutendexEpubs.get(id);
  if (!pending) {
    pending = gutendexEpub(url).then((buffer) => parseEpub(buffer));
    gutendexEpubs.set(id, pending);
    if (gutendexEpubs.size > LOCAL_EPUB_CACHE_LIMIT) {
      const oldest = gutendexEpubs.keys().next().value;
      if (oldest !== undefined) gutendexEpubs.delete(oldest);
    }
  }
  return pending;
}

function gutendexProvider(source: EBookSource): Provider {
  const provider = { id: source.id, name: source.name, iconUrl: gutenbergLogo } as Provider;
  const summary = (book: GutendexBook): EBook => ({
    id: routeId(provider.id, String(book.id)),
    source: "source",
    providerId: provider.id,
    sourceItemId: String(book.id),
    providerName: provider.name,
    title: book.title,
    authors: book.authors,
    description: "",
    genres: book.subjects,
    cover: book.cover,
  });
  const resolve = async (id: string) => {
    const book = await gutendexDetail(id);
    if (!book?.epubUrl) throw new Error("This book has no EPUB edition.");
    return { book, epub: await gutendexPackage(id, book.epubUrl) };
  };
  provider.popular = async (offset) => (await gutendexPopular(offset)).map(summary);
  provider.search = async (query, offset) => (await gutendexSearch(query, offset)).map(summary);
  provider.detail = async (id) => {
    const book = await gutendexDetail(id);
    if (!book) return null;
    return { ...summary(book), description: book.subjects.join(", ") };
  };
  provider.chapters = async (id) => {
    const { epub } = await resolve(id);
    return epub.chapters.map((chapter, index) => ({
      id: JSON.stringify([id, chapter.path]),
      title: chapter.title,
      chapter: String(index + 1),
      position: index,
    }));
  };
  provider.content = async (id) => {
    const [bookId, chapter] = JSON.parse(id) as [string, string];
    const { epub } = await resolve(bookId);
    return { text: cleanSourceText(readEpubChapter(epub, chapter)) };
  };
  return provider;
}

function localProvider(source: EBookSource): Provider {
  const provider = { id: source.id, name: source.name, iconUrl: source.iconUrl } as Provider;
  const find = async (id: string) =>
    localBooks.get(source.id)?.get(id) ?? (await scanLocalBooks(source)).get(id);
  const summary = (id: string, book: { title: string; paths: string[] }): EBook => ({
    id: routeId(provider.id, id),
    source: "source",
    providerId: provider.id,
    sourceItemId: id,
    providerName: provider.name,
    title: book.title,
    authors: [],
    description: "",
    genres: [],
    volumes: book.paths.length > 1 ? book.paths.length : undefined,
  });
  const list = async (query: string, offset: number) => {
    const books = [...(await scanLocalBooks(source))].filter(([, book]) =>
      book.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    );
    return Promise.all(
      books.slice(offset, offset + 24).map(async ([id, book]) => {
        const item = summary(id, book);
        const epub = await localPackage(book.paths[0]).catch(() => null);
        if (!epub?.cover) return item;
        return {
          ...item,
          cover: epub.cover,
          internalCover: epub.cover,
        };
      }),
    );
  };
  provider.popular = (offset) => list("", offset);
  provider.search = (query, offset) => list(query, offset);
  provider.detail = async (id) => {
    const book = await find(id);
    if (!book) return null;
    const epub = await localPackage(book.paths[0]);
    return {
      ...summary(id, book),
      title: book.paths.length > 1 ? book.title : epub.title || book.title,
      authors: epub.authors,
      cover: epub.cover,
      description: epub.description,
      year: epub.year,
      genres: epub.subjects,
      chapters: book.paths.length === 1 ? epub.chapters.length : undefined,
    };
  };
  provider.chapters = async (id) => {
    const book = await find(id);
    if (!book) return [];
    const chapters: EBookChapter[] = [];
    for (const [volumeIndex, path] of book.paths.entries()) {
      const epub = await localPackage(path);
      for (const [chapterIndex, chapter] of epub.chapters.entries())
        chapters.push({
          id: JSON.stringify([path, chapter.path]),
          title: chapter.title,
          chapter: String(chapterIndex + 1),
          position: chapters.length,
          volume: book.paths.length > 1 ? String(volumeIndex + 1) : undefined,
          volumeTitle: book.paths.length > 1 ? epub.title : undefined,
        });
    }
    return chapters;
  };
  provider.content = async (id) => {
    const [path, chapter] = JSON.parse(id) as [string, string];
    return { text: cleanSourceText(readEpubChapter(await localPackage(path), chapter)) };
  };
  return provider;
}

function pluginProvider(plugin: InstalledPlugin): Provider {
  const id = `plugin:${plugin.id}`;
  let worker = workers.get(id);
  if (!worker) {
    worker = new PluginWorker(plugin);
    workers.set(id, worker);
  }
  const call = (method: string, args: unknown[], timeout = 25_000) =>
    worker!.call(method, args, timeout);
  const provider = {
    id,
    name: plugin.name,
    iconUrl: plugin.icon,
  } as Provider;
  let supportedTags: Promise<Set<string>> | null = null;
  const supportedTag = async (tagId?: string) => {
    if (!tagId) return undefined;
    supportedTags ??= call("tags", [])
      .then((value) =>
        new Set(
          (Array.isArray(value) ? value : [])
            .map((entry) => text(record(entry).id))
            .filter((tag): tag is string => !!tag),
        ),
      )
      .catch(() => new Set<string>());
    return (await supportedTags).has(tagId) ? tagId : undefined;
  };
  provider.popular = async (offset, tagId) =>
    call("popular", [offset, await supportedTag(tagId)]).then((items) =>
      pluginList(provider, items),
    );
  provider.search = async (query, offset, tagId) =>
    call("search", [query, offset, await supportedTag(tagId)]).then((items) =>
      pluginList(provider, items),
    );
  provider.detail = (itemId) =>
    call("detail", [itemId]).then((item) => pluginEBook(provider, item));
  provider.chapters = (itemId) => call("chapters", [itemId]).then(pluginChapters);
  provider.content = async (chapterId) => {
    try {
      return pluginContent(await call("content", [chapterId], 30_000));
    } catch (cause) {
      if (!(cause instanceof Error) || !cause.message.includes("no method: content")) throw cause;
      const images = await call("pageUrls", [chapterId], 30_000);
      return pluginContent({ images });
    }
  };
  return provider;
}

function pluginList(provider: Provider, value: unknown): EBook[] {
  return Array.isArray(value)
    ? value.map((item) => pluginEBook(provider, item)).filter((item): item is EBook => !!item)
    : [];
}

function htmlProvider(source: EBookSource & { config: EBookHtmlSourceConfig }): Provider {
  const config = source.config;
  const base = config.baseUrl;
  const provider = { id: source.id, name: source.name, iconUrl: source.iconUrl } as Provider;
  const target = (path: string) => new URL(path, `${base}/`).href;
  const pages = htmlPages.get(source.id) ?? new Map<string, Map<number, number>>();
  htmlPages.set(source.id, pages);
  const pick = (root: ParentNode, spec?: string): string | undefined => {
    if (!spec) return undefined;
    for (const option of spec.split("|")) {
      const [selector, attribute] = option.split("@");
      const element = selector.trim() ? root.querySelector(selector.trim()) : (root as Element);
      const value = attribute ? element?.getAttribute(attribute.trim()) : element?.textContent;
      if (value?.trim()) return value.replace(/\s+/g, " ").trim();
    }
  };
  const documentAt = async (path: string): Promise<Document> => {
    const response = await safeFetch(
      target(path),
      config.headers ? { headers: config.headers } : undefined,
    );
    if (!response.ok) throw new Error(`${source.name} HTTP ${response.status}`);
    return new DOMParser().parseFromString(await response.text(), "text/html");
  };
  const list = async (path: string): Promise<EBook[]> => {
    const document = await documentAt(path);
    return Array.from(document.querySelectorAll(config.list.item)).flatMap((element) => {
      const itemId = pick(element, config.list.link);
      if (!itemId) return [];
      const cover = pick(element, config.list.cover);
      return [
        {
          id: routeId(provider.id, itemId),
          source: "source" as const,
          providerId: provider.id,
          sourceItemId: itemId,
          providerName: provider.name,
          title: sourceTitle(pick(element, config.list.title)) ?? itemId,
          authors: [],
          cover: cover ? target(cover) : undefined,
          description: "",
          genres: [],
        },
      ];
    });
  };
  const page = async (key: string, path: string, offset: number) => {
    const offsets = pages.get(key) ?? new Map([[0, 1]]);
    pages.set(key, offsets);
    const number = offsets.get(offset);
    if (!number) return [];
    const items = await list(path.replaceAll("{page}", String(number)));
    if (items.length) offsets.set(offset + items.length, number + 1);
    return items;
  };
  provider.popular = (offset) => page("popular", config.popularPath, offset);
  provider.search = (query, offset) =>
    page(
      `search:${query}`,
      config.searchPath.replaceAll("{query}", encodeURIComponent(query)),
      offset,
    );
  provider.detail = async (itemId) => {
    const document = await documentAt(itemId);
    const detail = config.detail;
    const cover = pick(document, detail?.cover);
    return {
      id: routeId(provider.id, itemId),
      source: "source",
      providerId: provider.id,
      sourceItemId: itemId,
      providerName: provider.name,
      title: sourceTitle(pick(document, detail?.title)) ?? itemId,
      authors: [pick(document, detail?.author)].filter((author): author is string => !!author),
      cover: cover ? target(cover) : undefined,
      description: pick(document, detail?.description) ?? "",
      status: pick(document, detail?.status),
      genres: [],
    };
  };
  provider.chapters = async (itemId) => {
    const document = await documentAt(itemId);
    return Array.from(document.querySelectorAll(config.chapters.item)).flatMap(
      (element, position) => {
        const id = pick(element, config.chapters.link);
        if (!id) return [];
        const title = pick(element, config.chapters.title) ?? id;
        return [
          {
            id,
            title,
            chapter: pick(element, config.chapters.chapter),
            position,
            volume: pick(element, config.chapters.volume),
            volumeTitle: pick(element, config.chapters.volumeTitle),
            publishAt: pick(element, config.chapters.date),
            views: pick(element, config.chapters.views),
          },
        ];
      },
    );
  };
  provider.content = async (chapterId) => {
    const document = await documentAt(chapterId);
    const root = document.querySelector(config.content.body);
    if (!root) return {};
    const blocks = Array.from(root.querySelectorAll("p,h1,h2,h3,h4,blockquote,li"))
      .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return {
      text: cleanSourceText(blocks.length ? blocks.join("\n\n") : (root.textContent?.trim() ?? "")),
    };
  };
  return provider;
}

async function providers(): Promise<Provider[]> {
  await (extensionsReady ??= loadEBookExtensions());
  return [
    ...listEBookSources()
      .filter((source) => source.kind === "local")
      .map(localProvider),
    ...listEBookSources()
      .filter(
        (source): source is EBookSource & { config: EBookHtmlSourceConfig } =>
          source.kind === "html" && !!source.config,
      )
      .map(htmlProvider),
    ...listEBookSources()
      .filter((source) => source.kind === "gutendex")
      .map(gutendexProvider),
    ...installedEBookPlugins()
      .filter((plugin) => plugin.enabled)
      .map(pluginProvider),
  ];
}

async function providerFor(route: string): Promise<{ provider: Provider; itemId: string } | null> {
  const parts = routeParts(route);
  if (!parts) return null;
  const provider = (await providers()).find((item) => item.id === parts.providerId);
  return provider ? { provider, itemId: parts.itemId } : null;
}

export type EBookProvider = Pick<Provider, "id" | "name" | "iconUrl">;
export type EBookCursor = Record<string, number>;
export type EBookPage = {
  items: EBook[];
  enriched: Promise<EBook[]>;
  cursor: EBookCursor;
  hasMore: boolean;
};
export type EBookLoadEvents = {
  onSource?: (items: EBook[]) => void;
  onMetadata?: (items: EBook[]) => void;
};

async function sourceDetail(route: string): Promise<EBook | null> {
  let pending = details.get(route);
  if (!pending) {
    pending = providerFor(route).then((found) =>
      found ? found.provider.detail(found.itemId) : null,
    );
    details.set(route, pending);
    pending.catch(() => details.delete(route));
  }
  return pending;
}

async function withMetadata(
  items: EBook[],
  onMetadata?: (items: EBook[]) => void,
): Promise<EBook[]> {
  if (!items.length) return items;
  const batches = Array.from({ length: Math.ceil(items.length / 8) }, (_, index) =>
    items.slice(index * 8, index * 8 + 8),
  );
  const resolved = new Map(items.map((item) => [item.id, item]));
  let next = 0;
  const publish = (batch: EBook[], metadata: EBook[]) => {
    const enriched = mergeEBookMetadata(batch, metadata);
    enriched.forEach((item) => resolved.set(item.id, item));
    onMetadata?.(enriched);
  };
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next++];
      const metadata = await fetchEBookMetadata(batch, (partial) => publish(batch, partial)).catch(
        () => [],
      );
      publish(batch, metadata);
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, batches.length) }, () => worker()));
  return items.map((item) => resolved.get(item.id) ?? item);
}

export async function listEBookProviders(): Promise<EBookProvider[]> {
  const list = await providers();
  return [
    ...(list.length > 1 ? [{ id: "all", name: "All Sources" }] : []),
    ...list.map(({ id, name, iconUrl }) => ({ id, name, iconUrl })),
  ];
}

function selectedProviders(list: Provider[], providerId?: string): Provider[] {
  return !providerId || providerId === "all"
    ? list
    : list.filter((provider) => provider.id === providerId);
}

export async function loadSourceEBookCatalogPage(
  providerId?: string,
  cursor: EBookCursor = {},
  tagId?: string,
): Promise<Omit<EBookPage, "enriched">> {
  const list = selectedProviders(await providers(), providerId);
  const pages = await Promise.all(
    list.map(async (provider) => {
      const offset = cursor[provider.id] ?? 0;
      const items = await provider.popular(offset, tagId).catch(() => []);
      return { provider, offset, items: mergeEBookMetadata(items, []) };
    }),
  );
  return {
    items: dedupeEBooks(pages.flatMap((page) => page.items)),
    cursor: Object.fromEntries(
      pages.map(({ provider, offset, items }) => [provider.id, offset + items.length]),
    ),
    hasMore: pages.some((page) => page.items.length > 0),
  };
}

export async function searchSourceEBookCatalog(
  query: string,
  providerId?: string,
): Promise<EBook[]> {
  const list = selectedProviders(await providers(), providerId);
  const pages = await Promise.all(
    list.map((provider) => provider.search(query, 0).catch(() => [])),
  );
  return dedupeEBooks(mergeEBookMetadata(pages.flat(), []));
}

export async function loadSourceEBookPage(
  query: string | undefined,
  providerId?: string,
  cursor: EBookCursor = {},
  events?: EBookLoadEvents,
  tagId?: string,
): Promise<EBookPage> {
  const available = await providers();
  const list = selectedProviders(available, providerId);
  const pages = await Promise.all(
    list.map(async (provider) => {
      const offset = cursor[provider.id] ?? 0;
      const items = await (
        query ? provider.search(query, offset, tagId) : provider.popular(offset, tagId)
      ).catch(() => []);
      events?.onSource?.(mergeEBookMetadata(items, []));
      return { provider, offset, items, enriched: withMetadata(items, events?.onMetadata) };
    }),
  );
  const sourceItems = dedupeEBooks(pages.flatMap((page) => page.items));
  return {
    items: sourceItems,
    enriched: Promise.all(pages.map((page) => page.enriched)).then(async (selectedGroups) => {
        const selected = selectedGroups.flat();
        let selectedEntries = selected.flatMap((item) => item.books ?? [item]);
        const authorKeys = (item: EBook) =>
          item.authors
            .map((author) => author.normalize("NFKD").toLocaleLowerCase().trim())
            .filter(Boolean);
        const candidateDetails = selectedEntries
          .filter((item, index, entries) => {
            const authors = new Set(authorKeys(item));
            if (!authors.size) return false;
            const arabic = /\p{Script=Arabic}/u.test(item.title);
            return entries.some(
              (other, otherIndex) =>
                otherIndex !== index &&
                /\p{Script=Arabic}/u.test(other.title) !== arabic &&
                authorKeys(other).some((author) => authors.has(author)),
            );
          })
          .slice(0, 24);
        if (candidateDetails.length) {
          const hydrated = await Promise.all(
            candidateDetails.map((item) =>
              sourceEBookDetail(item.id).then((detail) => detail ?? item).catch(() => item),
            ),
          );
          const hydratedById = new Map(hydrated.map((item) => [item.id, item]));
          selectedEntries = selectedEntries.map((item) => hydratedById.get(item.id) ?? item);
        }
        const searches = new Map<string, { provider: Provider; query: string }>();
        for (const item of selectedEntries) {
          const aliases = [
            ...(item.sourceAliases ?? []),
            ...(item.verifiedAliases ?? []),
            ...(item.altTitle?.split("|") ?? []),
            item.title,
          ]
            .map((title) => title.trim())
            .filter(Boolean);
          const crossScript = aliases.filter(
            (title) => /\p{Script=Arabic}/u.test(title) !== /\p{Script=Arabic}/u.test(item.title),
          );
          const queries = (crossScript.length ? crossScript : aliases).slice(0, 2);
          for (const provider of available) {
            if (provider.id === item.providerId) continue;
            for (const counterpartQuery of queries)
              searches.set(`${provider.id}\0${counterpartQuery}`, {
                provider,
                query: counterpartQuery,
              });
          }
        }
        const jobs = [...searches.values()];
        const companions: EBook[] = [];
        let next = 0;
        const worker = async () => {
          while (next < jobs.length) {
            const job = jobs[next++];
            const found = await job.provider.search(job.query, 0).catch(() => []);
            companions.push(...(await withMetadata(found)));
          }
        };
        await Promise.all(Array.from({ length: Math.min(4, jobs.length) }, () => worker()));
        const matchingCompanions = companions
          .flatMap((item) => item.books ?? [item])
          .filter((candidate) => selectedEntries.some((item) => eBooksMatch(item, candidate)));
        return dedupeEBooks([...selectedEntries, ...matchingCompanions]);
      }),
    cursor: Object.fromEntries(
      pages.map(({ provider, offset, items }) => [provider.id, offset + items.length]),
    ),
    hasMore: pages.some((page) => page.items.length > 0),
  };
}

export async function browseSourceEBooks(providerId?: string, offset = 0): Promise<EBook[]> {
  const cursor = Object.fromEntries(
    selectedProviders(await providers(), providerId).map((provider) => [provider.id, offset]),
  );
  return (await loadSourceEBookPage(undefined, providerId, cursor)).enriched;
}

export async function searchSourceEBooks(
  query: string,
  providerId?: string,
  offset = 0,
): Promise<EBook[]> {
  const cursor = Object.fromEntries(
    selectedProviders(await providers(), providerId).map((provider) => [provider.id, offset]),
  );
  return (await loadSourceEBookPage(query, providerId, cursor)).enriched;
}

export async function sourceEBookDetail(route: string): Promise<EBook | null> {
  const detail = await sourceDetail(route);
  return detail ? (await withMetadata([detail]))[0] : null;
}

export async function sourceEBookChapters(route: string): Promise<EBookChapter[]> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const found = await providerFor(route);
      if (!found) return [];
      return await found.provider.chapters(found.itemId);
    } catch (cause) {
      if (attempt) throw cause;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }
  return [];
}

const chapterCacheKey = (route: string, chapterId: string) => `${route}\n${chapterId}`;

async function fetchAndCacheSourceEBookContent(
  route: string,
  chapterId: string,
): Promise<EBookChapterContent> {
  const key = chapterCacheKey(route, chapterId);
  let pending = chapterContentPending.get(key);
  if (!pending) {
    pending = providerFor(route)
      .then((found) => (found ? found.provider.content(chapterId) : {}))
      .then(async (content) => {
        await ebookChapterCachePut(key, content);
        return content;
      });
    chapterContentPending.set(key, pending);
    pending.then(
      () => chapterContentPending.delete(key),
      () => chapterContentPending.delete(key),
    );
  }
  return pending;
}

async function rawSourceEBookContent(
  route: string,
  chapterId: string,
): Promise<EBookChapterContent> {
  const key = chapterCacheKey(route, chapterId);
  const cached = await ebookChapterCacheGet(key);
  if (cached) {
    if (cached.stale) void fetchAndCacheSourceEBookContent(route, chapterId).catch(() => undefined);
    return cached.content;
  }
  return fetchAndCacheSourceEBookContent(route, chapterId);
}

export async function sourceEBookContent(
  route: string,
  chapterId: string,
  chapterTitle = "",
  options: { waitForTranslation?: boolean } = {},
): Promise<EBookChapterContent> {
  const content = await rawSourceEBookContent(route, chapterId);
  if (!content.text) return content;
  const translated = await cachedEBookTranslation(content.text, chapterTitle);
  if (translated)
    return {
      ...content,
      text: translated.text,
      originalText: content.text,
      translatedTitle: translated.title,
      translated: true,
    };
  if (options.waitForTranslation && shouldAutomaticallyTranslateEBookChapter()) {
    const generated = await translateEBookChapter(content.text, chapterTitle);
    if (generated.text !== content.text)
      return {
        ...content,
        text: generated.text,
        originalText: content.text,
        translatedTitle: generated.title,
        translated: true,
      };
  }
  return content;
}

export async function prefetchSourceEBookContent(
  route: string,
  chapterId: string,
): Promise<void> {
  const key = chapterCacheKey(route, chapterId);
  const cached = await ebookChapterCacheGet(key);
  if (cached && !cached.stale) return;
  await fetchAndCacheSourceEBookContent(route, chapterId).then(() => undefined);
}

export function ebookProviderIcon(providerId?: string): string | undefined {
  if (!providerId) return undefined;
  const source = listEBookSources().find((item) => item.id === providerId);
  if (!source) return undefined;
  if (source.kind === "gutendex") return gutenbergLogo;
  if (source.iconUrl) return source.iconUrl;
  return sourceFavicon(source.config?.baseUrl ?? source.location);
}

export function sourceFavicon(location?: string): string | undefined {
  if (!location) return undefined;
  try {
    return new URL("/favicon.ico", location).href;
  } catch {
    return undefined;
  }
}
