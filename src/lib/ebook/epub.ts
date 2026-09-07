import { unzip } from "@/lib/unzip";

export type EpubChapter = { path: string; title: string };
export type EpubBook = {
  title: string;
  authors: string[];
  description: string;
  subjects: string[];
  language?: string;
  year?: number;
  cover?: string;
  chapters: EpubChapter[];
  entries: Map<string, Uint8Array>;
  chapterContents?: Map<string, string>;
};

const decoder = new TextDecoder();

function decode(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  return decoder.decode(bytes);
}

function element(document: Document, name: string): Element | undefined {
  return Array.from(document.getElementsByTagName("*")).find((item) => item.localName === name);
}

function elements(document: Document, name: string): Element[] {
  return Array.from(document.getElementsByTagName("*")).filter((item) => item.localName === name);
}

function archivePath(base: string, href: string): string {
  const path = new URL(href.split("#")[0], `https://epub.invalid/${base}`).pathname.slice(1);
  try {
    return decodeURIComponent(path);
  } catch {
    return path;
  }
}

function entry(entries: Map<string, Uint8Array>, path: string): Uint8Array | undefined {
  const normalized = path.replaceAll("\\", "/").replace(/^\.\//, "");
  return (
    entries.get(normalized) ??
    [...entries].find(([name]) => name.toLowerCase() === normalized.toLowerCase())?.[1]
  );
}

function xml(bytes?: Uint8Array): Document | null {
  return bytes ? new DOMParser().parseFromString(decode(bytes), "application/xml") : null;
}

function contentDocument(bytes?: Uint8Array): Document | null {
  if (!bytes) return null;
  const source = decode(bytes);
  const document = new DOMParser().parseFromString(source, "application/xml");
  return element(document, "parsererror")
    ? new DOMParser().parseFromString(source, "text/html")
    : document;
}

function metadata(document: Document, name: string): string[] {
  return elements(document, name)
    .map((item) => item.textContent?.replace(/\s+/g, " ").trim())
    .filter((value): value is string => !!value);
}

function dataUrl(bytes: Uint8Array, mediaType: string): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return `data:${mediaType};base64,${btoa(binary)}`;
}

type NavigationLink = { path: string; fragment: string; title: string };
type ChapterTarget = NavigationLink & { node: Element };
const ignoredNames = new Set(["script", "style", "noscript", "nav", "form", "svg"]);
const blockNames = new Set([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "blockquote",
  "li",
  "pre",
  "div",
  "section",
  "article",
  "header",
  "footer",
  "aside",
  "table",
  "tr",
]);

