import { setItemWithRecovery } from "@/lib/storage-recovery";
import { notifyMangaDataChanged } from "./refresh";
import type { MangaProvider } from "./types";
import { aggregateProvider } from "./sources/aggregate";
import { makeSuwayomiProvider } from "./sources/suwayomi/provider";
import { makeLocalProvider } from "./sources/local";
import { makeHtmlProvider, type HtmlSourceConfig } from "./sources/html";
import {
  communityCatalog,
  refreshCommunityCatalog,
  subscribeCommunity,
  type CommunitySource,
} from "./community";
import { installedPluginsSync, loadInstalledPlugins, subscribePlugins } from "./plugins/store";
import { pluginProvider } from "./plugins/runtime";
import { warmPlugins } from "./plugins/lifecycle";
import { loadRepos } from "./plugins/repos";
import { makeMangayomiProvider, removeMangayomiRecord } from "./sources/mangayomi";
import {
  loadMangayomiSources,
  mangayomiSourcesSync,
  subscribeMangayomiSources,
} from "./sources/mangayomi/store";
import { credentialFreeBase, normalizeSuwayomiBase } from "./sources/suwayomi/base-url";
import { reconcileSuwayomiServers } from "./sources/suwayomi/server-link";

export type MangaSourceKind = "suwayomi" | "local" | "plugin" | "html" | "mangayomi";

export type MangaSourcesState = "loading" | "ready" | "error";

export type MangaSource = {
  id: string;
  name: string;
  baseUrl: string;
  builtin: boolean;
  experimental?: boolean;
  kind?: MangaSourceKind;
  provider?: string;
  iconUrl?: string;
  config?: HtmlSourceConfig;
};

const BUILTIN_PROVIDERS: Record<string, MangaProvider> = {};

const CONFIGURED_KEY = "harbor.manga.configured.v1";
const CUSTOM_KEY = "harbor.manga.sources.v1";
const ACTIVE_KEY = "harbor.manga.activesource.v2";
const RESOLVED_KEY = "harbor.manga.resolved.v1";
const MIGRATED_KEY = "harbor.manga.communityMigrated.v1";

const listeners = new Set<() => void>();
subscribeCommunity(() => notify());
subscribePlugins(() => notify());
subscribeMangayomiSources(() => notify());

