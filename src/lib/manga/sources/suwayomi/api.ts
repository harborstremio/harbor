import type { MangaSummary } from "@/lib/manga/types";
import { imageUrl, mapManga, type SuwayomiExtension, type SuwayomiSource } from "./model";
import {
  configClient,
  configServer,
  clearLoadedSources,
  loadSources,
  pickTransport,
  withTransportFallback,
  type ServerConfig,
  type SuwayomiPage,
} from "./transport";
import {
  restAbout,
  restBrowse,
  restExtensions,
  restInstallExtension,
  restSearch,
  restSourceListOk,
  restUninstallExtension,
  restUpdateExtension,
  type RestPage,
} from "./rest";
import {
  gqlAbout,
  gqlAddExtensionRepo,
  gqlBrowse,
  gqlExtensions,
  gqlFetchExtensions,
  gqlInstallExtension,
  gqlListExtensionRepos,
  gqlRemoveExtensionRepo,
  gqlReposSupported,
  gqlUninstallExtension,
  gqlUpdateExtension,
  type ExtensionRepo,
} from "./graphql";
import { normalizeExtensionRepoUrl } from "./base-url";
import {
  notifySuwayomiSourcesChanged,
  subscribeSuwayomiSourcesChanged,
} from "./source-events";

export type { ExtensionRepo } from "./graphql";

export type { ServerConfig, SuwayomiPage } from "./transport";

export type ProbeReason = "auth" | "not_found" | "unreachable" | "unsupported";
export type ProbeResult = { ok: boolean; name?: string; version?: string; reason?: ProbeReason };

export async function testConnection(config: ServerConfig): Promise<ProbeResult> {
  const client = configClient(config);
  try {
    const t = await pickTransport(client);
    if (t === "rest") {
      const about = await restAbout(client);
      if (about) return { ok: true, name: about.name, version: about.version };
      if (await restSourceListOk(client)) return { ok: true };
    } else {
      const info = await gqlAbout(client);
      if (info) return { ok: true, name: info.name, version: info.version };
    }
  } catch {
    /* fall through to classification */
  }
  return classifyFailure(client);
}

async function classifyFailure(client: ReturnType<typeof configClient>): Promise<ProbeResult> {
  const status = await client.probeStatus("/api/v1/settings/about");
  if (status == null) return { ok: false, reason: "unreachable" };
  if (status === 401 || status === 403) return { ok: false, reason: "auth" };
  if (status === 404) {
    const info = await gqlAbout(client).catch(() => null);
    if (info) return { ok: true, name: info.name, version: info.version };
    return { ok: false, reason: "not_found" };
  }
  return { ok: false, reason: "unsupported" };
}

export async function listSources(config: ServerConfig): Promise<SuwayomiSource[]> {
  const client = configClient(config);
  return loadSources(client, await pickTransport(client));
}

function mapPage(config: ServerConfig, sourceId: string, res: RestPage): SuwayomiPage {
  const server = configServer(config);
  return {
    manga: res.items
      .map((m) => mapManga(server, sourceId, m))
      .filter((m): m is MangaSummary => !!m),
    hasNextPage: res.hasNextPage,
  };
}

export async function sourcePopular(
  config: ServerConfig,
  sourceId: string,
  page: number,
): Promise<SuwayomiPage> {
  return cachedSourceBrowse(config, sourceId, "popular", page);
}

const FEED_TTL = 5 * 60_000;
const feedCache = new Map<string, { at: number; data: SuwayomiPage }>();
subscribeSuwayomiSourcesChanged(() => feedCache.clear());

