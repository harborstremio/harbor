import {
  imageUrl,
  isDigits,
  toDateIso,
  type BrowseKind,
  type SuwayomiClient,
  type SuwayomiExtension,
  type SuwayomiSource,
} from "./model";
import type { RestChapter, RestPage } from "./rest";

const GQL = "/api/graphql";

async function gql(
  client: SuwayomiClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<any | null> {
  const res = await client.postJson(GQL, { query, variables: variables ?? {} });
  if (!res) return null;
  return res.data ?? null;
}

async function gqlData(
  client: SuwayomiClient,
  query: string,
  variables?: Record<string, unknown>,
): Promise<any> {
  const data = await gql(client, query, variables);
  if (data == null) throw new Error("suwayomi_graphql_error");
  return data;
}

export async function gqlAvailable(client: SuwayomiClient): Promise<boolean> {
  const data = await gql(client, "query { aboutServer { version } }");
  return !!data;
}

export async function gqlAbout(
  client: SuwayomiClient,
): Promise<{ name?: string; version?: string } | null> {
  const data = await gql(client, "query { aboutServer { name version } }");
  const v = data?.aboutServer;
  if (!v) return null;
  return {
    name: v.name ? String(v.name) : undefined,
    version: v.version ? String(v.version) : undefined,
  };
}

export async function gqlSources(client: SuwayomiClient): Promise<SuwayomiSource[]> {
  const data = await gql(
    client,
    `query { sources { nodes { id name lang iconUrl supportsLatest isNsfw isLocal } } }`,
  );
  const nodes = data?.sources?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((s: any) => s?.id != null)
    .map((s: any) => ({
      id: String(s.id),
      name: String(s.name ?? s.id),
      lang: String(s.lang ?? "en"),
      iconUrl:
        typeof s.iconUrl === "string"
          ? s.iconUrl.startsWith("http")
            ? s.iconUrl
            : client.server.base + s.iconUrl
          : undefined,
      supportsLatest: !!s.supportsLatest,
      isNsfw: !!s.isNsfw,
      isLocal: !!s.isLocal,
    }));
}

const KIND_ENUM: Record<BrowseKind, string> = {
  popular: "POPULAR",
  latest: "LATEST",
  search: "SEARCH",
};

export async function gqlBrowse(
  client: SuwayomiClient,
  sourceId: string,
  kind: BrowseKind,
  page: number,
  query?: string,
): Promise<RestPage> {
  if (!isDigits(sourceId)) return { items: [], hasNextPage: false };
  const q = `mutation($page: Int!, $query: String) {
    fetchSourceManga(input: { source: ${sourceId}, type: ${KIND_ENUM[kind]}, page: $page, query: $query }) {
      hasNextPage
      mangas { id title thumbnailUrl author artist status description }
    }
  }`;
  const data = await gqlData(client, q, { page, query: query ?? null });
  const payload = data.fetchSourceManga;
  if (payload == null) throw new Error("suwayomi_graphql_shape");
  return {
    items: Array.isArray(payload.mangas) ? payload.mangas : [],
    hasNextPage: !!payload.hasNextPage,
  };
}

export async function gqlManga(client: SuwayomiClient, mangaId: string): Promise<any | null> {
  if (!isDigits(mangaId)) return null;
  const q = `query {
    manga(id: ${mangaId}) { id title thumbnailUrl author artist status description sourceId initialized }
  }`;
  const data = await gql(client, q);
  const cached = data?.manga ?? null;
  if (cached && cached.initialized !== false) return cached;
  const fq = `mutation {
    fetchMangaAndChapters(input: { id: ${mangaId}, fetchManga: true, fetchChapters: false }) {
      manga { id title thumbnailUrl author artist status description sourceId }
    }
  }`;
  const fdata = await gql(client, fq);
  if (data == null && fdata == null) throw new Error("suwayomi_graphql_error");
  return fdata?.fetchMangaAndChapters?.manga ?? cached;
}

function mapGqlChapters(chapters: any[]): RestChapter[] {
  return chapters
    .filter((ch: any) => ch?.id != null)
    .map((ch: any) => {
      const cn = Number(ch.chapterNumber);
      const pc = Number(ch.pageCount);
      return {
        key: String(ch.id),
        chapterNumber: Number.isFinite(cn) && cn >= 0 ? cn : null,
        name: ch.name || undefined,
        scanlator: ch.scanlator || undefined,
        uploadDate: toDateIso(ch.uploadDate),
        pageCount: Number.isFinite(pc) && pc >= 0 ? pc : 0,
        downloaded: !!ch.isDownloaded,
        isRead: ch.isRead === true,
        lastPageRead: Number.isFinite(Number(ch.lastPageRead))
          ? Number(ch.lastPageRead)
          : undefined,
      };
    });
}

export async function gqlChapters(client: SuwayomiClient, mangaId: string): Promise<RestChapter[]> {
  if (!isDigits(mangaId)) return [];
  const q = `query {
    chapters(condition: { mangaId: ${mangaId} }) {
      nodes { id name chapterNumber scanlator uploadDate pageCount isDownloaded isRead lastPageRead }
    }
  }`;
  const data = await gql(client, q);
  const cachedNodes = data?.chapters?.nodes;
  if (Array.isArray(cachedNodes) && cachedNodes.length > 0) return mapGqlChapters(cachedNodes);
  const fq = `mutation {
    fetchChapters(input: { mangaId: ${mangaId} }) {
      chapters { id name chapterNumber scanlator uploadDate pageCount isDownloaded isRead lastPageRead }
    }
  }`;
  const fdata = await gql(client, fq);
  if (data == null && fdata == null) throw new Error("suwayomi_graphql_error");
  const fetched = fdata?.fetchChapters?.chapters;
  if (Array.isArray(fetched)) return mapGqlChapters(fetched);
  if (Array.isArray(cachedNodes)) return mapGqlChapters(cachedNodes);
  throw new Error("suwayomi_graphql_shape");
}

export async function gqlPageUrls(client: SuwayomiClient, chapterId: string): Promise<string[]> {
  if (!isDigits(chapterId)) return [];
  const q = `mutation {
    fetchChapterPages(input: { chapterId: ${chapterId} }) { pages }
  }`;
  const data = await gqlData(client, q);
  const pages = data.fetchChapterPages?.pages;
  if (!Array.isArray(pages)) throw new Error("suwayomi_graphql_shape");
  return pages
    .filter((p: any) => typeof p === "string" && p)
    .map((p: string) => (p.startsWith("http") ? p : imageUrl(client.server, p)));
}

export async function gqlLibrary(client: SuwayomiClient): Promise<any[]> {
  const data = await gql(
    client,
    `query { mangas(condition: { inLibrary: true }) {
      nodes { id title thumbnailUrl author artist status description sourceId }
    } }`,
  );
  if (data == null) throw new Error("Suwayomi server did not respond");
  const nodes = data?.mangas?.nodes;
  return Array.isArray(nodes) ? nodes : [];
}

export async function gqlSetMangaInLibrary(
  client: SuwayomiClient,
  mangaId: string,
  inLibrary: boolean,
): Promise<boolean> {
  if (!isDigits(mangaId)) return false;
  const q = `mutation($id: Int!, $inLibrary: Boolean!) {
    updateManga(input: { id: $id, patch: { inLibrary: $inLibrary } }) {
      manga { id }
    }
  }`;
  const data = await gql(client, q, { id: Number(mangaId), inLibrary });
  return data?.updateManga?.manga?.id != null;
}

export async function gqlExtensions(client: SuwayomiClient): Promise<SuwayomiExtension[]> {
  const data = await gql(
    client,
    `query { extensions { nodes {
      pkgName apkName name lang iconUrl versionName isInstalled hasUpdate isObsolete isNsfw repo
    } } }`,
  );
  if (data == null) throw new Error("suwayomi_graphql_error");
  const nodes = data?.extensions?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((e: any) => e?.pkgName)
    .map((e: any) => ({
      pkgName: String(e.pkgName),
      apkName: e.apkName ? String(e.apkName) : undefined,
      name: String(e.name ?? e.pkgName),
      lang: String(e.lang ?? "en"),
      iconUrl:
        typeof e.iconUrl === "string"
          ? e.iconUrl.startsWith("http")
            ? e.iconUrl
            : client.server.base + e.iconUrl
          : undefined,
      versionName: e.versionName ? String(e.versionName) : undefined,
      installed: !!e.isInstalled,
      hasUpdate: !!e.hasUpdate,
      obsolete: !!e.isObsolete,
      isNsfw: !!e.isNsfw,
      repo: e.repo ? String(e.repo) : undefined,
    }));
}

async function updateExtension(
  client: SuwayomiClient,
  pkgName: string,
  patch: "install" | "uninstall" | "update",
): Promise<boolean> {
  const q = `mutation($id: String!) {
    updateExtension(input: { id: $id, patch: { ${patch}: true } }) {
      extension { pkgName isInstalled }
    }
  }`;
  const data = await gql(client, q, { id: pkgName });
  const extension = data?.updateExtension?.extension;
  if (!extension) return false;
  return patch === "uninstall" ? extension.isInstalled === false : extension.isInstalled === true;
}

export function gqlInstallExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return updateExtension(client, pkgName, "install");
}

