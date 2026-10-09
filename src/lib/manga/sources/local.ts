import type { MangaChapter, MangaProvider, MangaSummary } from "@/lib/manga/types";

const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const ARCHIVE_RE = /\.(cbz|zip)$/i;
const COVER_RE = /^cover\.(jpe?g|png|webp|avif)$/i;

type FsMod = typeof import("@tauri-apps/plugin-fs");
type CoreMod = typeof import("@tauri-apps/api/core");

let fsCache: FsMod | null = null;
let coreCache: CoreMod | null = null;

async function fsMod(): Promise<FsMod> {
  return (fsCache ??= await import("@tauri-apps/plugin-fs"));
}
async function coreMod(): Promise<CoreMod> {
  return (coreCache ??= await import("@tauri-apps/api/core"));
}

function sep(base: string): string {
  return base.includes("\\") ? "\\" : "/";
}
function joinPath(base: string, name: string): string {
  return /[\\/]$/.test(base) ? base + name : base + sep(base) + name;
}
function basename(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? p;
}
function naturalCmp(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
function chapterNumber(name: string): string | null {
  const m = name.match(/(\d+(?:\.\d+)?)/);
  return m ? m[1] : null;
}
function mimeFor(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "avif") return "image/avif";
  if (ext === "bmp") return "image/bmp";
  return "image/jpeg";
}

async function listDir(path: string): Promise<{ dirs: string[]; images: string[]; archives: string[] }> {
  const { readDir } = await fsMod();
  const entries = await readDir(path).catch(() => [] as Awaited<ReturnType<typeof readDir>>);
  const dirs: string[] = [];
  const images: string[] = [];
  const archives: string[] = [];
  for (const e of entries) {
    if (e.isDirectory) dirs.push(e.name);
    else if (e.isFile && IMG_RE.test(e.name)) images.push(e.name);
    else if (e.isFile && ARCHIVE_RE.test(e.name)) archives.push(e.name);
  }
  dirs.sort(naturalCmp);
  images.sort(naturalCmp);
  archives.sort(naturalCmp);
  return { dirs, images, archives };
}

async function firstCover(mangaPath: string): Promise<string | undefined> {
  const { convertFileSrc } = await coreMod();
  const { dirs, images } = await listDir(mangaPath);
  const cover = images.find((n) => COVER_RE.test(n));
  if (cover) return convertFileSrc(joinPath(mangaPath, cover));
  if (images.length) return convertFileSrc(joinPath(mangaPath, images[0]));
  for (const d of dirs) {
    const sub = joinPath(mangaPath, d);
    const inner = await listDir(sub);
    if (inner.images.length) return convertFileSrc(joinPath(sub, inner.images[0]));
  }
  return undefined;
}

const archiveBlobs = new Map<string, string[]>();
const ARCHIVE_KEEP = 2;
function cacheBlobs(id: string, urls: string[]): void {
  archiveBlobs.set(id, urls);
  while (archiveBlobs.size > ARCHIVE_KEEP) {
    const oldest = archiveBlobs.keys().next().value as string;
    archiveBlobs.get(oldest)?.forEach((u) => URL.revokeObjectURL(u));
    archiveBlobs.delete(oldest);
  }
}

export function makeLocalProvider(root: string): MangaProvider {
  async function listAll(): Promise<MangaSummary[]> {
    const { dirs } = await listDir(root);
    return Promise.all(
      dirs.map(async (name) => {
        const path = joinPath(root, name);
        return { id: path, title: name, cover: await firstCover(path) };
      }),
    );
  }

  return {
    id: "local",
    name: "Local folder",
    popular: async (offset = 0) => (offset > 0 ? [] : listAll()),
    search: async (query) => {
      const q = query.trim().toLowerCase();
      const all = await listAll();
      return q ? all.filter((m) => m.title.toLowerCase().includes(q)) : all;
    },
    detail: async (id) => ({ id, title: basename(id), cover: await firstCover(id) }),
    chapters: async (id) => {
      const { dirs, images, archives } = await listDir(id);
      const out: MangaChapter[] = [];
      for (const name of dirs) {
        out.push({ id: joinPath(id, name), chapter: chapterNumber(name), title: name, pages: 1, language: "en" });
      }
      for (const name of archives) {
        out.push({
          id: joinPath(id, name),
          chapter: chapterNumber(name),
          title: name.replace(ARCHIVE_RE, ""),
          pages: 1,
          language: "en",
        });
      }
      if (out.length) return out.sort((a, b) => naturalCmp(a.title ?? "", b.title ?? ""));
      if (images.length) {
        return [{ id, chapter: "1", title: basename(id), pages: images.length, language: "en" }];
      }
      return [];
    },
    pageUrls: async (chapterId) => {
      if (ARCHIVE_RE.test(chapterId)) {
        const cached = archiveBlobs.get(chapterId);
        if (cached) return cached;
        const { readFile } = await fsMod();
        const bytes = await readFile(chapterId);
        const { readCbzImages } = await import("./cbz");
        const imgs = (await readCbzImages(bytes)).sort((a, b) => naturalCmp(a.name, b.name));
        const urls = imgs.map((im) => URL.createObjectURL(new Blob([im.data], { type: mimeFor(im.name) })));
        cacheBlobs(chapterId, urls);
        return urls;
      }
      const { convertFileSrc } = await coreMod();
      const { images } = await listDir(chapterId);
      return images.map((name) => convertFileSrc(joinPath(chapterId, name)));
    },
  };
}
