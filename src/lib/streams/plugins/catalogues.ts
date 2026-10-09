import type { Meta, MetaType } from "@/lib/cinemeta";
import { pluginCatalogueSources } from "./runnable";
import { bridgeProviders, extensionsSupported, warmBridge } from "./extension/bridge";
import {
  extensionCatalogueMetas,
  listExtensionCatalogues,
  parseExtensionCatalogueBase,
} from "./extension/catalogue";
import { acquire, release } from "./gate";
import { pushLog } from "./runtime";
import { installedStreamPluginsSync, loadInstalledStreamPlugins, streamPluginById } from "./store";
import type { InstalledStreamPlugin, PluginCatalogue } from "./types";

const TTL_MS = 5 * 60_000;
/** How soon a look that could not answer is asked again. Long enough not to spin while the bridge
 * starts, short enough that a browse surface already on screen fills in without being reopened. */
const RETRY_MS = 5_000;
const LIST_TIMEOUT_MS = 25_000;
const PAGE_TIMEOUT_MS = 20_000;

const subs = new Set<() => void>();
let cache: PluginCatalogue[] = [];
let checkedAt = 0;
let print = "";
/** Whether the last look answered, as opposed to merely failing to. Only an answer is worth
 * remembering, and only an answer stops the retry. */
let answered = false;
let inflight: Promise<PluginCatalogue[]> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function fingerprint(plugins: InstalledStreamPlugin[]): string {
  return plugins.map((p) => `${p.id}@${p.hash}`).join("|");
}

function keys(list: PluginCatalogue[]): string {
  return list.map((c) => `${c.pluginId}|${c.providerId}|${c.row}`).join("|");
}

function notify(): void {
  for (const cb of subs) cb();
}

export function subscribeExtensionCatalogues(cb: () => void): () => void {
  subs.add(cb);
  return () => {
    subs.delete(cb);
    // Nothing is watching the rows any more, so there is nothing left to retry for.
    if (!subs.size && retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
}

export function extensionCataloguesSync(): PluginCatalogue[] {
  return cache;
}

export function budget(plugin: InstalledStreamPlugin, ceiling: number): number {
  return plugin.timeoutMs ? Math.min(plugin.timeoutMs, ceiling) : ceiling;
}

/** Gives [work] a deadline of its own. Every browse surface asks for a page through a plain fetcher
 * with no signal to carry, so the deadline is all there is to stop a dead provider holding a row. */
function within<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${ms}ms`)), ms);
    work.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

/** Shares the one plugin gate and the plugin's own log, and deliberately leaves the health record
 * alone: that ledger answers how a search for a title went, and a browse would overwrite it with a
 * count for a row nobody asked about, which the picker reads back as an outage. */
export async function gated<T>(
  plugin: InstalledStreamPlugin,
  what: string,
  ms: number,
  work: () => Promise<T>,
): Promise<T> {
  await acquire();
  const started = performance.now();
  try {
    const value = await within(work(), ms, what);
    pushLog(plugin.id, "info", `${what} in ${((performance.now() - started) / 1000).toFixed(1)}s`);
    return value;
  } catch (e) {
    pushLog(plugin.id, "warn", `${what}: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  } finally {
    release();
  }
}

async function collect(
  plugins: InstalledStreamPlugin[],
): Promise<{ rows: PluginCatalogue[]; answered: boolean }> {
  await warmBridge();
  // A bridge that lists no providers has not finished loading its extensions. An extension that
  // genuinely offers no rows is rare; a bridge that is merely late is not, and telling them apart
  // here is what keeps a slow start from being remembered as "this plugin offers nothing".
  const providers = await bridgeProviders().catch(() => null);
  if (!providers?.length) return { rows: [], answered: false };
  const settled = await Promise.allSettled(
    plugins.map((plugin) =>
      gated(plugin, "catalogue rows", budget(plugin, LIST_TIMEOUT_MS), () =>
        listExtensionCatalogues(plugin, (level, text) => pushLog(plugin.id, level, text)),
      ),
    ),
  );
  const rows: PluginCatalogue[] = [];
  let failed = 0;
  for (const r of settled) {
    if (r.status === "fulfilled") rows.push(...r.value);
    else failed += 1;
  }
  return { rows, answered: failed === 0 };
}

/** Asks again, but only while something is watching and only after a look that could not answer,
 * so a provider that genuinely offers nothing is never polled. */
function scheduleRetry(): void {
  if (retryTimer || !subs.size) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (!subs.size) return;
    // Cleared so this retry cannot be swallowed by the short-circuit it is racing: a look started
    // in the meantime would have moved the marker inside the window.
    checkedAt = 0;
    void refreshExtensionCatalogues();
  }, RETRY_MS);
}

async function look(): Promise<PluginCatalogue[]> {
  // The first look can land before the installed set has been read back, and stamping an empty
  // answer then would hold that emptiness for the whole session.
  if (!checkedAt && !installedStreamPluginsSync().length) {
    await loadInstalledStreamPlugins().catch(() => []);
  }
  const plugins = pluginCatalogueSources();
  const next = fingerprint(plugins);
  const fresh = answered ? TTL_MS : RETRY_MS;
  if (next === print && checkedAt && Date.now() - checkedAt < fresh) {
    // Inside a failed look's window with an answer still missing: whoever just asked is waiting on
    // rows that are not in yet, so keep the retry alive rather than letting the ask go unanswered.
    if (!answered) scheduleRetry();
    return cache;
  }
  const collected = plugins.length ? await collect(plugins) : { rows: [], answered: true };
  const changed = keys(collected.rows) !== keys(cache);
  cache = collected.rows;
  print = next;
  checkedAt = Date.now();
  answered = collected.answered;
  if (changed) notify();
  // A surface already on screen read the empty cache this look just replaced. When a failed look
  // fails again the row set does not change, so without this nothing would ever ask again and the
  // tab would stay empty until it was left and reopened.
  if (!answered) scheduleRetry();
  return cache;
}

/** The rows a plugin offers change when it is installed or updated, not while it is browsed, so a
 * fresh look is skipped until the installed set changes or the last answer goes stale. */
export function refreshExtensionCatalogues(): Promise<PluginCatalogue[]> {
  inflight ??= look()
    .catch(() => cache)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export async function extensionCataloguePage(
  base: string,
  row: string,
  type: MetaType,
  page: number,
): Promise<Meta[]> {
  const parsed = parseExtensionCatalogueBase(base);
  if (!parsed || !extensionsSupported()) return [];
  const plugin = streamPluginById(parsed.pluginId);
  if (!plugin || plugin.format !== "android-extension") return [];
  await warmBridge();
  const cat: PluginCatalogue = {
    pluginId: plugin.id,
    pluginName: plugin.name,
    pluginIcon: plugin.icon,
    providerId: parsed.providerId,
    type,
    row,
  };
  return gated(plugin, `${row} page ${page}`, budget(plugin, PAGE_TIMEOUT_MS), () =>
    extensionCatalogueMetas(cat, page),
  );
}
