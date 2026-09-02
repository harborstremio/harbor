import { strToU8, zip, type Zippable } from "fflate";
import { downloadDir as systemDownloadDir } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import type { EBook } from "./api";
import { t } from "@/lib/i18n";
import { enqueueManagedDownload } from "@/lib/download/downloads-store";
import { safeFetch } from "@/lib/safe-fetch";
import {
  sourceEBookChapters,
  sourceEBookContent,
  type EBookChapter,
  type EBookChapterContent,
} from "./providers";

export type EBookExportFormat = "epub" | "pdf";
export type EBookExportProgress = {
  completed: number;
  total: number;
  percent: number;
  label: string;
  downloadedBytes: number;
  estimatedTotalBytes: number;
  bytesPerSecond: number;
  etaSeconds: number | null;
  phase: "discovering" | "downloading" | "packaging" | "saving" | "complete";
  indeterminate?: boolean;
};

type EBookExportOptions = {
  signal?: AbortSignal;
  destinationPath?: string;
};

type CoverAsset = { bytes: Uint8Array; mediaType: string; extension: string; dataUrl: string };

function abortError(): DOMException {
  return new DOMException(t("The eBook download was canceled."), "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

export function sourceRouteForEBook(ebook: EBook): string | null {
  if (ebook.source === "source" && ebook.id.startsWith("source:")) return ebook.id;
  return (
    ebook.books?.find((book) => book.source === "source" && book.id.startsWith("source:"))?.id ??
    null
  );
}

function fileName(value: string): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || t("Harbor eBook")
  );
}

function xml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function paragraphs(value: string): string {
  return value
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => `<p dir="auto">${xml(paragraph)}</p>`)
    .join("\n");
}

async function loadBook(
  ebook: EBook,
  onProgress?: (progress: EBookExportProgress) => void,
  signal?: AbortSignal,
): Promise<{ chapters: EBookChapter[]; contents: EBookChapterContent[] }> {
  const route = sourceRouteForEBook(ebook);
  if (!route) throw new Error(t("This eBook is not connected to an installed source."));
  throwIfAborted(signal);
  onProgress?.({
    completed: 0,
    total: 0,
    percent: 1,
    label: t("Loading chapter list…"),
    downloadedBytes: 0,
    estimatedTotalBytes: 0,
    bytesPerSecond: 0,
    etaSeconds: null,
    phase: "discovering",
    indeterminate: true,
  });
  const chapters = await sourceEBookChapters(route);
  throwIfAborted(signal);
  if (!chapters.length) throw new Error(t("This source did not provide any chapters."));
  onProgress?.({
    completed: 0,
    total: chapters.length,
    percent: 3,
    label: t("{count} chapters found", { count: chapters.length }),
    downloadedBytes: 0,
    estimatedTotalBytes: 0,
    bytesPerSecond: 0,
    etaSeconds: null,
    phase: "downloading",
  });
  const contents = new Array<EBookChapterContent>(chapters.length);
  let cursor = 0;
  let completed = 0;
  let downloadedBytes = 0;
  const startedAt = performance.now();
  const encoder = new TextEncoder();
  const worker = async () => {
    while (cursor < chapters.length) {
      throwIfAborted(signal);
      const index = cursor++;
      const chapter = chapters[index];
      // Export cached translations when present, but never block a full-book export on
      // one DeepSeek request per chapter. Translation remains an explicit reader action.
      contents[index] = await sourceEBookContent(route, chapter.id, chapter.title);
      throwIfAborted(signal);
      completed += 1;
      downloadedBytes += encoder.encode(JSON.stringify(contents[index])).byteLength;
      const elapsedSeconds = Math.max((performance.now() - startedAt) / 1_000, 0.001);
      const bytesPerSecond = downloadedBytes / elapsedSeconds;
      const estimatedTotalBytes = Math.max(
        downloadedBytes,
        Math.round((downloadedBytes / completed) * chapters.length),
      );
      onProgress?.({
        completed,
        total: chapters.length,
        percent: 3 + Math.round((completed / chapters.length) * 82),
        label: chapter.title,
        downloadedBytes,
        estimatedTotalBytes,
        bytesPerSecond,
        etaSeconds:
          bytesPerSecond > 0
            ? Math.max(0, (estimatedTotalBytes - downloadedBytes) / bytesPerSecond)
            : null,
        phase: "downloading",
      });
    }
  };
  await Promise.all(Array.from({ length: Math.min(3, chapters.length) }, () => worker()));
  return { chapters, contents };
}

