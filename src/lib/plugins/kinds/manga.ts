import {
  addRepo,
  browseRepo,
  installPlugin,
  installedPluginsSync,
  loadInstalledPlugins,
  loadRepos,
  removeRepo,
  repoUrlsSync,
  setPluginEnabled,
  subscribePlugins,
  subscribeRepos,
  uninstallPlugin,
  type PluginRepo,
} from "@/lib/manga/plugins";
import { disposeMangayomiSource, removeMangayomiRecord } from "@/lib/manga/sources/mangayomi";
import {
  dedupeMangayomiVariants,
  fetchMangayomiIndex,
  importMangayomiRepo,
  installMangayomiSource,
  mangayomiEntryId,
} from "@/lib/manga/sources/mangayomi/repo";
import {
  loadMangayomiSources,
  mangayomiSourcesSync,
  saveMangayomiSource,
  subscribeMangayomiSources,
} from "@/lib/manga/sources/mangayomi/store";
import type { MangayomiIndexEntry } from "@/lib/manga/sources/mangayomi/types";
import { normalizeRepoUrl, repoTitle } from "@/lib/streams/plugins/manifest";
import { PluginError } from "@/lib/streams/plugins/types";
import { repoHost, type EntryView, type KindAdapter, type PluginView, type RepoView } from "../types";

type Cached = {
  repo: PluginRepo | null;
  index: MangayomiIndexEntry[] | null;
  error: string | null;
  loading: boolean;
  checkedAt: number | null;
};

const cache = new Map<string, Cached>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const a = subscribePlugins(cb);
  const b = subscribeRepos(cb);
  const c = subscribeMangayomiSources(cb);
  return () => {
    listeners.delete(cb);
    a();
    b();
    c();
  };
}

async function browse(url: string): Promise<void> {
  const cur = cache.get(url) ?? { repo: null, index: null, error: null, loading: false, checkedAt: null };
  cache.set(url, { ...cur, loading: true });
  notify();
  try {
    const repo = await browseRepo(url);
    let index: MangayomiIndexEntry[] | null = null;
    if (repo.plugins.length === 0 && repo.foreign?.kind === "mangayomi") {
      index = dedupeMangayomiVariants(await fetchMangayomiIndex(url));
    }
    cache.set(url, { repo, index, error: null, loading: false, checkedAt: Date.now() });
  } catch {
    cache.set(url, { ...cur, loading: false, error: "no-answer", checkedAt: Date.now() });
  }
  notify();
}

function pluginViews(): PluginView[] {
  const native: PluginView[] = installedPluginsSync().map((p) => ({
    kind: "manga",
    id: p.id,
    name: p.name,
    version: p.version,
    lang: p.lang ? [p.lang] : [],
    types: [],
    nsfw: p.nsfw,
    icon: p.icon,
    repoUrl: p.repoUrl,
    repoName: repoTitle(cache.get(p.repoUrl)?.repo?.name, p.repoUrl),
    format: "harbor",
    enabled: p.enabled,
    hasSettings: false,
    state: p.enabled ? "ok" : "off",
    error: null,
    updateVersion: null,
    canRevert: false,
    previousVersion: null,
    hosts: [],
    learnedHosts: [],
    verified: false,
    installedAt: null,
    checkable: false,
  }));
  const mangayomi: PluginView[] = mangayomiSourcesSync().map((r) => ({
    kind: "manga",
    id: r.id,
    name: r.name,
    version: r.version,
    lang: r.lang ? [r.lang] : [],
    types: [],
    nsfw: r.isNsfw,
    icon: r.iconUrl,
    repoUrl: r.repoUrl,
    repoName: repoTitle(cache.get(r.repoUrl)?.repo?.name, r.repoUrl),
    format: "mangayomi",
    enabled: r.enabled,
    hasSettings: false,
    state: r.enabled ? "ok" : "off",
    error: null,
    updateVersion: null,
    canRevert: false,
    previousVersion: null,
    hosts: r.baseUrl ? [repoHost(r.baseUrl)] : [],
    learnedHosts: [],
    verified: false,
    installedAt: null,
    checkable: false,
  }));
  return [...native, ...mangayomi];
}

function scriptHref(sourceCodeUrl: string, repoUrl: string): string {
  try {
    return new URL(sourceCodeUrl, repoUrl).href;
  } catch {
    return sourceCodeUrl;
  }
}

