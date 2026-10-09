import { safeFetch } from "@/lib/safe-fetch";
import {
  MANGA_PAGE,
  mangaThrottle,
  type MangaChapter,
  type MangaProvider,
  type MangaSummary,
} from "@/lib/manga/types";

export type HtmlSelectorSet = {
  item: string;
  title?: string;
  link: string;
  cover?: string;
};

export type HtmlSourceConfig = {
  name: string;
  iconUrl?: string;
  baseUrl: string;
  popularPath: string;
  searchPath: string;
  pageStart?: number;
  itemsPerPage?: number;
  list: HtmlSelectorSet;
  detail?: {
    title?: string;
    cover?: string;
    description?: string;
    author?: string;
    status?: string;
  };
  chapters: {
    item: string;
    link: string;
    number?: string;
    title?: string;
    date?: string;
    listUrl?: { match: string; replace: string };
  };
  pages: { image: string; pathSuffix?: string };
  headers?: Record<string, string>;
};

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function parseHtmlConfig(raw: string): HtmlSourceConfig | null {
  let o: any;
  try {
    o = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const name = str(o.name);
  const baseUrl = str(o.baseUrl);
  const popularPath = str(o.popularPath);
  const list = o.list && typeof o.list === "object" ? o.list : null;
  const chapters = o.chapters && typeof o.chapters === "object" ? o.chapters : null;
  const pages = o.pages && typeof o.pages === "object" ? o.pages : null;
  if (!baseUrl || !/^https?:\/\//i.test(baseUrl)) return null;
  if (!popularPath || !list || !str(list.item) || !str(list.link)) return null;
  if (!chapters || !str(chapters.item) || !str(chapters.link)) return null;
  if (!pages || !str(pages.image)) return null;
  const headers =
    o.headers && typeof o.headers === "object"
      ? Object.fromEntries(
          Object.entries(o.headers)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [String(k), String(v)]),
        )
      : undefined;
  let host = baseUrl;
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    /* keep baseUrl */
  }
  return {
    name: name || host,
    iconUrl: str(o.iconUrl),
    baseUrl: baseUrl.replace(/\/+$/, ""),
    popularPath,
    searchPath: str(o.searchPath) || popularPath,
    pageStart: typeof o.pageStart === "number" ? o.pageStart : 1,
    itemsPerPage:
      typeof o.itemsPerPage === "number" && o.itemsPerPage > 0 ? o.itemsPerPage : MANGA_PAGE,
    list: {
      item: str(list.item)!,
      title: str(list.title),
      link: str(list.link)!,
      cover: str(list.cover),
    },
    detail:
      o.detail && typeof o.detail === "object"
        ? {
            title: str(o.detail.title),
            cover: str(o.detail.cover),
            description: str(o.detail.description),
            author: str(o.detail.author),
            status: str(o.detail.status),
          }
        : undefined,
    chapters: {
      item: str(chapters.item)!,
      link: str(chapters.link)!,
      number: str(chapters.number),
      title: str(chapters.title),
      date: str(chapters.date),
      listUrl:
        chapters.listUrl &&
        typeof chapters.listUrl === "object" &&
        str(chapters.listUrl.match)
          ? {
              match: str(chapters.listUrl.match)!,
              replace: typeof chapters.listUrl.replace === "string" ? chapters.listUrl.replace : "",
            }
          : undefined,
    },
    pages: { image: str(pages.image)!, pathSuffix: str(pages.pathSuffix) },
    headers,
  };
}

function selectorOf(spec: string): string {
  return spec.split("@")[0].trim();
}

export async function resolveFavicon(baseUrl: string): Promise<string | undefined> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return undefined;
  }
  const fallback = `${origin}/favicon.ico`;
  try {
    const res = await Promise.race([
      safeFetch(baseUrl),
      new Promise<Response>((_, reject) =>
        window.setTimeout(() => reject(new Error("favicon timeout")), 4000),
      ),
    ]);
    if (!res.ok) return fallback;
    const doc = new DOMParser().parseFromString(await res.text(), "text/html");
    const links = Array.from(
      doc.querySelectorAll<HTMLLinkElement>(
        'link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
      ),
    ).filter((l) => l.getAttribute("href"));
    const svg = links.find((l) => (l.getAttribute("href") ?? "").toLowerCase().includes(".svg"));
    const apple = links.find((l) => (l.getAttribute("rel") ?? "").includes("apple-touch"));
    const href = (svg ?? apple ?? links[0])?.getAttribute("href");
    if (!href) return fallback;
    try {
      return new URL(href, origin).href;
    } catch {
      return fallback;
    }
  } catch {
    return fallback;
  }
}

