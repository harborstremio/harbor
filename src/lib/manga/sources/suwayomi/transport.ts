import type { MangaSummary } from "@/lib/manga/types";
import {
  makeClient,
  makeServer,
  type SuwayomiClient,
  type SuwayomiServer,
  type SuwayomiSource,
} from "./model";
import { restSourceList, restSourceListOk, restSources } from "./rest";
import { gqlAvailable, gqlSources } from "./graphql";

export type ServerConfig = { baseUrl: string; auth?: { username: string; password: string } };

export type SuwayomiPage = { manga: MangaSummary[]; hasNextPage: boolean };

export type Transport = "rest" | "graphql";

export function configAuth(config: ServerConfig): string | undefined {
  return config.auth ? `${config.auth.username}:${config.auth.password}` : undefined;
}

export function configServer(config: ServerConfig): SuwayomiServer {
  return makeServer(config.baseUrl, configAuth(config));
}

export function configClient(config: ServerConfig): SuwayomiClient {
  return makeClient(configServer(config));
}

const transportCache = new Map<string, Promise<Transport>>();
const sourceCache = new Map<string, Map<string, SuwayomiSource>>();

export function clearSuwayomiTransportCache(): void {
  transportCache.clear();
  sourceCache.clear();
}

export function pickTransport(client: SuwayomiClient): Promise<Transport> {
  const base = client.server.base;
  const cached = transportCache.get(base);
  if (cached) return cached;
  const p = (async (): Promise<Transport> => {
    const restList = await restSourceList(client);
    if (restList && restList.length > 0) return "rest";
    if (await gqlAvailable(client)) return "graphql";
    if (restList) return "rest";
    transportCache.delete(base);
    return "rest";
  })();
  transportCache.set(base, p);
  return p;
}

export function setTransport(base: string, t: Transport): void {
  transportCache.set(base, Promise.resolve(t));
}

export async function withTransportFallback<T>(
  client: SuwayomiClient,
  run: (t: Transport) => Promise<T>,
): Promise<T> {
  const first = await pickTransport(client);
  try {
    return await run(first);
  } catch (err) {
    const alt: Transport = first === "rest" ? "graphql" : "rest";
    const altOk = alt === "rest" ? await restSourceListOk(client) : await gqlAvailable(client);
    if (!altOk) throw err;
    setTransport(client.server.base, alt);
    return run(alt);
  }
}

export async function loadSources(client: SuwayomiClient, t: Transport): Promise<SuwayomiSource[]> {
  const list = t === "rest" ? await restSources(client) : await gqlSources(client);
  if (list.length) sourceCache.set(client.server.base, new Map(list.map((s) => [s.id, s])));
  return list;
}

export async function sourceLang(
  client: SuwayomiClient,
  t: Transport,
  sourceId: string,
): Promise<string> {
  let map = sourceCache.get(client.server.base);
  if (!map) {
    await loadSources(client, t);
    map = sourceCache.get(client.server.base);
  }
  return map?.get(sourceId)?.lang ?? "en";
}