function decoded(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function navigationLink(base: string, href: string, title: string): NavigationLink[] {
  if (!title.trim()) return [];
  try {
    const target = new URL(href, `https://epub.invalid/${base}`);
    if (target.origin !== "https://epub.invalid") return [];
    return [
      {
        path: decoded(target.pathname.slice(1)),
        fragment: decoded(target.hash.slice(1)),
        title: title.replace(/\s+/g, " ").trim(),
      },
    ];
  } catch {
    return [];
  }
}

function navigationLinks(
  document: Document | null,
  path: string,
  ncx = false,
): NavigationLink[] {
  if (!document) return [];
  if (ncx)
    return elements(document, "navPoint").flatMap((point) => {
      const children = Array.from(point.children);
      const href = children.find((item) => item.localName === "content")?.getAttribute("src");
      const title = children.find((item) => item.localName === "navLabel")?.textContent ?? "";
      return href ? navigationLink(path, href, title) : [];
    });
  return elements(document, "nav")
    .filter((item) => {
      const type =
        item.getAttributeNS("http://www.idpf.org/2007/ops", "type") ??
        item.getAttribute("epub:type") ??
        "";
      return (
        type.split(/\s+/).includes("toc") ||
        (item.getAttribute("role") ?? "").split(/\s+/).includes("doc-toc")
      );
    })
    .flatMap((nav) => Array.from(nav.getElementsByTagName("*")))
    .filter((item) => item.localName === "a" && item.hasAttribute("href"))
    .flatMap((item) => navigationLink(path, item.getAttribute("href")!, item.textContent ?? ""));
}

function chapterRoot(document: Document): Element {
  return element(document, "body") ?? document.documentElement;
}

function targetNode(document: Document, fragment: string): Element | undefined {
  const root = chapterRoot(document);
  if (!fragment) return root;
  let target = [root, ...Array.from(root.getElementsByTagName("*"))].find(
    (item) =>
      item.getAttribute("id") === fragment ||
      item.getAttribute("xml:id") === fragment ||
      (item.localName === "a" && item.getAttribute("name") === fragment),
  );
  for (let node = target; node; node = node.parentElement ?? undefined) {
    if (ignoredNames.has(node.localName.toLowerCase())) return undefined;
    if (/^h[1-6]$/i.test(node.localName)) target = node;
    if (node === root) break;
  }
  return target;
}

function documentSections(
  document: Document,
  targets: Map<Element, ChapterTarget> = new Map(),
): Array<{ target?: ChapterTarget; text: string }> {
  const sections: Array<{ target?: ChapterTarget; text: string }> = [];
  let target: ChapterTarget | undefined;
  let chunks: string[] = [];
  const flush = () => {
    sections.push({
      target,
      text: chunks
        .join("")
        .replace(/[\t ]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    });
    chunks = [];
  };
  const visit = (node: Node, preserve = false): void => {
    if (node.nodeType === 3 || node.nodeType === 4) {
      chunks.push(
        preserve ? node.textContent ?? "" : (node.textContent ?? "").replace(/\s+/g, " "),
      );
      return;
    }
    if (node.nodeType !== 1) return;
    const item = node as Element;
    const name = item.localName.toLowerCase();
    if (ignoredNames.has(name)) return;
    const next = targets.get(item);
    if (next) {
      flush();
      target = next;
    }
    const block = blockNames.has(name);
    if (block) chunks.push("\n\n");
    if (name === "br") chunks.push("\n");
    else for (const child of Array.from(node.childNodes)) visit(child, preserve || name === "pre");
    if (block) chunks.push("\n\n");
  };
  visit(chapterRoot(document));
  flush();
  return sections;
}

export async function parseEpub(buffer: ArrayBuffer): Promise<EpubBook> {
  const entries = await unzip(buffer);
  const container = xml(entry(entries, "META-INF/container.xml"));
  const packagePath = container && element(container, "rootfile")?.getAttribute("full-path");
  if (!packagePath) throw new Error("EPUB package document is missing");
  const packageDocument = xml(entry(entries, packagePath));
  if (!packageDocument) throw new Error("EPUB package document could not be read");
  const packageBase = packagePath.includes("/")
    ? packagePath.slice(0, packagePath.lastIndexOf("/") + 1)
    : "";
  const manifest = new Map(
    elements(packageDocument, "item").flatMap((item) => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      return id && href
        ? [
            [
              id,
              {
                path: archivePath(packageBase, href),
                mediaType: item.getAttribute("media-type") ?? "",
                properties: item.getAttribute("properties") ?? "",
              },
            ] as const,
          ]
        : [];
    }),
  );
  const nav = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const ncx = [...manifest.values()].find((item) => item.mediaType === "application/x-dtbncx+xml");
  const spine = elements(packageDocument, "itemref")
    .filter((item) => item.getAttribute("linear")?.toLowerCase() !== "no")
    .map((item) => manifest.get(item.getAttribute("idref") ?? ""))
    .filter(
      (item): item is NonNullable<typeof item> =>
        !!item &&
        /xhtml|html/.test(item.mediaType) &&
        !item.properties.split(/\s+/).includes("nav"),
    );
  const documents = spine.length
    ? spine
    : [...manifest.values()].filter(
        (item) => /xhtml|html/.test(item.mediaType) && !item.properties.split(/\s+/).includes("nav"),
      );
  const scanned = documents.map((item, index) => {
    const document = contentDocument(entry(entries, item.path));
    const heading = document
      ? ["h1", "h2", "h3", "title"]
          .flatMap((name) => elements(document, name))
          .find((item) => item.textContent?.trim())
          ?.textContent?.trim()
      : undefined;
    const words = document?.documentElement?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    return {
      path: item.path,
      title: heading || `Chapter ${index + 1}`,
      readable: words.length > 24,
      document,
    };
  });
  const resolveTargets = (links: NavigationLink[]): ChapterTarget[] => {
    const seen = new Set<Element>();
    return links.flatMap((link) => {
      const item = scanned.find((item) => item.path.toLowerCase() === link.path.toLowerCase());
      const node = item?.document ? targetNode(item.document, link.fragment) : undefined;
      if (!node || !item || seen.has(node)) return [];
      seen.add(node);
      return [{ ...link, path: item.path, node }];
    });
  };
  let targets = nav
    ? resolveTargets(navigationLinks(contentDocument(entry(entries, nav.path)), nav.path))
    : [];
  if (!targets.length && ncx)
    targets = resolveTargets(navigationLinks(xml(entry(entries, ncx.path)), ncx.path, true));
  const readable = scanned.filter((item) => item.readable);
  let chapters = (readable.length ? readable : scanned).map(({ path, title }) => ({
    path,
    title,
  }));
  const chapterContents = new Map<string, string>();
  if (targets.length) {
    const boundaries = new Map(targets.map((target) => [target.node, target]));
    const drafts: Array<EpubChapter & { parts: string[] }> = [];
    let active: (typeof drafts)[number] | undefined;
    for (const item of scanned) {
      if (!item.document) continue;
      for (const section of documentSections(item.document, boundaries)) {
        if (section.target) {
          active = {
            path: `${section.target.path}#${encodeURIComponent(section.target.fragment)}`,
            title: section.target.title,
            parts: [],
          };
          drafts.push(active);
        }
        if (!section.text) continue;
        if (!active) {
          active = { path: `${item.path}#`, title: item.title, parts: [] };
          drafts.push(active);
        }
        active.parts.push(section.text);
      }
    }
    chapters = drafts.filter((item) => item.parts.length).map(({ path, title, parts }) => {
      chapterContents.set(path, parts.join("\n\n"));
      return { path, title };
    });
  }
  const coverId = elements(packageDocument, "meta")
    .find((item) => item.getAttribute("name")?.toLowerCase() === "cover")
    ?.getAttribute("content");
  const coverItem = [...manifest.entries()].find(
    ([id, item]) =>
      item.mediaType.startsWith("image/") &&
      (id === coverId || item.properties.split(/\s+/).includes("cover-image") || /cover/i.test(id)),
  )?.[1];
  const coverBytes = coverItem && entry(entries, coverItem.path);
  const date = metadata(packageDocument, "date")[0];
  return {
    title: metadata(packageDocument, "title")[0] || "Untitled eBook",
    authors: metadata(packageDocument, "creator"),
    description: metadata(packageDocument, "description")[0] ?? "",
    subjects: metadata(packageDocument, "subject"),
    language: metadata(packageDocument, "language")[0],
    year: date ? Number(date.match(/\d{4}/)?.[0]) || undefined : undefined,
    cover:
      coverBytes && coverItem
        ? dataUrl(coverBytes, coverItem.mediaType || "image/jpeg")
        : undefined,
    chapters,
    entries,
    chapterContents,
  };
}

export function legacyEpubChapterTitle(book: EpubBook, path: string): string | undefined {
  const container = xml(entry(book.entries, "META-INF/container.xml"));
  const packagePath = container && element(container, "rootfile")?.getAttribute("full-path");
  if (!packagePath) return undefined;
  const packageDocument = xml(entry(book.entries, packagePath));
  if (!packageDocument) return undefined;
  const packageBase = packagePath.replace(/[^/]*$/, "");
  const manifest = new Map(
    elements(packageDocument, "item").flatMap((item) => {
      const id = item.getAttribute("id");
      const href = item.getAttribute("href");
      return id && href
        ? [
            [
              id,
              {
                path: archivePath(packageBase, href),
                mediaType: item.getAttribute("media-type") ?? "",
                properties: item.getAttribute("properties") ?? "",
              },
            ] as const,
          ]
        : [];
    }),
  );
  const nav = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const ncx = [...manifest.values()].find((item) => item.mediaType === "application/x-dtbncx+xml");
  const navigation = xml(entry(book.entries, nav?.path ?? ncx?.path ?? ""));
  let title: string | undefined;
  if (navigation) {
    const pageListLinks = new Set(
      elements(navigation, "nav")
        .filter((item) => /page-list/i.test(item.getAttribute("epub:type") ?? ""))
        .flatMap((item) =>
          Array.from(item.getElementsByTagName("*")).filter((node) => node.localName === "a"),
        ),
    );
    for (const link of elements(navigation, "a").filter((item) => item.hasAttribute("href"))) {
      if (pageListLinks.has(link)) continue;
      const target = archivePath(
        (nav?.path ?? "").replace(/[^/]*$/, ""),
        link.getAttribute("href")!,
      );
      const label = link.textContent?.trim() ?? "";
      if (target === path && label && !title) title = label;
    }
    for (const point of elements(navigation, "navPoint")) {
      const descendants = Array.from(point.getElementsByTagName("*"));
      const href = descendants.find((item) => item.localName === "content")?.getAttribute("src");
      const label = descendants.find((item) => item.localName === "text")?.textContent?.trim();
      if (href && label && archivePath((ncx?.path ?? "").replace(/[^/]*$/, ""), href) === path)
        title = label;
    }
  }
  if (title) return title;
  const document = contentDocument(entry(book.entries, path));
  const heading = document
    ? ["h1", "h2", "h3", "title"]
        .flatMap((name) => elements(document, name))
        .find((item) => item.textContent?.trim())
        ?.textContent?.trim()
    : undefined;
  if (heading) return heading;
  const spine = elements(packageDocument, "itemref")
    .filter((item) => item.getAttribute("linear")?.toLowerCase() !== "no")
    .map((item) => manifest.get(item.getAttribute("idref") ?? ""))
    .filter(
      (item): item is NonNullable<typeof item> =>
        !!item &&
        /xhtml|html/.test(item.mediaType) &&
        !item.properties.split(/\s+/).includes("nav"),
    );
  const documents = spine.length
    ? spine
    : [...manifest.values()].filter((item) => /xhtml|html/.test(item.mediaType));
  const index = documents.findIndex((item) => item.path === path);
  return index >= 0 ? `Chapter ${index + 1}` : undefined;
}

export function readEpubChapter(book: EpubBook, path: string): string {
  const content = book.chapterContents?.get(path);
  if (content !== undefined) return content;
  const document = contentDocument(entry(book.entries, path));
  if (!document) return "";
  const ignored = new Set(["script", "style", "noscript", "nav", "form", "svg"]);
  elements(document, "br").forEach((item) => item.replaceWith(document.createTextNode("\n")));
  Array.from(document.getElementsByTagName("*"))
    .filter((item) => ignored.has(item.localName.toLowerCase()))
    .forEach((item) => item.remove());
  const root = element(document, "body") ?? document.documentElement;
  const blockNames = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "blockquote", "li", "pre"]);
  const blocks = Array.from(root.getElementsByTagName("*"))
    .filter((item) => blockNames.has(item.localName.toLowerCase()))
    .filter(
      (item) =>
        !Array.from(item.getElementsByTagName("*")).some((child) =>
          blockNames.has(child.localName.toLowerCase()),
        ),
    )
    .map((item) =>
      item.textContent
        ?.replace(/[\t ]+/g, " ")
        .replace(/\n\s*/g, "\n")
        .trim(),
    )
    .filter((value): value is string => !!value);
  return (blocks.length ? blocks.join("\n\n") : (root.textContent ?? "")).trim();
}
