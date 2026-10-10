import { extensionPluginStreams } from "../adapter";
import type { InstalledStreamPlugin, PluginStream, StreamPluginRequest } from "../types";
import type { BridgeProvider } from "./bridge";
import {
  bridgeLoad,
  bridgeLoadLinks,
  bridgeProviders,
  bridgeSearch,
  extensionsSupported,
  warmBridge,
} from "./bridge";
import { identityKey, pickEpisodes, rankCandidates, yearRejects } from "./match";

const MAX_PROVIDERS = 4;
const MAX_CANDIDATES = 3;
const MEMO_MAX = 200;

const pageMemo = new Map<string, string>();

export type ExtensionHooks = {
  log: (level: string, text: string) => void;
  seen: (url: string) => void;
  call: () => void;
  /** One line a user can act on, kept where the plugin's state is shown. Only ever the service
   * saying it is unavailable, never a mismatch the user could have caused. */
  outage: (text: string) => void;
};

function remember(key: string, url: string): void {
  pageMemo.delete(key);
  pageMemo.set(key, url);
  while (pageMemo.size > MEMO_MAX) {
    const first = pageMemo.keys().next().value;
    if (first === undefined) break;
    pageMemo.delete(first);
  }
}

async function providersFor(plugin: InstalledStreamPlugin): Promise<BridgeProvider[]> {
  const all = await bridgeProviders();
  const named = plugin.native?.providerIds ?? [];
  if (named.length) {
    const wanted = new Set(named);
    const hits = all.filter((p) => wanted.has(p.id));
    if (hits.length) return hits.slice(0, MAX_PROVIDERS);
  }
  const extensionId = plugin.native?.extensionId ?? plugin.entryId;
  return all.filter((p) => p.extensionId === extensionId).slice(0, MAX_PROVIDERS);
}