function repoViews(): RepoView[] {
  const installedNative = new Map(installedPluginsSync().map((p) => [p.id, p]));
  const installedMy = new Map(
    mangayomiSourcesSync().map((r) => [scriptHref(r.sourceCodeUrl, r.repoUrl), r]),
  );
  return repoUrlsSync().map((url) => {
    const c = cache.get(url);
    const repo = c?.repo ?? null;
    let entries: EntryView[] = [];
    let format = "harbor";
    let foreign: RepoView["foreign"] = null;
    if (repo && repo.plugins.length > 0) {
      entries = repo.plugins.map((m) => {
        const cur = installedNative.get(m.id);
        return {
          id: m.id,
          name: m.name,
          version: m.version,
          lang: m.lang ? [m.lang] : [],
          nsfw: m.nsfw,
          icon: m.icon,
          format: "harbor",
          installed: !!cur,
          installedId: cur?.id ?? null,
          installedVersion: cur?.version ?? null,
          updateAvailable: !!cur && cur.version !== m.version,
          repoDisabled: false,
        };
      });
    } else if (c?.index) {
      format = "mangayomi";
      entries = c.index.map((e) => {
        const id = mangayomiEntryId(e, url);
        const cur = installedMy.get(scriptHref(e.sourceCodeUrl, url));
        return {
          id,
          name: e.name,
          version: String(e.version ?? "0"),
          lang: e.lang ? [e.lang] : [],
          nsfw: e.isNsfw === true,
          icon: typeof e.iconUrl === "string" ? e.iconUrl : undefined,
          format: "mangayomi",
          installed: !!cur,
          installedId: cur?.id ?? null,
          installedVersion: cur?.version ?? null,
          updateAvailable: !!cur && cur.version !== String(e.version ?? "0"),
          repoDisabled: false,
        };
      });
    } else if (repo?.foreign) {
      format = repo.foreign.kind;
      foreign = repo.foreign.kind === "mangayomi" ? null : repo.foreign.kind;
    }
    return {
      kind: "manga",
      url,
      name: repoTitle(repo?.name, url),
      host: repoHost(url),
      format,
      entries,
      installedCount: entries.filter((e) => e.installed).length,
      updates: entries.filter((e) => e.updateAvailable).length,
      checkedAt: c?.checkedAt ?? null,
      error: c?.error ?? null,
      loading: c?.loading ?? !c,
      foreign,
    };
  });
}

let loaded: Promise<void> | null = null;

export const mangaKind: KindAdapter = {
  kind: "manga",
  label: "Manga",
  load: () => {
    if (!loaded) {
      loaded = (async () => {
        await Promise.all([loadInstalledPlugins(), loadRepos(), loadMangayomiSources()]);
        await Promise.all(repoUrlsSync().map((url) => browse(url)));
      })().catch(() => {
        loaded = null;
      });
    }
    return loaded;
  },
  subscribe,
  repos: repoViews,
  plugins: pluginViews,
  addRepo: async (raw) => {
    const url = normalizeRepoUrl(raw);
    if (repoUrlsSync().includes(url)) throw new PluginError("already-added");
    try {
      await addRepo(url);
    } catch {
      throw new PluginError("no-answer");
    }
    await browse(url);
    const view = repoViews().find((r) => r.url === url);
    if (!view) throw new PluginError("no-answer");
    return view;
  },
  refreshRepo: browse,
  removeRepo: async (url) => {
    await removeRepo(url);
    cache.delete(url);
    notify();
  },
  install: async (repoUrl, entryId) => {
    const c = cache.get(repoUrl);
    const manifest = c?.repo?.plugins.find((m) => m.id === entryId);
    if (manifest) {
      await installPlugin(manifest, repoUrl);
      return;
    }
    const entry = c?.index?.find((e) => mangayomiEntryId(e, repoUrl) === entryId);
    if (!entry) throw new PluginError("no-answer");
    await installMangayomiSource(entry, repoUrl);
  },
  installAll: (repoUrl, onProgress) => importMangayomiRepo(repoUrl, onProgress),
  uninstall: async (id) => {
    if (id.startsWith("my-")) {
      await removeMangayomiRecord(id);
      return;
    }
    await uninstallPlugin(id);
  },
  setEnabled: async (id, enabled) => {
    if (id.startsWith("my-")) {
      const rec = mangayomiSourcesSync().find((r) => r.id === id);
      if (!rec || rec.enabled === enabled) return;
      if (!enabled) disposeMangayomiSource(id);
      await saveMangayomiSource({ ...rec, enabled });
      return;
    }
    await setPluginEnabled(id, enabled);
  },
};
