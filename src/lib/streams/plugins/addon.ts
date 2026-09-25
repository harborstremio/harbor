import type { Addon } from "@/lib/addons";
import { adultContentHidden } from "@/lib/addons-store/adult-filter";
import { dwarn } from "@/lib/debug";
import type { StreamRequest } from "../addons";
import type { Stream } from "../types";
import { toStreams } from "./adapter";
import { repoKey } from "./manifest";
import { PRELUDE_VERSION } from "./provider-compat/prelude";
import { buildPluginRequest } from "./request";
import { recordSkip, runStreamPlugin } from "./runtime";
import { settingsFingerprint } from "./source";
import { installedStreamPluginsSync } from "./store";
import type { InstalledStreamPlugin } from "./types";

export const PLUGIN_ADDON_PREFIX = "harbor-plugin://";
const REPO_ADDON_PREFIX = `${PLUGIN_ADDON_PREFIX}repo/`;

let tmdbKey: string | undefined;

export function setStreamPluginConfig(cfg: { tmdbKey?: string }): void {
  tmdbKey = cfg.tmdbKey || undefined;
}

export function isPluginAddon(addon: Pick<Addon, "transportUrl">): boolean {
  return addon.transportUrl.startsWith(PLUGIN_ADDON_PREFIX);
}

export function runnableStreamPlugins(): InstalledStreamPlugin[] {
  const hideAdult = adultContentHidden();
  return installedStreamPluginsSync().filter(
    (p) =>
      p.enabled &&
      !p.repoDisabled &&
      !p.incompatible &&
      !p.autoPaused &&
      p.listed &&
      !(p.nsfw && hideAdult),
  );
}

function union(lists: string[][]): string[] {
  return [...new Set(lists.flat())];
}

function pluginAddon(p: InstalledStreamPlugin): Addon {
  return {
    manifest: {
      id: p.id,
      name: p.name,
      logo: p.icon,
      description: p.description,
      resources: [{ name: "stream", types: p.types, idPrefixes: p.idPrefixes }],
      types: p.types,
      idPrefixes: p.idPrefixes,
      behaviorHints: p.nsfw ? { adult: true } : undefined,
    },
    transportUrl: `${PLUGIN_ADDON_PREFIX}${p.id}`,
  };
}

function repoAddon(repoUrl: string, plugins: InstalledStreamPlugin[]): Addon {
  const key = repoKey(repoUrl);
  const types = union(plugins.map((p) => p.types));
  const idPrefixes = union(plugins.map((p) => p.idPrefixes));
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

export function pluginAddons(opts: { enabled: boolean; groupByRepo: boolean }): Addon[] {
  if (!opts.enabled) return [];
  const plugins = runnableStreamPlugins();
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