function limit<T>(work: Promise<T>, deadline: number, signal: AbortSignal, what: string): Promise<T> {
  const left = deadline - Date.now();
  if (signal.aborted) return Promise.reject(abortError());
  if (left <= 0) return Promise.reject(new Error(`${what} had no time left`));
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} timed out after ${left}ms`)), left);
    const onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
    });
  });
}

function abortError(): Error {
  const e = new Error("aborted");
  e.name = "AbortError";
  return e;
}

function spent(deadline: number, signal: AbortSignal): boolean {
  return signal.aborted || Date.now() >= deadline;
}

function reason(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The log keeps the provider's name because a plugin may register several; the outage does not,
 * because every surface that shows one already names the plugin next to it. */
function outage(provider: BridgeProvider, note: string, hooks: ExtensionHooks): void {
  hooks.log("warn", `${provider.name}: ${note}`);
  hooks.outage(note);
}

/** The page an item named for itself. A catalogue row carries the page it was listed from, and
 * that is the page the person was looking at; a title search can land on a different one -- the
 * page it picks may carry no episode list at all. Only the provider that listed the row can open
 * it, so a named page counts for that provider and no other. */
export function namedPage(req: StreamPluginRequest, providerId: string): string | undefined {
  if (!req.providerId || req.providerId !== providerId) return undefined;
  const url = req.url?.trim();
  return url && /^https?:\/\//i.test(url) ? url : undefined;
}

async function fromProvider(
  provider: BridgeProvider,
  req: StreamPluginRequest,
  signal: AbortSignal,
  deadline: number,
  hooks: ExtensionHooks,
): Promise<PluginStream[]> {
  const key = `${provider.id}|${identityKey(req)}`;
  const named = namedPage(req, provider.id);
  const remembered = pageMemo.get(key);

  const attempt = async (url: string): Promise<PluginStream[]> => {
    try {
      hooks.call();
      const loaded = await limit(
        bridgeLoad(provider.id, url),
        deadline,
        signal,
        `${provider.name} load`,
      );
      const media = loaded.media;
      if (!media) {
        if (loaded.note) outage(provider, loaded.note, hooks);
        else hooks.log("warn", `${provider.name}: nothing on the page for ${url}`);
        return [];
      }
      if (yearRejects(media, req)) {
        hooks.log("warn", `${provider.name}: ${media.name} is ${media.year}, wanted ${req.year}`);
        return [];
      }
      const datas = pickEpisodes(media, req);
      if (!datas.length) {
        hooks.log("warn", `${provider.name}: ${media.name} has no S${req.season}E${req.episode}`);
        return [];
      }
      const out: PluginStream[] = [];
      for (const data of datas) {
        if (spent(deadline, signal)) break;
        hooks.call();
        const set = await limit(
          bridgeLoadLinks(provider.id, data),
          deadline,
          signal,
          `${provider.name} links`,
        );
        if (!set.links.length && set.note) outage(provider, set.note, hooks);
        const track = media.episodes?.find((e) => e.data === data)?.track ?? "";
        const made = extensionPluginStreams(set, {
          media: media.name,
          track,
          group: `${provider.id}|${identityKey(req)}`,
        });
        for (const s of made) if (s.url) hooks.seen(s.url);
        out.push(...made);
      }
      return out;
    } catch (e) {
      if (signal.aborted) throw e;
      hooks.log("warn", `${provider.name}: ${reason(e)}`);
      return [];
    }
  };

  // The row's own page comes first, and outranks the memo. It is the page the item was listed
  // from, so the episodes it carries are the episodes the list showed -- and a row the provider
  // numbered nothing gets its address from its position in that list, so any other page makes the
  // number name a different episode. Searching by title lands on whatever page the search ranks
  // first, whose numbering need not line up with the list at all.
  const pages: string[] = [];
  if (named) pages.push(named);
  else if (remembered) pages.push(remembered);
  for (const url of pages) {
    if (spent(deadline, signal)) break;
    const out = await attempt(url);
    if (out.length) {
      // A row's own page answers for one row, so it is not kept under the title's key.
      if (url !== named) remember(key, url);
      return out;
    }
  }

  // Nothing came of the page the row named, so fall back to finding one by title.
  const urls: string[] = [];
  hooks.call();
  const found = await limit(
    bridgeSearch(provider.id, req.title, false),
    deadline,
    signal,
    `${provider.name} search`,
  );
  for (const c of rankCandidates(found.items, req, MAX_CANDIDATES)) urls.push(c.url);
  if (!urls.length) {
    if (found.note) outage(provider, found.note, hooks);
    else
      hooks.log("warn", `${provider.name}: ${found.items.length} results, none matched ${req.title}`);
    if (remembered) pageMemo.delete(key);
    return [];
  }
  for (const url of urls) {
    if (spent(deadline, signal)) break;
    const out = await attempt(url);
    if (out.length) {
      remember(key, url);
      return out;
    }
  }
  if (remembered) pageMemo.delete(key);
  return [];
}

export async function runExtensionPlugin(
  plugin: InstalledStreamPlugin,
  req: StreamPluginRequest,
  signal: AbortSignal,
  timeoutMs: number,
  hooks: ExtensionHooks,
): Promise<PluginStream[]> {
  if (!extensionsSupported()) {
    hooks.log("warn", "Extensions run in the desktop app only");
    return [];
  }
  // Spawning the bridge and restoring every installed extension happens on the first call and
  // costs seconds. That is setup, not this plugin's work, so it is paid before the clock starts:
  // charged to the deadline it left a slow plugin with too little budget and made its first run
  // report nothing while its second answered.
  await warmBridge();
  const deadline = Date.now() + timeoutMs;
  const providers = await limit(providersFor(plugin), deadline, signal, "provider list");
  if (!providers.length) {
    throw new Error(`${plugin.name} is not loaded in the extension bridge`);
  }
  // Every provider the plugin carries is asked, exactly as for any other request. The page a
  // catalogue row was listed from is only a fallback, and fromProvider already opens it only for
  // the provider that owns it, so narrowing the fan-out here would cost the plugin its other
  // sources for no gain.
  const settled = await Promise.allSettled(
    providers.map((p) => fromProvider(p, req, signal, deadline, hooks)),
  );
  const out: PluginStream[] = [];
  let failed = 0;
  let firstError: unknown = null;
  for (const r of settled) {
    if (r.status === "fulfilled") {
      out.push(...r.value);
      continue;
    }
    failed += 1;
    if (firstError == null) firstError = r.reason;
  }
  if (!out.length && failed === settled.length && firstError != null) throw firstError;
  return out;
}
