import type { Addon } from "@/lib/addons";
import { dwarn } from "@/lib/debug";
import type { StreamRequest } from "../addons";
import type { Stream } from "../types";
import { toStreams } from "./adapter";
import { repoKey } from "./manifest";
import { PRELUDE_VERSION } from "./provider-compat/prelude";
import { buildPluginRequest } from "./request";
import { providesOwnRows, runnableStreamPlugins } from "./runnable";
import { recordSkip, runStreamPlugin } from "./runtime";
import { settingsFingerprint } from "./source";
import { installedStreamPluginsSync } from "./store";
import type { InstalledStreamPlugin } from "./types";
import { CAPSTAN_ID_PREFIX } from "./extension/detail";

export const PLUGIN_ADDON_PREFIX = "harbor-plugin://";
const REPO_ADDON_PREFIX = `${PLUGIN_ADDON_PREFIX}repo/`;

let tmdbKey: string | undefined;

export function setStreamPluginConfig(cfg: { tmdbKey?: string }): void {
  tmdbKey = cfg.tmdbKey || undefined;
}

export function isPluginAddon(addon: Pick<Addon, "transportUrl">): boolean {
  return addon.transportUrl.startsWith(PLUGIN_ADDON_PREFIX);
}

/** The plugin a catalogue base belongs to. A row's base names the plugin and the provider
 * (`harbor-plugin://plugin/provider`), while the stream addon is per plugin, so the provider part
 * tells one plugin's rows from another's and the match is on the plugin. A repository grouping is
 * not a plugin and pins nothing. */
export function pluginIdFromCatalogueBase(base: string): string | undefined {
  if (!base.startsWith(PLUGIN_ADDON_PREFIX)) return undefined;
  const rest = base.slice(PLUGIN_ADDON_PREFIX.length);
  if (rest.startsWith("repo/")) return undefined;
  const cut = rest.indexOf("/");
  const id = cut < 0 ? rest : rest.slice(0, cut);
  return id || undefined;
}

/** The stream addon for one installed plugin, for answering an item that names its own source.
 * Undefined while that plugin is not installed and enabled: a catalogue that is no longer here
 * pins nothing, and every plugin stays free rather than all of them standing down for it. */
export function pluginAddonById(pluginId: string): Addon | undefined {
  const found = runnableStreamPlugins().find((p) => p.id === pluginId);
  return found ? pluginAddon(found) : undefined;
}

export { runnableStreamPlugins };

/** The ids a plugin answers to: whatever its repository declared, plus the ids its own catalogue
 * rows are addressed by. A repository cannot declare those for itself, because they are built from
 * the plugin's id at the moment a row is listed. */
export function pluginIdPrefixes(declared: string[]): string[] {
  return [...new Set([...declared, CAPSTAN_ID_PREFIX])];
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

function pluginAddon(p: InstalledStreamPlugin): Addon {
  const idPrefixes = pluginIdPrefixes(p.idPrefixes);
  return {
    manifest: {
      id: p.id,
      name: p.name,
      logo: p.icon,
      description: p.description,
      resources: [{ name: "stream", types: p.types, idPrefixes }],
      types: p.types,
      idPrefixes,
      behaviorHints: p.nsfw ? { adult: true } : undefined,
    },
    transportUrl: `${PLUGIN_ADDON_PREFIX}${p.id}`,
  };
}

function repoAddon(repoUrl: string, plugins: InstalledStreamPlugin[]): Addon {
  const key = repoKey(repoUrl);
  const types = union(plugins.map((p) => p.types));
  const idPrefixes = pluginIdPrefixes(union(plugins.map((p) => p.idPrefixes)));
  return {
    manifest: {
      id: `plugin-repo:${key}`,
      name: plugins[0].repoName,
      logo: plugins.find((p) => p.icon)?.icon,
      resources: [{ name: "stream", types, idPrefixes }],
      types,
      idPrefixes,
      behaviorHints: plugins.some((p) => p.nsfw) ? { adult: true } : undefined,
    },
    transportUrl: `${REPO_ADDON_PREFIX}${key}`,
  };
}

/** The stream addons a surface may ask.
 *
 * A plugin that stands up rows of its own is the one the setting holds back, and only while that
 * setting is off: those rows are its own page, so asking it from anywhere else is opt-in. A plugin
 * with no rows of its own has nothing to browse, and holding it back would leave it with no way to
 * be reached at all, so it is asked either way. */
export function pluginAddons(opts: { groupByRepo: boolean; includeExtensions: boolean }): Addon[] {
  const plugins = runnableStreamPlugins().filter(
    (p) => opts.includeExtensions || !providesOwnRows(p),
  );
  if (!opts.groupByRepo) return plugins.map(pluginAddon);
  const byRepo = new Map<string, InstalledStreamPlugin[]>();
  for (const p of plugins) {
    const list = byRepo.get(p.repoUrl) ?? [];
    list.push(p);
    byRepo.set(p.repoUrl, list);
  }
  return [...byRepo.entries()].map(([url, list]) => repoAddon(url, list));
}

export function pluginsForAddon(addon: Pick<Addon, "transportUrl">): InstalledStreamPlugin[] {
  const url = addon.transportUrl;
  if (url.startsWith(REPO_ADDON_PREFIX)) {
    const key = url.slice(REPO_ADDON_PREFIX.length);
    return runnableStreamPlugins().filter((p) => repoKey(p.repoUrl) === key);
  }
  const id = url.slice(PLUGIN_ADDON_PREFIX.length);
  return runnableStreamPlugins().filter((p) => p.id === id);
}

export function pluginListKey(): string {
  return installedStreamPluginsSync()
    .filter((p) => p.enabled && !p.repoDisabled && !p.incompatible && p.listed)
    .map((p) => `${p.id}@${p.hash}@${settingsFingerprint(p)}`)
    .join("|");
}

export function pluginCacheTokens(): string[] {
  return [
    `prelude:${PRELUDE_VERSION}`,
    ...runnableStreamPlugins().map((p) => `${p.id}@${p.hash}@${settingsFingerprint(p)}`),
  ];
}

export async function runPluginAddon(
  addon: Addon,
  req: StreamRequest,
  pickedId: string,
  signal: AbortSignal,
  timeoutMs: number,
): Promise<Stream[]> {
  const plugins = pluginsForAddon(addon);
  const results = await Promise.allSettled(
    plugins.map(async (plugin) => {
      const request = await buildPluginRequest(req, pickedId, plugin, tmdbKey);
      const native = plugin.format === "android-extension";
      if (plugin.format === "provider-script" && !request.tmdb) {
        recordSkip(plugin, `No TMDB id for ${request.title || pickedId}`);
        return [];
      }
      if (native && !request.title.trim()) {
        recordSkip(plugin, `No title to search for ${pickedId}`);
        return [];
      }
      const budget = plugin.timeoutMs ? Math.min(plugin.timeoutMs, timeoutMs) : timeoutMs;
      const raw = await runStreamPlugin(plugin, request, signal, budget);
      return toStreams(raw, {
        req: request,
        addonId: addon.manifest.id,
        addonName: addon.manifest.name,
        addonUrl: addon.transportUrl,
        pluginName: plugin.name,
        trustHeaders: native,
      });
    }),
  );
  const out: Stream[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") out.push(...r.value);
    else dwarn(`[plugins] ${addon.manifest.name} dropped`, r.reason);
  }
  return out;
}
