import {
  addEBookRepo,
  browseEBookRepo,
  ebookRepoUrls,
  installEBookPlugin,
  installedEBookPlugins,
  loadEBookExtensions,
  removeEBookPlugin,
  removeEBookRepo,
  setEBookPluginEnabled,
  subscribeEBookExtensions,
  type EBookPluginRepo,
} from "@/lib/ebook/extensions";
import { normalizeRepoUrl, repoTitle } from "@/lib/streams/plugins/manifest";
import { PluginError } from "@/lib/streams/plugins/types";
import { repoHost, type EntryView, type KindAdapter, type PluginView, type RepoView } from "../types";

type Cached = { repo: EBookPluginRepo | null; error: string | null; loading: boolean; checkedAt: number | null };

const cache = new Map<string, Cached>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

async function browse(url: string): Promise<void> {
  const cur = cache.get(url) ?? { repo: null, error: null, loading: false, checkedAt: null };
  cache.set(url, { ...cur, loading: true });
  notify();
  try {
    const repo = await browseEBookRepo(url);
    cache.set(url, { repo, error: null, loading: false, checkedAt: Date.now() });
  } catch {
    cache.set(url, { ...cur, loading: false, error: "no-answer", checkedAt: Date.now() });
  }
  notify();
}

function pluginViews(): PluginView[] {
  return installedEBookPlugins().map((p) => ({
    kind: "ebook",
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
}

function repoViews(): RepoView[] {
  const installed = new Map(installedEBookPlugins().map((p) => [p.id, p]));
  return ebookRepoUrls().map((url) => {
    const c = cache.get(url);
    const repo = c?.repo ?? null;
    const entries: EntryView[] = (repo?.plugins ?? []).map((m) => {
      const cur = installed.get(m.id);
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
    return {
      kind: "ebook",
      url,
      name: repoTitle(repo?.name, url),
      host: repoHost(url),
      format: "harbor",
      entries,
      installedCount: entries.filter((e) => e.installed).length,
      updates: entries.filter((e) => e.updateAvailable).length,
      checkedAt: c?.checkedAt ?? null,
      error: c?.error ?? null,
      loading: c?.loading ?? !c,
      foreign: null,
    };
  });
}

let loaded: Promise<void> | null = null;

export const ebookKind: KindAdapter = {
  kind: "ebook",
  label: "Books",
  load: () => {
    if (!loaded) {
      loaded = (async () => {
        await loadEBookExtensions();
        await Promise.all(ebookRepoUrls().map((url) => browse(url)));
      })().catch(() => {
        loaded = null;
      });
    }
    return loaded;
  },
  subscribe: (cb) => {
    listeners.add(cb);
    const a = subscribeEBookExtensions(cb);
    return () => {
      listeners.delete(cb);
      a();
    };
  },
  repos: repoViews,
  plugins: pluginViews,
  addRepo: async (raw) => {
    const url = normalizeRepoUrl(raw);
    if (ebookRepoUrls().includes(url)) throw new PluginError("already-added");
    try {
      await addEBookRepo(url);
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
    await removeEBookRepo(url);
    cache.delete(url);
    notify();
  },
  install: async (repoUrl, entryId) => {
    const item = cache.get(repoUrl)?.repo?.plugins.find((m) => m.id === entryId);
    if (!item) throw new PluginError("no-answer");
    await installEBookPlugin(item, repoUrl);
  },
  uninstall: removeEBookPlugin,
  setEnabled: setEBookPluginEnabled,
};
