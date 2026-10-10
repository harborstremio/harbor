import type { MangaProvider } from "@/lib/manga/types";
import { PluginWorker } from "@/lib/manga/plugins/worker-host";
import type { InstalledPlugin } from "@/lib/manga/plugins/types";
import { toSummaries, toSummary, toChapters, toStrings, toTags } from "@/lib/manga/plugins/adapter";
import { buildMangayomiSource } from "./mangayomi/prelude";
import { deleteMangayomiSource, mangayomiSourcesSync } from "./mangayomi/store";
import type { MangayomiSourceRecord } from "./mangayomi/types";

const workers = new Map<string, PluginWorker>();

function asPlugin(record: MangayomiSourceRecord): InstalledPlugin {
  return {
    id: record.id,
    name: record.name,
    version: record.version,
    lang: record.lang,
    nsfw: record.isNsfw,
    icon: record.iconUrl,
    repoUrl: record.repoUrl,
    baseUrl: record.baseUrl,
    source: buildMangayomiSource(record),
    hash: record.hash,
    enabled: record.enabled,
    hasTags: record.hasTags,
    config: undefined,
  };
}

function workerFor(record: MangayomiSourceRecord): PluginWorker {
  const existing = workers.get(record.id);
  if (existing) return existing;
  const w = new PluginWorker(asPlugin(record));
  workers.set(record.id, w);
  return w;
}

export function makeMangayomiProvider(record: MangayomiSourceRecord): MangaProvider {
  const w = workerFor(record);
  const provider: MangaProvider = {
    id: record.id,
    name: record.name,
    popular: (offset, tagId) => w.call("popular", [offset, tagId], 20_000).then(toSummaries),
    search: (query, offset, tagId) => w.call("search", [query, offset, tagId], 20_000).then(toSummaries),
    detail: (id) => w.call("detail", [id], 20_000).then(toSummary),
    chapters: (id) => w.call("chapters", [id], 25_000).then(toChapters),
    pageUrls: (chapterId) =>
      w.call("pageUrls", [chapterId], 30_000).then((v) => toStrings(v, record.baseUrl)),
  };
  if (record.hasTags) provider.tags = () => w.call("tags", [], 15_000).then(toTags);
  return provider;
}

export function warmMangayomiSource(record: MangayomiSourceRecord): void {
  void workerFor(record)
    .meta()
    .catch(() => {});
}

export function disposeMangayomiSource(id: string): void {
  workers.get(id)?.dispose();
  workers.delete(id);
}

export function disposeAllMangayomiSources(): void {
  for (const w of workers.values()) w.dispose();
  workers.clear();
}

export async function removeMangayomiRecord(id: string): Promise<void> {
  disposeMangayomiSource(id);
  await deleteMangayomiSource(id);
}

export async function removeMangayomiRecordsByRepo(repoUrl: string): Promise<number> {
  const matches = mangayomiSourcesSync().filter((r) => r.repoUrl === repoUrl);
  for (const r of matches) await removeMangayomiRecord(r.id);
  return matches.length;
}

export async function removeAllMangayomiRecords(): Promise<number> {
  const all = mangayomiSourcesSync();
  for (const r of all) await removeMangayomiRecord(r.id);
  return all.length;
}