export function gqlUninstallExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return updateExtension(client, pkgName, "uninstall");
}

export function gqlUpdateExtension(client: SuwayomiClient, pkgName: string): Promise<boolean> {
  return updateExtension(client, pkgName, "update");
}

export type ExtensionRepo = { name: string; indexUrl: string; isLegacy: boolean };

export async function gqlListExtensionRepos(client: SuwayomiClient): Promise<ExtensionRepo[]> {
  const data = await gql(client, `query { extensionStores { nodes { name indexUrl isLegacy } } }`);
  const nodes = data?.extensionStores?.nodes;
  if (!Array.isArray(nodes)) return [];
  return nodes
    .filter((n: any) => n?.indexUrl)
    .map((n: any) => ({
      name: String(n.name || n.indexUrl),
      indexUrl: String(n.indexUrl),
      isLegacy: !!n.isLegacy,
    }));
}

export async function gqlAddExtensionRepo(
  client: SuwayomiClient,
  indexUrl: string,
): Promise<boolean> {
  const q = `mutation($url: String!) {
    addExtensionStore(input: { indexUrl: $url }) { extensionStore { indexUrl } }
  }`;
  const data = await gql(client, q, { url: indexUrl });
  return !!data?.addExtensionStore?.extensionStore;
}

export async function gqlRemoveExtensionRepo(
  client: SuwayomiClient,
  indexUrl: string,
): Promise<boolean> {
  const q = `mutation($url: String!) {
    removeExtensionStore(input: { indexUrl: $url }) { clientMutationId }
  }`;
  const data = await gql(client, q, { url: indexUrl });
  return data != null;
}

export async function gqlFetchExtensions(client: SuwayomiClient): Promise<boolean> {
  const data = await gql(client, `mutation { fetchExtensions(input: {}) { clientMutationId } }`);
  return data != null;
}

export async function gqlReposSupported(client: SuwayomiClient): Promise<boolean> {
  const data = await gql(client, `query { extensionStores { totalCount } }`);
  return data != null;
}