// The per-extension Popular/Latest feeds are requested once for every source on
// every visit to the All-Extensions view, so memoize them briefly (5 min) to
// avoid 2xN HTTP calls on each mount. Cleared on any Suwayomi extension change.
//
// Suwayomi's REST browse endpoint re-queries MangaTable without ORDER BY, so
// rows come back in SQLite primary-key order rather than the source extension's
// intended "latest first" / "most popular first" order. The GraphQL
// fetchSourceManga mutation explicitly preserves source order via
// `.sortedBy { mangaIds.indexOf(it.id) }` — the same mutation both official
// Suwayomi UIs (WebUI, JUI) use. Prefer GraphQL for browse so the feed rows
// match what the user sees in Suwayomi; fall back to REST if unavailable.
async function cachedSourceBrowse(
  config: ServerConfig,
  sourceId: string,
  kind: "popular" | "latest",
  page: number,
): Promise<SuwayomiPage> {
  const key = `${config.baseUrl}|${sourceId}|${kind}|${page}`;
  const hit = feedCache.get(key);
  if (hit && Date.now() - hit.at < FEED_TTL) return hit.data;
  const client = configClient(config);
  let res: RestPage;
  try {
    res = await gqlBrowse(client, sourceId, kind, page);
  } catch {
    res = await restBrowse(client, sourceId, kind, page);
  }
  const data = mapPage(config, sourceId, res);
  feedCache.set(key, { at: Date.now(), data });
  return data;
}

export async function sourceLatest(
  config: ServerConfig,
  sourceId: string,
  page: number,
): Promise<SuwayomiPage> {
  return cachedSourceBrowse(config, sourceId, "latest", page);
}

export async function sourceSearch(
  config: ServerConfig,
  sourceId: string,
  query: string,
  page: number,
): Promise<SuwayomiPage> {
  const client = configClient(config);
  const res = await withTransportFallback(client, (t) =>
    t === "rest"
      ? restSearch(client, sourceId, query, page)
      : gqlBrowse(client, sourceId, "search", page, query),
  );
  return mapPage(config, sourceId, res);
}

export async function listExtensions(config: ServerConfig): Promise<SuwayomiExtension[]> {
  const client = configClient(config);
  return withTransportFallback(client, (transport) =>
    transport === "rest" ? restExtensions(client) : gqlExtensions(client),
  );
}

async function mutateExtension(
  config: ServerConfig,
  pkgName: string,
  rest: (c: ReturnType<typeof configClient>, p: string) => Promise<boolean>,
  graphql: (c: ReturnType<typeof configClient>, p: string) => Promise<boolean>,
): Promise<void> {
  const client = configClient(config);
  await withTransportFallback(client, async (transport) => {
    const ok = transport === "rest" ? await rest(client, pkgName) : await graphql(client, pkgName);
    if (!ok) throw new Error("suwayomi extension action failed");
  });
  clearLoadedSources(client.server.base);
  notifySuwayomiSourcesChanged(client.server.base);
}

export function installExtension(config: ServerConfig, pkgName: string): Promise<void> {
  return mutateExtension(config, pkgName, restInstallExtension, gqlInstallExtension);
}

export function uninstallExtension(config: ServerConfig, pkgName: string): Promise<void> {
  return mutateExtension(config, pkgName, restUninstallExtension, gqlUninstallExtension);
}

export function updateExtension(config: ServerConfig, pkgName: string): Promise<void> {
  return mutateExtension(config, pkgName, restUpdateExtension, gqlUpdateExtension);
}

export function extensionIconUrl(config: ServerConfig, apkName?: string): string | undefined {
  if (!apkName) return undefined;
  return imageUrl(configServer(config), `/api/v1/extension/icon/${apkName}`);
}

export async function reposSupported(config: ServerConfig): Promise<boolean> {
  const client = configClient(config);
  if ((await pickTransport(client)) !== "graphql") return false;
  return gqlReposSupported(client);
}

export async function listExtensionRepos(config: ServerConfig): Promise<ExtensionRepo[]> {
  const client = configClient(config);
  if ((await pickTransport(client)) !== "graphql") return [];
  return gqlListExtensionRepos(client);
}

export async function addExtensionRepo(config: ServerConfig, url: string): Promise<void> {
  const indexUrl = normalizeExtensionRepoUrl(url);
  if (!indexUrl) throw new Error("invalid_url");
  const client = configClient(config);
  if ((await pickTransport(client)) !== "graphql") throw new Error("repos_unsupported");
  if (!(await gqlAddExtensionRepo(client, indexUrl))) throw new Error("repo_rejected");
  await gqlFetchExtensions(client);
}

export async function removeExtensionRepo(config: ServerConfig, indexUrl: string): Promise<void> {
  const client = configClient(config);
  if ((await pickTransport(client)) !== "graphql") return;
  await gqlRemoveExtensionRepo(client, indexUrl);
  await gqlFetchExtensions(client);
}