function chapterXhtml(ebook: EBook, chapter: EBookChapter, content: EBookChapterContent): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"/>
<title>${xml(chapter.title)}</title><style>
body{font-family:serif;line-height:1.75;margin:5%;color:#171717}h1{font-size:1.55em;margin:0 0 1.4em}
p{margin:0 0 1em;text-align:start}img{display:block;max-width:100%;height:auto;margin:1em auto}
</style></head><body dir="auto"><h1>${xml(chapter.title || ebook.title)}</h1>
${paragraphs(content.text ?? "")}</body></html>`;
}

async function makeEpub(
  ebook: EBook,
  chapters: EBookChapter[],
  contents: EBookChapterContent[],
  cover?: CoverAsset | null,
): Promise<Uint8Array> {
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const chapterFiles = chapters.map(
    (_, index) => `chapter-${String(index + 1).padStart(5, "0")}.xhtml`,
  );
  const nav = chapters
    .map((chapter, index) => `<li><a href="${chapterFiles[index]}">${xml(chapter.title)}</a></li>`)
    .join("");
  const manifest = chapterFiles
    .map(
      (path, index) =>
        `<item id="c${index + 1}" href="${path}" media-type="application/xhtml+xml"/>`,
    )
    .join("\n");
  const spine = chapterFiles.map((_, index) => `<itemref idref="c${index + 1}"/>`).join("\n");
  const files: Zippable = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`),
    "EPUB/nav.xhtml": strToU8(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${xml(t("Contents"))}</title></head>
<body><nav epub:type="toc"><h1>${xml(t("Contents"))}</h1><ol>${nav}</ol></nav></body></html>`),
    "EPUB/package.opf": strToU8(`<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:identifier id="book-id">urn:harbor:${xml(ebook.id)}</dc:identifier><dc:title>${xml(ebook.title)}</dc:title>
${ebook.authors.map((author) => `<dc:creator>${xml(author)}</dc:creator>`).join("")}
<dc:language>und</dc:language><dc:description>${xml(ebook.description)}</dc:description>
${ebook.year ? `<dc:date>${ebook.year}</dc:date>` : ""}
<meta property="dcterms:modified">${modified}</meta></metadata>
<manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${cover ? `<item id="cover-image" href="cover.${cover.extension}" media-type="${cover.mediaType}" properties="cover-image"/><item id="cover-page" href="cover.xhtml" media-type="application/xhtml+xml"/>` : ""}${manifest}</manifest>
<spine>${cover ? '<itemref idref="cover-page" linear="yes"/>' : ""}${spine}</spine></package>`),
  };
  if (cover) {
    files[`EPUB/cover.${cover.extension}`] = cover.bytes;
    files["EPUB/cover.xhtml"] = strToU8(`<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${xml(ebook.title)}</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center}img{max-width:100%;max-height:100%}</style></head><body><img src="cover.${cover.extension}" alt="${xml(ebook.title)}"/></body></html>`);
  }
  chapters.forEach((chapter, index) => {
    files[`EPUB/${chapterFiles[index]}`] = strToU8(chapterXhtml(ebook, chapter, contents[index]));
  });
  return new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, bytes) => {
      if (error) reject(error);
      else resolve(bytes);
    });
  });
}

async function saveBytes(
  bytes: Uint8Array,
  name: string,
  destinationPath?: string,
): Promise<boolean> {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    const path =
      destinationPath ??
      (await (
        await import("@tauri-apps/plugin-dialog")
      ).save({
        defaultPath: name,
        filters: [{ name: t("EPUB eBook"), extensions: ["epub"] }],
      }));
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  const blob = new Blob([new Uint8Array(bytes).buffer as ArrayBuffer], {
    type: "application/epub+zip",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return true;
}

async function coverAsset(ebook: EBook, signal?: AbortSignal): Promise<CoverAsset | null> {
  const url = ebook.internalCover || ebook.cover;
  if (!url) return null;
  try {
    throwIfAborted(signal);
    const response = await safeFetch(url, { signal });
    if (!response.ok) return null;
    const mediaType = response.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!mediaType.startsWith("image/")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = mediaType.includes("png")
      ? "png"
      : mediaType.includes("webp")
        ? "webp"
        : "jpg";
    const blob = new Blob([bytes], { type: mediaType });
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { bytes, mediaType, extension, dataUrl };
  } catch (error) {
    if (signal?.aborted) throw abortError();
    return null;
  }
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

async function printPdf(
  ebook: EBook,
  chapters: EBookChapter[],
  contents: EBookChapterContent[],
  onProgress?: (progress: EBookExportProgress) => void,
  signal?: AbortSignal,
  cover?: CoverAsset | null,
): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;inset:auto 0 0 auto;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);
  const documentRef = iframe.contentDocument;
  if (!documentRef) {
    iframe.remove();
    throw new Error(t("The PDF print view could not be created."));
  }
  documentRef.open();
  documentRef.write(`<!doctype html><html><head><meta charset="utf-8"><title>${xml(ebook.title)}</title>
