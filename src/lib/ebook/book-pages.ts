import type { EBookChapterContent } from "./providers";
import { ebookBookPageCacheGet, ebookBookPageCachePut } from "./cache";

export type EBookFlipPages = { urls: string[]; paragraphStarts: number[] };
const WIDTH = 1200;
const HEIGHT = 1600;
const PAD_X = 118;
const PAD_Y = 124;
const ABORT_GRACE_MS = 75;

type Options = {
  content: EBookChapterContent;
  title: string;
  direction: "ltr" | "rtl";
  page: string;
  ink: string;
  muted: string;
  fontFamily: string;
  fontCacheKey?: string;
  fontSize: number;
  lineHeight: number;
  cover?: string;
  signal?: AbortSignal;
};

type GeneratedPages = { blobs: Blob[]; paragraphStarts: number[] };
type PageJob = {
  promise: Promise<GeneratedPages>;
  controller: AbortController;
  consumers: number;
  abortTimer?: number;
};

const pending = new Map<string, PageJob>();

function abortError(): DOMException {
  return new DOMException("Book page generation was cancelled", "AbortError");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function hash(value: string): string {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16777619);
  }
  return `${value.length}:${result >>> 0}`;
}

function pageCacheKey(options: Options): string {
  return [
    "v2",
    hash(options.content.text ?? ""),
    hash(options.title),
    options.direction,
    options.page,
    options.ink,
    options.muted,
    options.fontCacheKey || hash(options.fontFamily),
    options.fontSize,
    options.lineHeight,
  ].join(":");
}

function canvasBlob(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<Blob> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (signal.aborted) reject(abortError());
      else if (blob) resolve(blob);
      else reject(new Error("Book page image encoding failed"));
    }, "image/png"),
  );
}

function wrap(
  text: string,
  measure: (value: string) => number,
  width: number,
  signal: AbortSignal,
): string[] {
  const lines: string[] = [];
  let line = "";
  let position = 0;
  for (const word of text.trim().split(/\s+/).filter(Boolean)) {
    if (position++ % 64 === 0) throwIfAborted(signal);
    const next = line ? `${line} ${word}` : word;
    if (!line || measure(next) <= width) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function generate(options: Options, signal: AbortSignal): Promise<GeneratedPages> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) return { blobs: [], paragraphStarts: [] };
  const bodySize = Math.round(options.fontSize * 1.72);
  const rowHeight = Math.round(bodySize * options.lineHeight);
  const rowsPerPage = Math.max(8, Math.floor((HEIGHT - PAD_Y * 2) / rowHeight));
  try {
    await document.fonts.load(`${bodySize}px ${options.fontFamily}`);
  } catch {
    /* The declared fallback family remains available. */
  }
  throwIfAborted(signal);
  context.font = `${bodySize}px ${options.fontFamily}`;
  const paragraphs = (options.content.text ?? "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((value) => value.replace(/\n/g, " ").trim())
    .filter(Boolean);
  const rows: Array<{ text: string; paragraph: number }> = [];
  for (const [paragraph, text] of paragraphs.entries()) {
    throwIfAborted(signal);
    for (const line of wrap(
      text,
      (value) => context.measureText(value).width,
      WIDTH - PAD_X * 2,
      signal,
    ))
      rows.push({ text: line, paragraph });
    rows.push({ text: "", paragraph });
  }
  const blobs: Blob[] = [];
  const paragraphStarts: number[] = [];
  for (let offset = 0; offset < rows.length; offset += rowsPerPage) {
    throwIfAborted(signal);
    const pageRows = rows.slice(offset, offset + rowsPerPage);
    context.fillStyle = options.page;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    const gutter = context.createLinearGradient(0, 0, WIDTH, 0);
    gutter.addColorStop(options.direction === "rtl" ? 0.94 : 0.06, "rgba(0,0,0,.13)");
    gutter.addColorStop(options.direction === "rtl" ? 0.72 : 0.28, "rgba(0,0,0,0)");
    context.fillStyle = gutter;
    context.fillRect(0, 0, WIDTH, HEIGHT);
    context.direction = options.direction;
    context.textAlign = options.direction === "rtl" ? "right" : "left";
    context.textBaseline = "top";
    const x = options.direction === "rtl" ? WIDTH - PAD_X : PAD_X;
    context.fillStyle = options.ink;
    context.font = `${bodySize}px ${options.fontFamily}`;
    pageRows.forEach((row, index) => context.fillText(row.text, x, PAD_Y + index * rowHeight));
    context.fillStyle = options.muted;
    context.font = `22px ${options.fontFamily}`;
    context.textAlign = "center";
    context.fillText(`${options.title}  ·  ${blobs.length + 1}`, WIDTH / 2, HEIGHT - 62);
    blobs.push(await canvasBlob(canvas, signal));
    paragraphStarts.push(pageRows[0]?.paragraph ?? 0);
    if (blobs.length % 4 === 0)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  return { blobs, paragraphStarts };
}

async function loadOrGenerate(
  key: string,
  options: Options,
  signal: AbortSignal,
): Promise<GeneratedPages> {
  const cached = await ebookBookPageCacheGet(key);
  throwIfAborted(signal);
  if (cached) return cached;
  const generated = await generate(options, signal);
  throwIfAborted(signal);
  void ebookBookPageCachePut(key, generated);
  return generated;
}

function acquire(key: string, options: Options, signal?: AbortSignal): Promise<GeneratedPages> {
  throwIfAborted(signal);
  let job = pending.get(key);
  if (!job) {
    const controller = new AbortController();
    job = {
      controller,
      consumers: 0,
      promise: loadOrGenerate(key, options, controller.signal),
    };
    pending.set(key, job);
    job.promise.then(
      () => pending.delete(key),
      () => pending.delete(key),
    );
  }
  job.consumers++;
  if (job.abortTimer !== undefined) {
    window.clearTimeout(job.abortTimer);
    job.abortTimer = undefined;
  }
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    job!.consumers = Math.max(0, job!.consumers - 1);
    if (job!.consumers === 0 && pending.get(key) === job)
      job!.abortTimer = window.setTimeout(() => {
        if (job!.consumers === 0) job!.controller.abort();
      }, ABORT_GRACE_MS);
  };
  signal?.addEventListener("abort", release, { once: true });
  return job.promise
    .then((value) => {
      throwIfAborted(signal);
      return value;
    })
    .finally(() => {
      signal?.removeEventListener("abort", release);
      release();
    });
}

export async function createEBookFlipPages(options: Options): Promise<EBookFlipPages> {
  const generated = await acquire(pageCacheKey(options), options, options.signal);
  throwIfAborted(options.signal);
  const urls = options.cover ? [options.cover] : [];
  const paragraphStarts = options.cover ? [0] : [];
  for (const blob of generated.blobs) urls.push(URL.createObjectURL(blob));
  paragraphStarts.push(...generated.paragraphStarts);
  for (const image of options.content.images ?? []) {
    urls.push(image);
    paragraphStarts.push(Math.max(0, generated.paragraphStarts.at(-1) ?? 0));
  }
  return { urls, paragraphStarts };
}
