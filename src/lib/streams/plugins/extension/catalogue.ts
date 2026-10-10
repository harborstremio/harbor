import type { Meta } from "@/lib/cinemeta";
import { PLUGIN_ADDON_PREFIX } from "../addon";
import { capstanId } from "./detail";
import { readListing } from "./listing";
import { metaType, providerMetaType } from "./meta-type";
import type { InstalledStreamPlugin, PluginCatalogue } from "../types";
import type { BridgeProvider, BridgeSearchItem } from "./bridge";
import { bridgeCatalogue, bridgeCataloguePage, bridgeProviders } from "./bridge";

const MAX_PROVIDERS = 4;
const MAX_ROWS_PER_PROVIDER = 12;
const MAX_ROWS_PER_PLUGIN = 24;
const MAX_ITEMS = 60;
const EXHAUSTED_MAX = 200;

/** The catalogue's identity folded into one url shaped string, because that is the field every
 * browse surface already persists for a catalogue and reads back to fetch it again. */
export function extensionCatalogueBase(pluginId: string, providerId: string): string {
  return `${PLUGIN_ADDON_PREFIX}${pluginId}/${providerId}`;
}

export function parseExtensionCatalogueBase(
  base: string,
): { pluginId: string; providerId: string } | null {
  if (!base.startsWith(PLUGIN_ADDON_PREFIX)) return null;
  const rest = base.slice(PLUGIN_ADDON_PREFIX.length);
  const cut = rest.indexOf("/");
  if (cut <= 0) return null;
  const pluginId = rest.slice(0, cut);
  const providerId = rest.slice(cut + 1);
  return pluginId && providerId ? { pluginId, providerId } : null;
}

export function isExtensionCatalogueBase(base: string): boolean {
  return parseExtensionCatalogueBase(base) != null;
}

/** Providers are not filtered by their declared home page flag: the layer stands a row up for a
 * provider that answers the call without declaring one, and that row is its only entry point. */
export function providersOf(plugin: InstalledStreamPlugin, all: BridgeProvider[]): BridgeProvider[] {
  const named = new Set(plugin.native?.providerIds ?? []);
  const extensionId = plugin.native?.extensionId ?? plugin.entryId;
  return all
    .filter((p) => named.has(p.id) || p.extensionId === extensionId)
    .slice(0, MAX_PROVIDERS);
}

export async function listExtensionCatalogues(
  plugin: InstalledStreamPlugin,
  log: (level: string, text: string) => void,
): Promise<PluginCatalogue[]> {
  const providers = providersOf(plugin, await bridgeProviders());
  const out: PluginCatalogue[] = [];
  for (const provider of providers) {
    if (out.length >= MAX_ROWS_PER_PLUGIN) break;
    // One provider refusing is not the plugin refusing, so it costs its own rows and is said out
    // loud rather than leaving a plugin looking as though it offers nothing to browse.
    const rows = await bridgeCatalogue(provider.id).catch((e: unknown) => {
      log("warn", `${provider.name}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    });
    const type = providerMetaType(provider.types ?? []);
    for (const row of rows.slice(0, MAX_ROWS_PER_PROVIDER)) {
      out.push({
        pluginId: plugin.id,
        pluginName: plugin.name,
        pluginIcon: plugin.icon,
        providerId: provider.id,
        providerName: provider.name,
        type,
        row: row.name,
      });
      if (out.length >= MAX_ROWS_PER_PLUGIN) break;
    }
  }
  return out;
}

function text(v: unknown): string {
  if (typeof v !== "string") return "";
  // eslint-disable-next-line no-control-regex -- Strip protocol control characters from plugin text.
  return v.replace(/[\x00-\x1f\x7f]/g, "").trim();
}

function image(v: unknown): string | undefined {
  const s = text(v);
  return /^https?:\/\//i.test(s) ? s : undefined;
}

export function metaFor(cat: PluginCatalogue, item: BridgeSearchItem): Meta | null {
  const raw = text(item.name);
  const read = readListing(raw);
  const name = read.title.slice(0, 300);
  const url = text(item.url);
  if (!name || !url) return null;
  return {
    id: capstanId(cat.providerId, url),
    type: metaType(item.type, cat.type),
    name,
    poster: image(item.posterUrl),
    // What the provider wrote beyond the title, kept so a badge can be read from it later and so
    // nothing the title cut off is lost.
    listingExtras: read.rest
      ? {
          rest: read.rest,
          languages: read.languages,
          quality: read.quality,
          resolutions: read.resolutions,
          hdr: read.hdr,
        }
      : undefined,
    listingYear: read.year ?? undefined,
    pluginQuality: text(item.quality).slice(0, 40) || read.quality[0] || undefined,
    // The row's source, kept so playing it asks this plugin rather than every plugin: the id
    // alone names it, and the base carries which of its providers listed it.
    addonOrigin: {
      id: cat.pluginId,
      name: cat.pluginName,
      logo: cat.pluginIcon,
      base: extensionCatalogueBase(cat.pluginId, cat.providerId),
    },
  };
}

/** The page a row said was its last. A provider that ignores the page number answers the same
 * items forever, and asking it again costs a real request into a real service. */
const exhausted = new Map<string, number>();

function rowKey(cat: PluginCatalogue): string {
  return `${cat.providerId}|${cat.row}`;
}

/** A page of a row, briefly. The hero and the rail below it ask for the same first page, and a
 * provider is a service someone runs: two interfaces reading it should cost it one request. */
const PAGE_TTL_MS = 2 * 60_000;
const PAGE_CACHE_MAX = 60;
const pages = new Map<string, { at: number; metas: Meta[] }>();

function rememberPage(key: string, metas: Meta[]): void {
  pages.delete(key);
  pages.set(key, { at: Date.now(), metas });
  while (pages.size > PAGE_CACHE_MAX) {
    const first = pages.keys().next().value;
    if (first === undefined) break;
    pages.delete(first);
  }
}

export async function extensionCatalogueMetas(
  cat: PluginCatalogue,
  page: number,
): Promise<Meta[]> {
  const asked = Math.max(1, Math.trunc(page));
  const key = rowKey(cat);
  const last = exhausted.get(key);
  if (last != null && asked > last) return [];
  const cacheKey = `${key}|${asked}`;
  const cached = pages.get(cacheKey);
  if (cached && Date.now() - cached.at < PAGE_TTL_MS) return cached.metas;
  const found = await bridgeCataloguePage(cat.providerId, cat.row, asked);
  if (!found.hasNext) {
    if (exhausted.size >= EXHAUSTED_MAX) exhausted.clear();
    exhausted.set(key, asked);
  } else {
    exhausted.delete(key);
  }
  const out: Meta[] = [];
  const seen = new Set<string>();
  for (const item of found.items.slice(0, MAX_ITEMS)) {
    const meta = metaFor(cat, item);
    if (!meta || seen.has(meta.id)) continue;
    seen.add(meta.id);
    out.push(meta);
  }
  rememberPage(cacheKey, out);
  return out;
}