<style>*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#171717}main{max-width:760px;margin:auto;font:17px/1.8 Georgia,"Noto Naskh Arabic","Segoe UI",serif}header{min-height:92vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;page-break-after:always}header img{max-width:280px;max-height:420px;object-fit:contain;margin-bottom:28px}header .summary{max-width:620px;font-size:14px;color:#444}h1{font-size:36px;margin:0 0 8px}h2{font-size:25px;margin:0 0 1.5em}p{margin:0 0 1em;text-align:start}section{page-break-before:always}@page{size:A4;margin:18mm}</style>
</head><body><main dir="auto"><header>${cover ? `<img src="${cover.dataUrl}" alt="${xml(ebook.title)}"/>` : ""}<h1>${xml(ebook.title)}</h1><p>${xml(ebook.authors.join(", "))}${ebook.year ? ` · ${ebook.year}` : ""}</p>${ebook.description ? `<p class="summary">${xml(ebook.description)}</p>` : ""}</header><div id="harbor-pdf-content"></div></main></body></html>`);
  documentRef.close();
  const root = documentRef.getElementById("harbor-pdf-content");
  if (!root) {
    iframe.remove();
    throw new Error(t("The PDF print content could not be created."));
  }
  const totalBytes = contents.reduce(
    (total, content) => total + new TextEncoder().encode(JSON.stringify(content)).byteLength,
    0,
  );
  const batchSize = 12;
  const startedAt = performance.now();
  for (let start = 0; start < chapters.length; start += batchSize) {
    throwIfAborted(signal);
    const end = Math.min(start + batchSize, chapters.length);
    const batch = chapters
      .slice(start, end)
      .map(
        (chapter, offset) =>
          `<section><h2>${xml(chapter.title)}</h2>${paragraphs(contents[start + offset].text ?? "")}</section>`,
      )
      .join("");
    root.insertAdjacentHTML("beforeend", batch);
    const completed = end;
    const elapsed = Math.max((performance.now() - startedAt) / 1_000, 0.001);
    const rate = completed / elapsed;
    onProgress?.({
      completed,
      total: chapters.length,
      percent: 85 + Math.round((completed / chapters.length) * 14),
      label: t("Preparing PDF {completed}/{total}", { completed, total: chapters.length }),
      downloadedBytes: totalBytes,
      estimatedTotalBytes: totalBytes,
      bytesPerSecond: 0,
      etaSeconds: rate > 0 ? Math.max(0, (chapters.length - completed) / rate) : null,
      phase: "packaging",
    });
    await nextFrame();
  }
  await nextFrame();
  const windowRef = iframe.contentWindow;
  const cleanup = () => window.setTimeout(() => iframe.remove(), 400);
  windowRef?.addEventListener("afterprint", cleanup, { once: true });
  window.setTimeout(() => {
    windowRef?.focus();
    windowRef?.print();
    window.setTimeout(cleanup, 60_000);
  }, 180);
}

export async function exportEBookForOffline(
  ebook: EBook,
  format: EBookExportFormat,
  onProgress?: (progress: EBookExportProgress) => void,
  options: EBookExportOptions = {},
): Promise<boolean> {
  const { signal, destinationPath } = options;
  throwIfAborted(signal);
  const { chapters, contents } = await loadBook(ebook, onProgress, signal);
  const cover = await coverAsset(ebook, signal);
  if (format === "pdf") {
    await printPdf(ebook, chapters, contents, onProgress, signal, cover);
    const downloadedBytes = contents.reduce(
      (total, content) => total + new TextEncoder().encode(JSON.stringify(content)).byteLength,
      0,
    );
    onProgress?.({
      completed: chapters.length,
      total: chapters.length,
      percent: 100,
      label: t("PDF print view ready"),
      downloadedBytes,
      estimatedTotalBytes: downloadedBytes,
      bytesPerSecond: 0,
      etaSeconds: 0,
      phase: "complete",
    });
    return true;
  }
  onProgress?.({
    completed: chapters.length,
    total: chapters.length,
    percent: 88,
    label: t("Building EPUB"),
    downloadedBytes: contents.reduce(
      (total, content) => total + new TextEncoder().encode(JSON.stringify(content)).byteLength,
      0,
    ),
    estimatedTotalBytes: 0,
    bytesPerSecond: 0,
    etaSeconds: null,
    phase: "packaging",
    indeterminate: true,
  });
  const bytes = await makeEpub(ebook, chapters, contents, cover);
  throwIfAborted(signal);
  onProgress?.({
    completed: chapters.length,
    total: chapters.length,
    percent: 96,
    label: t("Saving EPUB"),
    downloadedBytes: bytes.byteLength,
    estimatedTotalBytes: bytes.byteLength,
    bytesPerSecond: 0,
    etaSeconds: 0,
    phase: "saving",
  });
  const saved = await saveBytes(bytes, `${fileName(ebook.title)}.epub`, destinationPath);
  if (saved) {
    onProgress?.({
      completed: chapters.length,
      total: chapters.length,
      percent: 100,
      label: t("EPUB saved"),
      downloadedBytes: bytes.byteLength,
      estimatedTotalBytes: bytes.byteLength,
      bytesPerSecond: 0,
      etaSeconds: 0,
      phase: "complete",
    });
  }
  return saved;
}

function pathSeparator(): string {
  return navigator.userAgent.includes("Windows") ? "\\" : "/";
}

async function uniqueExportPath(path: string): Promise<string> {
  if (!(await exists(path).catch(() => false))) return path;
  const separator = pathSeparator();
  const slash = path.lastIndexOf(separator);
  const directory = slash >= 0 ? path.slice(0, slash + 1) : "";
  const file = slash >= 0 ? path.slice(slash + 1) : path;
  const dot = file.lastIndexOf(".");
  const stem = dot > 0 ? file.slice(0, dot) : file;
  const extension = dot > 0 ? file.slice(dot) : "";
  for (let index = 2; index < 1_000; index++) {
    const candidate = `${directory}${stem} (${index})${extension}`;
    if (!(await exists(candidate).catch(() => false))) return candidate;
  }
  return path;
}

async function eBookExportPath(ebook: EBook, format: EBookExportFormat): Promise<string> {
  let settings: {
    downloadDir?: string;
    ebookDownloadDir?: string;
    ebookDownloadCreateFolders?: boolean;
  } = {};
  try {
    settings = JSON.parse(localStorage.getItem("harbor.settings") ?? "{}");
  } catch {}
  let directory =
    settings.ebookDownloadDir?.trim() ||
    settings.downloadDir?.trim() ||
    (await systemDownloadDir().catch(() => ""));
  const separator = pathSeparator();
  if (settings.ebookDownloadCreateFolders && directory) {
    directory = `${directory}${directory.endsWith(separator) ? "" : separator}${fileName(ebook.title)}`;
    await mkdir(directory, { recursive: true });
  }
  const name = `${fileName(ebook.title)}.${format}`;
  return uniqueExportPath(
    directory ? `${directory}${directory.endsWith(separator) ? "" : separator}${name}` : name,
  );
}

export async function enqueueEBookExport(ebook: EBook, format: EBookExportFormat): Promise<string> {
  const path = await eBookExportPath(ebook, format);
  return enqueueManagedDownload({
    metaId: ebook.id,
    title: ebook.title,
    subtitle: `${format.toUpperCase()}${ebook.authors[0] ? ` · ${ebook.authors[0]}` : ""}`,
    poster: ebook.internalCover || ebook.cover || null,
    path,
    format,
    author: ebook.authors.join(", ") || null,
    publishedYear: ebook.year ?? null,
    summary: ebook.description || null,
    run: async (signal, update) => {
      const saved = await exportEBookForOffline(
        ebook,
        format,
        (progress) =>
          update({
            receivedBytes: progress.downloadedBytes,
            totalBytes: progress.estimatedTotalBytes || null,
            ratio: progress.percent / 100,
            bytesPerSec: progress.bytesPerSecond,
            etaSeconds: progress.etaSeconds,
            label: progress.label,
          }),
        { signal, destinationPath: format === "epub" ? path : undefined },
      );
      if (!saved) throw new Error(t("The eBook export was canceled."));
    },
  });
}
