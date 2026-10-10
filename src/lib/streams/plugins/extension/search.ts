import type { Meta } from "@/lib/cinemeta";
import { budget, gated } from "../catalogues";
import { pluginCatalogueSources } from "../runnable";
import type { InstalledStreamPlugin, PluginCatalogue } from "../types";
import { bridgeProviders, bridgeSearch, warmBridge, type BridgeProvider } from "./bridge";
import { metaFor, providersOf } from "./catalogue";
import { relevanceScore } from "./match";
import { providerMetaType } from "./meta-type";

const SEARCH_TIMEOUT_MS = 20_000;
const MAX_PER_PROVIDER = 30;
const MAX_PER_PLUGIN = 60;

/** One plugin's providers asked in parallel; each provider's own answers kept apart.
 *
 * Providers answer in parallel and the plugin's own deadline covers the lot, because it is the
 * plugin's budget rather than any one provider's. A provider that fails costs only its own shelf. */
async function searchOne(
  plugin: InstalledStreamPlugin,
  providers: BridgeProvider[],
  query: string,
): Promise<ProviderSearchGroup[]> {
  const settled = await Promise.allSettled(
    providers.map(async (provider) => {
      const cat: PluginCatalogue = {
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginIcon: plugin.icon,
        providerId: provider.id,
        providerName: provider.name,
        type: providerMetaType(provider.types ?? []),
        row: query,
      };
      // A provider that declares a quick search is asked with it, which is what that flag is for;
      // one that does not gets the ordinary search rather than a quick search it never wrote.
      const found = await bridgeSearch(provider.id, query, provider.hasQuickSearch);
      // Sorted before anything is capped, so the cap keeps the answers that were asked for rather
      // than whichever the provider happened to list first.
      const ranked = found.items
        .slice(0, MAX_PER_PROVIDER)
        .map((item) => metaFor(cat, item))
        .filter((meta): meta is Meta => meta !== null)
        .map((meta) => ({ meta, score: relevanceScore(meta.name, query) }))
        .sort((a, b) => b.score - a.score)
        .map((entry) => entry.meta);
      return { providerId: provider.id, providerName: provider.name, metas: ranked };
    }),
  );
  return settled
    .filter(
      (result): result is PromiseFulfilledResult<ProviderSearchGroup> => result.status === "fulfilled",
    )
    .map((result) => result.value);
}

/** One provider's answer, which is one shelf. A plugin is a bundle of providers, and a provider is
 * one place a title can be found: the same film on two of them is two listings with two links, and
 * one may play while the other does not, so they are shown as two rather than folded into one. */
export type ProviderSearchGroup = {
  providerId: string;
  providerName: string;
  metas: Meta[];
};

/** One plugin's answer, kept apart from every other plugin's, and inside it one group per provider.
 * A provider is a source of a title, not a source of the plugin's identity, so what one plugin found
 * is read as that plugin's; a provider is where within that plugin it was found. */
export type PluginSearchGroup = {
  pluginId: string;
  pluginName: string;
  pluginIcon?: string;
  providers: ProviderSearchGroup[];
  /** Every provider's hits, for counting rather than for drawing. */
  metas: Meta[];
};

/** Every plugin's hits as one list, with the same listing from the same provider appearing once.
 *
 * A title listed by two providers of one plugin is two listings, not a duplicate: two links, one of
 * which may work. Only the same link twice is folded, which is what an id names. */
export function mergeHits(groups: readonly Meta[][], max: number): Meta[] {
  const out: Meta[] = [];
  const seen = new Set<string>();
  for (const group of groups) {
    for (const meta of group) {
      if (seen.has(meta.id)) continue;
      seen.add(meta.id);
      out.push(meta);
      if (out.length >= max) return out;
    }
  }
  return out;
}

/** One plugin's answer, with each of its providers kept as its own group.
 *
 * The same title found by two plugins stays two plugins, and within one plugin it stays one group
 * per provider: a provider is one place to find it, with its own link. A provider that found nothing
 * gets no group, and a plugin that found nothing gets none either, so neither leaves an empty shelf
 * behind. The order is the order the providers were asked in, which is the order they are listed in
 * everywhere else, so a title does not move about between visits.
 *
 * A group is capped across all of a plugin's providers rather than per provider, so one plugin
 * cannot fill the page by answering from four of them. */
