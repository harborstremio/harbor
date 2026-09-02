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
  const titles = new Map<string, string>();
  const nav = [...manifest.values()].find((item) => item.properties.split(/\s+/).includes("nav"));
  const ncx = [...manifest.values()].find((item) => item.mediaType === "application/x-dtbncx+xml");
  const navigation = xml(entry(entries, nav?.path ?? ncx?.path ?? ""));
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
      if (label && !titles.has(target)) titles.set(target, label);
    }
    for (const point of elements(navigation, "navPoint")) {
      const descendants = Array.from(point.getElementsByTagName("*"));
      const path = descendants.find((item) => item.localName === "content")?.getAttribute("src");
      const title = descendants.find((item) => item.localName === "text")?.textContent?.trim();
      if (path && title)
        titles.set(archivePath((ncx?.path ?? "").replace(/[^/]*$/, ""), path), title);
    }
  }
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
      title: titles.get(item.path) || heading || `Chapter ${index + 1}`,
      readable: words.length > 24,
    };
  });
  const readable = scanned.filter((item) => item.readable);
  const chapters = (readable.length ? readable : scanned).map(({ path, title }) => ({
    path,
    title,
  }));
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
  };
}

export function readEpubChapter(book: EpubBook, path: string): string {
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