export function subscribeMangaSources(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let sourcesMemo: MangaSource[] | null = null;

function notify(): void {
  sourcesMemo = null;
  for (const l of listeners) l();
  notifyMangaDataChanged();
}

function configuredIds(): string[] {
  try {
    const raw = localStorage.getItem(CONFIGURED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeConfigured(ids: string[]): void {
  try {
    localStorage.setItem(CONFIGURED_KEY, JSON.stringify([...new Set(ids)]));
  } catch {
    return;
  }
}

function readCustom(): MangaSource[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.id === "string" && typeof s.baseUrl === "string")
      .filter((s) => s.kind === "suwayomi" || s.kind === "local" || s.kind === "html")
      .map((s) => {
        const config = s.kind === "html" ? (s.config as HtmlSourceConfig) : undefined;
        return {
          id: s.id,
          name: String(s.name ?? s.baseUrl),
          baseUrl: String(s.baseUrl),
          builtin: false,
          kind: s.kind as MangaSourceKind,
          iconUrl: config?.iconUrl,
          config,
        };
      });
  } catch {
    return [];
  }
}

function writeCustom(list: MangaSource[]): boolean {
  try {
    return setItemWithRecovery(CUSTOM_KEY, JSON.stringify(list));
  } catch {
    return false;
  }
}

function communityToSource(c: CommunitySource): MangaSource {
  const kind: MangaSourceKind | undefined = c.kind === "suwayomi" ? "suwayomi" : undefined;
  return {
    id: c.id,
    name: c.name,
    baseUrl: c.baseUrl || "",
    builtin: c.kind === "builtin",
    kind,
    provider: c.provider,
    iconUrl: c.iconUrl,
  };
}

function providerAvailable(c: CommunitySource): boolean {
  if (c.kind !== "builtin") return true;
  return !!c.provider && !!BUILTIN_PROVIDERS[c.provider];
}

export function availableCommunityCatalog(): CommunitySource[] {
  return communityCatalog().filter(providerAvailable);
}

function snapshotUsable(s: MangaSource): boolean {
  if (s.id === "all") return false;
  if (!s.builtin) return true;
  return !!s.provider && !!BUILTIN_PROVIDERS[s.provider];
}

function readResolved(): MangaSource[] {
  try {
    const raw = localStorage.getItem(RESOLVED_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.id === "string" && typeof s.name === "string")
      .filter(snapshotUsable);
  } catch {
    return [];
  }
}

let resolvedJson = "";

function writeResolved(list: MangaSource[]): void {
  const json = JSON.stringify(list);
  if (json === resolvedJson) return;
  resolvedJson = json;
  try {
    setItemWithRecovery(RESOLVED_KEY, json);
  } catch {
    return;
  }
}

function pluginSources(): MangaSource[] {
  return installedPluginsSync()
    .filter((p) => p.enabled)
    .map((p) => ({
      id: p.id,
      name: p.name,
      baseUrl: "",
      builtin: false,
      kind: "plugin" as MangaSourceKind,
      iconUrl: p.icon,
    }));
}

function mangayomiSources(): MangaSource[] {
  return mangayomiSourcesSync()
    .filter((s) => s.enabled)
    .map((s) => ({
      id: s.id,
      name: s.lang && s.lang !== "all" ? `${s.name} (${s.lang})` : s.name,
      baseUrl: s.baseUrl,
      builtin: false,
      kind: "mangayomi" as MangaSourceKind,
      iconUrl: s.iconUrl,
    }));
}

function configuredSources(): MangaSource[] {
  if (sourcesMemo) return sourcesMemo;
  const custom = readCustom();
  const plugins = pluginSources();
  const mangayomi = mangayomiSources();
  const cat = communityCatalog();
  if (cat.length === 0) {
    sourcesMemo = [...readResolved(), ...custom, ...plugins, ...mangayomi];
    return sourcesMemo;
  }
  const community = configuredIds()
    .map((id) => cat.find((c) => c.id === id))
    .filter((c): c is CommunitySource => !!c && providerAvailable(c))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .map(communityToSource);
  writeResolved(community);
  sourcesMemo = [...community, ...custom, ...plugins, ...mangayomi];
  return sourcesMemo;
}

export function hasConfiguredMangaSources(): boolean {
  return configuredIds().length > 0 || readCustom().length > 0;
}

export function listMangaSources(): MangaSource[] {
  const subs = configuredSources();
  const out: MangaSource[] = [];
  if (subs.length >= 2) out.push({ id: "all", name: "All Sources", baseUrl: "", builtin: true });
  out.push(...subs);
  return out;
}

export function hasAnyMangaSource(): boolean {
  return configuredSources().length > 0;
}

export function isSourceConfigured(id: string): boolean {
  return configuredIds().includes(id);
}

export function activeMangaSourceId(): string {
  const list = listMangaSources();
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    if (v && list.some((s) => s.id === v)) return v;
  } catch {
    /* noop */
  }
  return list[0]?.id ?? "";
}

export function activeMangaSource(): MangaSource {
  const list = listMangaSources();
  const id = activeMangaSourceId();
  return (
    list.find((s) => s.id === id) ??
    list[0] ?? { id: "", name: "No source", baseUrl: "", builtin: true }
  );
}

function providerForSource(src: MangaSource): MangaProvider {
  if (src.kind === "suwayomi") return { ...makeSuwayomiProvider(src.baseUrl), id: src.id };
  if (src.kind === "local") return { ...makeLocalProvider(src.baseUrl), id: src.id };
  if (src.kind === "html" && src.config) return makeHtmlProvider(src.id, src.config);
  if (src.kind === "plugin") {
    const installed = installedPluginsSync().find((p) => p.id === src.id);
    return installed ? pluginProvider(installed) : EMPTY_PROVIDER;
  }
  if (src.kind === "mangayomi") {
    const record = mangayomiSourcesSync().find((s) => s.id === src.id);
    return record ? makeMangayomiProvider(record) : EMPTY_PROVIDER;
  }
  return EMPTY_PROVIDER;
}

export function sourceIconUrl(s: MangaSource): string | undefined {
  if (s.iconUrl) return s.iconUrl;
  if (s.id === "all" || !s.baseUrl) return undefined;
  try {
    return `${new URL(s.baseUrl).origin}/favicon.ico`;
  } catch {
    return undefined;
  }
}

export function aggregateSubProviders(): MangaProvider[] {
  return configuredSources()
    .map((s) => providerForSource(s))
    .filter((p) => p.id !== "");
}

const EMPTY_PROVIDER: MangaProvider = {
  id: "",
  name: "",
  popular: async () => [],
  search: async () => [],
  detail: async () => null,
  chapters: async () => [],
  pageUrls: async () => [],
};

export function activeMangaProvider(): MangaProvider {
  if (!hasAnyMangaSource()) return EMPTY_PROVIDER;
  const src = activeMangaSource();
  if (src.id === "all") return aggregateProvider;
  return providerForSource(src);
}

export function setActiveMangaSource(id: string): void {
  const src = listMangaSources().find((s) => s.id === id) ?? activeMangaSource();
  try {
    localStorage.setItem(ACTIVE_KEY, src.id);
  } catch {
    return;
  }
  activeMangaProvider();
  notify();
}

export function addCommunitySource(id: string): void {
  writeConfigured([...configuredIds(), id]);
  try {
    localStorage.setItem(ACTIVE_KEY, listMangaSources().length > 1 ? "all" : id);
  } catch {
    /* noop */
  }
  notify();
}

export function removeCommunitySource(id: string): void {
  writeConfigured(configuredIds().filter((x) => x !== id));
  if (activeMangaSourceId() === id) setActiveMangaSource(listMangaSources()[0]?.id ?? "");
  else notify();
}

export function addMangaSource(
  name: string,
  baseUrl: string,
  kind: MangaSourceKind = "suwayomi",
): MangaSource | null {
  const raw = baseUrl.trim();
  if (kind === "local") {
    if (!raw) return null;
  } else if (!/^https?:\/\/.+/i.test(raw.replace(/\/+$/, ""))) {
    return null;
  }
  let clean: string;
  if (kind === "local") {
    clean = raw.replace(/[\\/]+$/, "");
  } else if (kind === "suwayomi") {
    const normalized = normalizeSuwayomiBase(raw);
    if (!normalized) return null;
    clean = normalized;
  } else {
    clean = raw.replace(/\/+$/, "");
  }
  const idBase = kind === "suwayomi" ? credentialFreeBase(clean) : clean;
  const id = `custom-${kind}-${idBase.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 72);
  const list = readCustom().filter((s) => s.id !== id);
  const fallbackName =
    kind === "local" ? clean.split(/[\\/]/).filter(Boolean).pop() || clean : clean;
  const src: MangaSource = {
    id,
    name: name.trim() || fallbackName,
    baseUrl: clean,
    builtin: false,
    kind,
  };
  if (!writeCustom([...list, src])) return null;
  notify();
  return src;
}

export function addHtmlSource(config: HtmlSourceConfig): MangaSource | null {
  const clean = config.baseUrl.replace(/\/+$/, "");
  if (!/^https?:\/\/.+/i.test(clean)) return null;
  const id = `custom-html-${clean.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 72);
  const src: MangaSource = {
    id,
    name: config.name.trim() || clean,
    baseUrl: clean,
    builtin: false,
    kind: "html",
    iconUrl: config.iconUrl,
    config: { ...config, baseUrl: clean },
  };
  if (!writeCustom([...readCustom().filter((s) => s.id !== id), src])) return null;
  notify();
  return src;
}

export function removeMangaSource(id: string): void {
  const src = configuredSources().find((s) => s.id === id);
  if (src?.kind === "mangayomi") {
    const fallback = listMangaSources().find((s) => s.id !== id && s.id !== "all")?.id ?? "";
    void removeMangayomiRecord(id);
    if (activeMangaSourceId() === id) setActiveMangaSource(fallback);
    return;
  }
  writeCustom(readCustom().filter((s) => s.id !== id));
  if (activeMangaSourceId() === id) setActiveMangaSource(listMangaSources()[0]?.id ?? "");
  else notify();
}

const BOOT_TIMEOUT = 8_000;
const BOOT_BACKOFF = [0, 700, 1_600, 3_400];

let bootPromise: Promise<void> | null = null;
let bootFailed = false;

export function mangaSourcesReady(): boolean {
  return true;
}

export function mangaSourcesState(): MangaSourcesState {
  if (mangaSourcesReady()) return "ready";
  return bootFailed ? "error" : "loading";
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms));
}

