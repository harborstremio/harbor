import {
  imageUrl,
  type BrowseKind,
  type SuwayomiClient,
  type SuwayomiExtension,
  type SuwayomiSource,
} from "./model";

export type RestChapter = {
  key: string;
  chapterNumber: number | null;
  name?: string;
  scanlator?: string;
  uploadDate?: string;
  pageCount: number;
  downloaded: boolean;
  isRead?: boolean;
  lastPageRead?: number;
};

export type RestPage = { items: any[]; hasNextPage: boolean };

function pageList(res: any): RestPage {
  const items = Array.isArray(res?.mangaList) ? res.mangaList : Array.isArray(res) ? res : [];
  return { items, hasNextPage: !!res?.hasNextPage };
}

export async function restSourceList(client: SuwayomiClient): Promise<any[] | null> {
  const res = await client.getJson("/api/v1/source/list");
  return Array.isArray(res) ? res : null;
}

export async function restSourceListOk(client: SuwayomiClient): Promise<boolean> {
  return (await restSourceList(client)) != null;
}

export async function restAbout(
  client: SuwayomiClient,
): Promise<{ name?: string; version?: string } | null> {
  const res = await client.getJson("/api/v1/settings/about");
  if (!res || typeof res !== "object") return null;
  return {
    name: res.name ? String(res.name) : undefined,
    version: res.version ? String(res.version) : undefined,
  };
}

export async function restSources(client: SuwayomiClient): Promise<SuwayomiSource[]> {
  const res = await restSourceList(client);
  if (!res) return [];
  return res
    .filter((s) => s?.id != null)
    .map((s) => ({
      id: String(s.id),
      name: String(s.name ?? s.displayName ?? s.id),
      lang: String(s.lang ?? "en"),
      iconUrl: typeof s.iconUrl === "string" ? client.server.base + s.iconUrl : undefined,
      supportsLatest: !!s.supportsLatest,
      isNsfw: !!s.isNsfw,
    }));
}

function browsePath(sourceId: string, kind: Exclude<BrowseKind, "search">, page: number): string {
  const seg = kind === "latest" ? "latest" : "popular";
  return `/api/v1/source/${sourceId}/${seg}/${page}`;
}

export async function restBrowse(
  client: SuwayomiClient,
  sourceId: string,
  kind: Exclude<BrowseKind, "search">,
  page: number,
): Promise<RestPage> {
  const res = await client.getJson(browsePath(sourceId, kind, page));
  if (res == null) throw new Error("suwayomi_rest_error");
  return pageList(res);
}

export async function restSearch(
  client: SuwayomiClient,
  sourceId: string,
  query: string,
  page: number,
): Promise<RestPage> {
  const q = encodeURIComponent(query);
  const res = await client.getJson(
    `/api/v1/source/${sourceId}/search?searchTerm=${q}&pageNum=${page}`,
  );
  if (res == null) throw new Error("suwayomi_rest_error");
  return pageList(res);
}

export async function restFilters(client: SuwayomiClient, sourceId: string): Promise<any[]> {
  const res = await client.getJson(`/api/v1/source/${sourceId}/filters`);
  return Array.isArray(res) ? res : [];
}

export async function restLibrary(client: SuwayomiClient): Promise<any[]> {
  const direct = await client.getJson("/api/v1/library");
  if (Array.isArray(direct)) return direct;
  if (Array.isArray(direct?.mangaList)) return direct.mangaList;
  const cats = await client.getJson("/api/v1/category");
  if (!Array.isArray(cats)) {
    if (direct == null && cats == null) throw new Error("Suwayomi server did not respond");
    return [];
  }
  const merged: any[] = [];
  const seen = new Set<string>();
  for (const cat of cats) {
    if (cat?.id == null) continue;
    const list = await client.getJson(`/api/v1/category/${cat.id}`);
    const arr = Array.isArray(list) ? list : Array.isArray(list?.manga) ? list.manga : [];
    for (const m of arr) {
      const id = String(m?.id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(m);
    }
  }
  return merged;
}

export function restSetMangaInLibrary(
  client: SuwayomiClient,
  mangaId: string,
  inLibrary: boolean,
): Promise<boolean> {
  const path = `/api/v1/manga/${mangaId}/library`;
  return inLibrary ? client.getOk(path) : client.deleteOk(path);
}

export async function restMangaFull(client: SuwayomiClient, mangaId: string): Promise<any | null> {
  const full = await client.getJson(`/api/v1/manga/${mangaId}/full`);
  if (full) return full;
  const basic = await client.getJson(`/api/v1/manga/${mangaId}`);
  if (basic == null) throw new Error("suwayomi_rest_error");
  return basic;
}

export async function restChapters(
  client: SuwayomiClient,
  mangaId: string,
): Promise<RestChapter[]> {
  const list = await client.getJson(`/api/v1/manga/${mangaId}/chapters`);
  if (list == null) throw new Error("suwayomi_rest_error");
  if (!Array.isArray(list)) return [];
  return list
    .filter((ch) => ch?.index != null)
    .map((ch) => {
      const cn = Number(ch.chapterNumber);
      return {
        key: String(ch.index),
        chapterNumber: Number.isFinite(cn) && cn >= 0 ? cn : null,
        name: ch.name || undefined,
        scanlator: ch.scanlator || undefined,
        uploadDate: ch.uploadDate != null ? String(ch.uploadDate) : undefined,
        pageCount: Number.isFinite(Number(ch.pageCount)) ? Number(ch.pageCount) : 0,
        downloaded: !!ch.downloaded,
        isRead: ch.read === true,
        lastPageRead: Number.isFinite(Number(ch.lastPageRead))
          ? Number(ch.lastPageRead)
          : undefined,
      };
    });
}

export async function restPageUrls(
  client: SuwayomiClient,
  mangaId: string,
  index: string,
): Promise<string[]> {
  const chapter = await client.getJson(`/api/v1/manga/${mangaId}/chapter/${index}`);
  if (chapter == null) throw new Error("suwayomi_rest_error");
  const count = Number(chapter?.pageCount);
  if (!Number.isFinite(count) || count <= 0) return [];
  return Array.from({ length: count }, (_, p) =>
    imageUrl(client.server, `/api/v1/manga/${mangaId}/chapter/${index}/page/${p}`),
  );
}

export async function restExtensions(client: SuwayomiClient): Promise<SuwayomiExtension[]> {
  const res = await client.getJson("/api/v1/extension/list");
  if (res == null) throw new Error("suwayomi_rest_error");
  if (!Array.isArray(res)) return [];
  return res
    .filter((e) => e?.pkgName)
    .map((e) => ({
      pkgName: String(e.pkgName),
      apkName: e.apkName ? String(e.apkName) : undefined,
      name: String(e.name ?? e.pkgName),
      lang: String(e.lang ?? "en"),
      iconUrl: typeof e.iconUrl === "string" ? client.server.base + e.iconUrl : undefined,
      versionName: e.versionName ? String(e.versionName) : undefined,
      installed: !!e.installed,
      hasUpdate: !!e.hasUpdate,
      obsolete: !!e.obsolete,
      isNsfw: !!e.isNsfw,
      repo: e.repo ? String(e.repo) : undefined,
    }));
}

export function restInstallExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return client.getOk(`/api/v1/extension/install/${encodeURIComponent(pkgName)}`);
}

export function restUninstallExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return client.getOk(`/api/v1/extension/uninstall/${encodeURIComponent(pkgName)}`);
}

export function restUpdateExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return client.getOk(`/api/v1/extension/update/${encodeURIComponent(pkgName)}`);
}