export function searchGroups(
  plugin: { id: string; name: string; icon?: string },
  found: readonly ProviderSearchGroup[] | null,
  maxPerPlugin: number,
): PluginSearchGroup | null {
  if (!found?.length) return null;
  const kept: ProviderSearchGroup[] = [];
  const seen = new Set<string>();
  for (const group of found) {
    const metas: Meta[] = [];
    for (const meta of group.metas) {
      if (seen.has(meta.id)) continue;
      seen.add(meta.id);
      metas.push(meta);
      if (seen.size >= maxPerPlugin) break;
    }
    if (metas.length) kept.push({ ...group, metas });
    if (seen.size >= maxPerPlugin) break;
  }
  const metas = kept.flatMap((group) => group.metas);
  if (!metas.length) return null;
  return {
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginIcon: plugin.icon,
    providers: kept,
    metas,
  };
}

/** What the installed plugins have for a title, each plugin's answer kept apart.
 *
 * The searches run together because a search is one round trip per provider, not one per plugin,
 * and the bridge takes eight calls at once. A plugin that fails costs only its own group.
 *
 * `onPartial` is handed the answers as each plugin finishes, in plugin order, so a surface can draw
 * what has arrived instead of waiting for the slowest of them. Every plugin is still awaited before
 * this resolves: the partials are a preview, and the return value is the answer. */
export async function searchPlugins(
  query: string,
  onPartial?: (groups: PluginSearchGroup[]) => void,
): Promise<PluginSearchGroup[]> {
  const wanted = query.trim();
  if (!wanted) return [];
  const plugins = pluginCatalogueSources();
  if (!plugins.length) return [];
  await warmBridge();
  const providers = await bridgeProviders().catch(() => [] as BridgeProvider[]);
  if (!providers.length) return [];

  const found = new Map<number, PluginSearchGroup>();
  const inOrder = () => plugins.flatMap((_, i) => (found.has(i) ? [found.get(i)!] : []));

  await Promise.allSettled(
    plugins.map(async (plugin, i) => {
      // A plugin that fails, or runs out of its budget, costs its own group and nobody else's.
      const groups = await gated(plugin, `"${wanted}"`, budget(plugin, SEARCH_TIMEOUT_MS), () =>
        searchOne(plugin, providersOf(plugin, providers), wanted),
      ).catch(() => null);
      const group = groups ? searchGroups(plugin, groups, MAX_PER_PLUGIN) : null;
      if (group && !found.has(i)) found.set(i, group);
      // Nothing is sent until something is found: an empty preview would read as "no plugin has
      // this" while the rest are still being asked, and the answer to that is the return value.
      if (onPartial && found.size > 0) onPartial(inOrder());
    }),
  );
  return inOrder();
}

/** One plugin's matches for a title, a page at a time, for a surface that walks past the shelves.
 *
 * The providers page: an extension that only ever answers a first page has nothing past it, so its
 * second page comes back empty and the walk stops on its own rather than repeating what it sent.
 * Nothing is capped here, because getting past the cap is the whole point of the walk. */
export async function searchPluginPage(
  pluginId: string,
  query: string,
  page: number,
): Promise<Meta[]> {
  const wanted = query.trim();
  const plugin = pluginCatalogueSources().find((p) => p.id === pluginId);
  if (!plugin || !wanted || page < 1) return [];
  await warmBridge();
  const providers = await bridgeProviders().catch(() => [] as BridgeProvider[]);
  const mine = providersOf(plugin, providers);
  if (!mine.length) return [];
  const settled = await Promise.allSettled(
    mine.map(async (provider) => {
      const cat: PluginCatalogue = {
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginIcon: plugin.icon,
        providerId: provider.id,
        providerName: provider.name,
        type: providerMetaType(provider.types ?? []),
        row: wanted,
      };
      const found = await gated(plugin, `${wanted} page ${page}`, budget(plugin, SEARCH_TIMEOUT_MS), () =>
        bridgeSearch(provider.id, wanted, provider.hasQuickSearch, page),
      );
      return found.items
        .map((item) => metaFor(cat, item))
        .filter((meta): meta is Meta => meta !== null);
    }),
  );
  const out: Meta[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== "fulfilled") continue;
    for (const meta of result.value) {
      if (seen.has(meta.id)) continue;
      seen.add(meta.id);
      out.push(meta);
    }
  }
  return out;
}