async function fetchCatalogOnce(): Promise<boolean> {
  const bail = new Promise<CommunitySource[]>((r) => window.setTimeout(() => r([]), BOOT_TIMEOUT));
  try {
    const list = await Promise.race([refreshCommunityCatalog(), bail]);
    return list.length > 0;
  } catch {
    return false;
  }
}

async function bootstrap(): Promise<void> {
  for (let i = 0; i < BOOT_BACKOFF.length; i++) {
    if (BOOT_BACKOFF[i] > 0) await sleep(BOOT_BACKOFF[i]);
    if (await fetchCatalogOnce()) {
      bootFailed = false;
      notify();
      return;
    }
  }
  bootFailed = true;
  notify();
}

export function ensureMangaSources(): Promise<void> {
  if (mangaSourcesReady()) return Promise.resolve();
  if (!bootPromise) bootPromise = bootstrap();
  return bootPromise;
}

export function retryMangaSources(): Promise<void> {
  bootPromise = null;
  bootFailed = false;
  notify();
  return ensureMangaSources();
}

function parseStoredSources(key: string): Array<Record<string, unknown>> {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function migrateCommunitySources(): void {
  try {
    if (localStorage.getItem(MIGRATED_KEY)) return;
  } catch {
    return;
  }
  const configured = configuredIds();
  const resolved = parseStoredSources(RESOLVED_KEY);
  if (configured.length === 0 && resolved.length === 0) {
    try {
      localStorage.setItem(MIGRATED_KEY, "1");
    } catch {
      /* noop */
    }
    return;
  }
  const data = new Map<string, Record<string, unknown>>();
  for (const c of communityCatalog()) data.set(c.id, c as unknown as Record<string, unknown>);
  for (const r of resolved) {
    const id = typeof r.id === "string" ? r.id : "";
    if (id && !data.has(id)) data.set(id, r);
  }
  const custom = readCustom();
  const seen = new Set(custom.map((s) => s.id));
  const ids = new Set<string>([
    ...configured,
    ...resolved.map((r) => (typeof r.id === "string" ? r.id : "")).filter(Boolean),
  ]);
  const additions: MangaSource[] = [];
  const pending = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    const d = data.get(id);
    if (!d) {
      pending.add(id);
      continue;
    }
    if (d.kind === "builtin" || d.builtin === true) continue;
    const url = String(d.baseUrl ?? "")
      .trim()
      .replace(/\/+$/, "");
    if (!/^https?:\/\/.+/i.test(url)) continue;
    seen.add(id);
    additions.push({
      id,
      name: String(d.name ?? url),
      baseUrl: url,
      builtin: false,
      kind: "suwayomi",
      iconUrl: typeof d.iconUrl === "string" ? d.iconUrl : undefined,
    });
  }
  if (additions.length > 0 && !writeCustom([...custom, ...additions])) return;
  writeConfigured(configured.filter((id) => pending.has(id)));
  if (pending.size === 0) {
    try {
      localStorage.removeItem(RESOLVED_KEY);
    } catch {
      /* noop */
    }
    resolvedJson = "";
    try {
      localStorage.setItem(MIGRATED_KEY, "1");
    } catch {
      /* noop */
    }
  }
  notify();
}

export function initMangaSource(): void {
  migrateCommunitySources();
  reconcileSuwayomiServers();
  void ensureMangaSources();
  void loadInstalledPlugins().then(() => warmPlugins());
  void loadMangayomiSources();
  void loadRepos();
  activeMangaProvider();
}