export function makeHtmlProvider(id: string, config: HtmlSourceConfig): MangaProvider {
  const throttle = mangaThrottle(350);
  const base = config.baseUrl;
  const start = config.pageStart ?? 1;

  function abs(href: string | undefined): string | undefined {
    if (!href) return undefined;
    try {
      return new URL(href, base + "/").href;
    } catch {
      return undefined;
    }
  }

  function target(idOrPath: string): string {
    if (/^https?:\/\//i.test(idOrPath)) return idOrPath;
    return base + (idOrPath.startsWith("/") ? idOrPath : "/" + idOrPath);
  }

  async function fetchDoc(url: string): Promise<Document | null> {
    return throttle(async () => {
      try {
        const res = await safeFetch(url, config.headers ? { headers: config.headers } : undefined);
        if (!res.ok) return null;
        const html = await res.text();
        return new DOMParser().parseFromString(html, "text/html");
      } catch {
        return null;
      }
    });
  }

  function pick(root: ParentNode, spec: string | undefined): string | undefined {
    if (!spec) return undefined;
    for (const alt of spec.split("|")) {
      const [selPart, attr] = alt.split("@");
      const sel = selPart.trim();
      const el = sel ? root.querySelector(sel) : (root as Element);
      if (!el) continue;
      const val = attr ? el.getAttribute(attr.trim()) : el.textContent;
      const clean = val ? val.replace(/\s+/g, " ").trim() : "";
      if (clean) return clean;
    }
    return undefined;
  }

  function toSummary(el: Element): MangaSummary | null {
    const link = pick(el, config.list.link);
    if (!link) return null;
    const title = pick(el, config.list.title) ?? pick(el, selectorOf(config.list.link)) ?? link;
    return { id: link, title: title || link, cover: abs(pick(el, config.list.cover)) };
  }

  async function collect(path: string, seen: Set<string>, out: MangaSummary[]): Promise<number> {
    const doc = await fetchDoc(target(path));
    if (!doc) return -1;
    const els = Array.from(doc.querySelectorAll(config.list.item));
    for (const el of els) {
      const m = toSummary(el);
      if (m && !seen.has(m.id)) {
        seen.add(m.id);
        out.push(m);
      }
    }
    return els.length;
  }

  async function listWindow(
    pathTemplate: string,
    offset: number,
    query?: string,
  ): Promise<MangaSummary[]> {
    const q = encodeURIComponent(query ?? "");
    const out: MangaSummary[] = [];
    const seen = new Set<string>();
    if (pathTemplate.includes("{offset}")) {
      let raw = 0;
      for (let guard = 0; guard < 12 && out.length < MANGA_PAGE; guard++) {
        const before = out.length;
        const count = await collect(
          pathTemplate.replace(/\{offset\}/g, String(offset + raw)).replace(/\{query\}/g, q),
          seen,
          out,
        );
        if (count <= 0 || out.length === before) break;
        raw += count;
      }
      return out.slice(0, MANGA_PAGE);
    }
    const page = start + Math.floor(offset / MANGA_PAGE);
    await collect(
      pathTemplate.replace(/\{page\}/g, String(page)).replace(/\{query\}/g, q),
      seen,
      out,
    );
    return out;
  }

  async function popular(offset: number): Promise<MangaSummary[]> {
    return listWindow(config.popularPath, offset);
  }

  async function search(query: string, offset: number): Promise<MangaSummary[]> {
    const q = query.trim();
    if (!q) return popular(offset);
    return listWindow(config.searchPath, offset, q);
  }

  async function detail(mangaId: string): Promise<MangaSummary | null> {
    const doc = await fetchDoc(target(mangaId));
    if (!doc) return null;
    const d = config.detail;
    return {
      id: mangaId,
      title: (d && pick(doc, d.title)) || mangaId,
      cover: abs(d && pick(doc, d.cover)),
      description: d ? pick(doc, d.description) : undefined,
      author: d ? pick(doc, d.author) : undefined,
      status: d ? pick(doc, d.status) : undefined,
    };
  }

  function chapterListUrl(mangaId: string): string {
    const lu = config.chapters.listUrl;
    if (!lu) return mangaId;
    try {
      return mangaId.replace(new RegExp(lu.match), lu.replace);
    } catch {
      return mangaId;
    }
  }

  async function chapters(mangaId: string): Promise<MangaChapter[]> {
    const doc = await fetchDoc(target(chapterListUrl(mangaId)));
    if (!doc) return [];
    const out: MangaChapter[] = [];
    const seen = new Set<string>();
    for (const el of Array.from(doc.querySelectorAll(config.chapters.item))) {
      const link = pick(el, config.chapters.link);
      if (!link || seen.has(link)) continue;
      seen.add(link);
      const numRaw = pick(el, config.chapters.number) ?? pick(el, selectorOf(config.chapters.link));
      const num = numRaw ? (numRaw.match(/[\d.]+/)?.[0] ?? numRaw) : null;
      out.push({
        id: link,
        chapter: num,
        title: pick(el, config.chapters.title),
        pages: 0,
        language: "en",
        publishAt: pick(el, config.chapters.date),
      });
    }
    return out;
  }

  async function pageUrls(chapterId: string): Promise<string[]> {
    const doc = await fetchDoc(target(chapterId) + (config.pages.pathSuffix ?? ""));
    if (!doc) return [];
    const sel = selectorOf(config.pages.image);
    const attr = config.pages.image.includes("@") ? config.pages.image.split("@")[1].trim() : "src";
    return Array.from(doc.querySelectorAll(sel))
      .map((el) => abs(el.getAttribute(attr) || el.getAttribute("src") || undefined))
      .filter((u): u is string => !!u);
  }

  return { id, name: config.name, popular, search, detail, chapters, pageUrls };
}
