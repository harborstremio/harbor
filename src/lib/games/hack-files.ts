import type { SourceFile } from "./sources";

export const PPLUS_REPOSITORY = "Project-Plus-Development-Team/PPlusReleases";
/** Preserve the file identity from the creator's public Drive link. */
export function hackDriveDownload(page: string): string | undefined {
  try {
    const url = new URL(page);
    if (url.origin !== 'https://drive.google.com' || url.username || url.password) return;
    const id = url.pathname.match(/^\/file\/d\/([\w-]{20,100})(?:\/view)?\/?$/)?.[1]
      ?? (url.pathname === '/uc' && url.searchParams.getAll('id').length === 1 ? url.searchParams.get('id') : undefined);
    if (!id || !/^[\w-]{20,100}$/.test(id)) return;
    const download = new URL('https://drive.usercontent.google.com/download');
    download.searchParams.set('id', id); download.searchParams.set('export', 'download'); download.searchParams.set('confirm', 't');
    const resource = url.searchParams.get('resourcekey');
    if (resource && /^[\w-]{1,200}$/.test(resource)) download.searchParams.set('resourcekey', resource);
    return download.href;
  } catch { return; }
}

export function hackDriveFile(url: string, response: Response): SourceFile | undefined {
  if (response.status !== 206 || !/^bytes 0-7\/(\d+)$/.test(response.headers.get('content-range') ?? '')) return;
  const disposition = response.headers.get('content-disposition') ?? '';
  let name: string;
  try { name = decodeURIComponent(disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1] ?? disposition.match(/filename="([^"]+)"/i)?.[1] ?? ''); }
  catch { return; }
  if (!name || /[\/\\\x00-\x1f]/.test(name) || !/\.(zip|7z|rar|bps|ips|ups|xdelta|vcdiff)$/i.test(name) || /text\/html/i.test(response.headers.get('content-type') ?? '')) return;
  const sizeBytes = Number(response.headers.get('content-range')!.split('/')[1]);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 8) return;
  return {name, url, kind:'direct', sizeBytes};
}
export function hackGithubRepository(page: string): string | undefined {
  try { const url = new URL(page); const match = url.pathname.match(/^\/([\w.-]+\/[^/]+)(?:\/releases(?:\/.*)?)?\/?$/);
    return url.origin === "https://github.com" && !url.username && !url.password && match ? match[1] : undefined;
  } catch { return; }
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export function projectPlusFiles(value: unknown, repository = PPLUS_REPOSITORY): { version: string; files: SourceFile[] } {
  const release = record(value);
  if (release.draft || release.prerelease || !Array.isArray(release.assets)) throw Error("Release unavailable");
  const files = release.assets.flatMap(value => {
    const item = record(value);
    if (typeof item.name !== "string" || typeof item.browser_download_url !== "string") return [];
    let url: URL;
    try { url = new URL(item.browser_download_url); } catch { return []; }
    if (url.origin !== "https://github.com" || !url.pathname.startsWith(`/${repository}/releases/download/`) || !/\.(zip|7z|rar|tar\.gz|appimage|dmg|bps|ips|ups|xdelta|vcdiff)$/i.test(item.name)) return [];
    return [{ name: item.name, url: url.href, kind: "direct" as const, sizeBytes: typeof item.size === "number" && Number.isSafeInteger(item.size) && item.size > 0 ? item.size : undefined, sha256: typeof item.digest === "string" && /^sha256:[a-f0-9]{64}$/.test(item.digest) ? item.digest.slice(7) : undefined }];
  });
  if (!files.length) throw Error("No published assets");
  const rank = (name: string) => /changed.files/i.test(name) ? 4 : /modders|textures/i.test(name) ? 3 : /wii.lite/i.test(name) ? 1 : /wii/i.test(name) ? 0 : 2;
  files.sort((a,b) => rank(a.name)-rank(b.name));
  return { version: typeof release.tag_name === "string" ? release.tag_name.slice(0,80) : "", files };
}

/** Only download links actually published by the project are offered. */
export function projectPageFiles(html: string, page: string): SourceFile[] {
  const document = new DOMParser().parseFromString(html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<img\b[^>]*>/gi, ""), "text/html");
  const origin = new URL(page), files: SourceFile[] = [];
  for (const link of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    try {
      const url = new URL(link.getAttribute("href")!, page);
      if (url.protocol !== "https:" || url.username || url.password) continue;
      const trusted = url.hostname === origin.hostname || ["projectm.lightni.ng", "github.com", "drive.google.com", "www.mediafire.com", "mediafire.com"].includes(url.hostname)
        || /^(?:www\.)?smwcentral\.net$/.test(origin.hostname) && url.hostname === 'dl.smwcentral.net';
      if (!trusted) continue;
      const direct = /\.(zip|7z|rar|bps|ips|ups|xdelta|vcdiff)$/i.test(url.pathname);
      const hosted = url.hostname === "drive.google.com" && /^(\/uc|\/file\/d\/)/.test(url.pathname) || /^(www\.)?mediafire.com$/.test(url.hostname) && url.pathname.startsWith("/file/");
      if (!direct && !hosted) continue;
      const name = link.textContent?.replace(/\s+/g," ").trim().slice(0,180) || decodeURIComponent(url.pathname.split("/").pop()!);
      files.push({ name, url: url.href, kind: direct ? "direct" : "page" });
    } catch { /* Ignore malformed outbound links. */ }
  }
  return [...new Map(files.map(file => [file.url,file])).values()].sort((a,b) => Number(a.kind !== "direct")-Number(b.kind !== "direct")).slice(0,40);
}

/** One follow-up only, through explicit download/release links on the creator page. */
export function projectDownloadPages(html: string, page: string): string[] {
  const document = new DOMParser().parseFromString(html.replace(/<(script|style|iframe)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<img\b[^>]*>/gi, ''), 'text/html');
  const origin = new URL(page), pages: string[] = [];
  for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    try {
      const url = new URL(link.getAttribute('href')!, page);
      if (url.protocol !== 'https:' || url.username || url.password || url.href === origin.href || url.hash || /\.(zip|7z|rar|bps|ips|ups|xdelta|vcdiff)$/i.test(url.pathname)) continue;
      const cue = `${link.textContent} ${url.pathname} ${url.search}`;
      if (!/\b(downloads?|releases?)\b/i.test(cue)) continue;
      if (url.origin === origin.origin || hackGithubRepository(url.href)) pages.push(url.href);
    } catch { /* Ignore malformed links. */ }
  }
  return [...new Set(pages)].slice(0,3);
}
