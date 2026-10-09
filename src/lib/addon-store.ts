import { safeFetch as fetch, safeFetchLocal } from "@/lib/safe-fetch";
import { isLocalNetworkUrl } from "@/lib/local-network";
import type { Addon } from "./addons";
import {
  applyOrderToItems,
  loadDisplayOrder,
  replaceUrlsInOrder,
  saveDisplayOrder,
} from "./addons-store/reorder";

const PROFILES_KEY = "harbor.profiles.v1";

const STORAGE_KEY_PREFIX = "harbor.installed-addons.";
const LEGACY_STORAGE_KEY = "harbor.installed-addons";
const SEEDED_KEY = "harbor.addons.seeded.v1";
const DISABLED_KEY_PREFIX = "harbor.addons.disabled.";
const LEGACY_DISABLED_KEY = "harbor.addons.disabled";

const DEFAULT_ADDONS: Array<{ id: string; transportUrl: string }> = [];

function activeProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return "";
    const s = JSON.parse(raw) as {
      activeId?: string;
      profiles?: Array<{ id?: string; isPrimary?: boolean; shareStremioWith?: string | null }>;
    };
    const profiles = Array.isArray(s.profiles) ? s.profiles : [];
    const active = profiles.find((p) => p.id === s.activeId) ?? null;
    const own = active?.id ?? profiles.find((p) => p?.isPrimary)?.id ?? "";
    if (!own) return "";
    if (active && typeof active.shareStremioWith === "string" && active.shareStremioWith) {
      const shared = profiles.find((p) => p.id === active.shareStremioWith);
      if (shared?.id) return shared.id;
    }
    return own;
  } catch {
    return "";
  }
}

function primaryProfileId(): string {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    const s = raw
      ? (JSON.parse(raw) as { profiles?: Array<{ id?: string; isPrimary?: boolean }> })
      : null;
    const primary = s?.profiles?.find((p) => p?.isPrimary);
    return (primary && typeof primary.id === "string" && primary.id) || activeProfileId();
  } catch {
    return activeProfileId();
  }
}

function storeKey(kind: "installed" | "disabled"): string {
  const id = activeProfileId();
  if (kind === "installed") return id ? STORAGE_KEY_PREFIX + id : LEGACY_STORAGE_KEY;
  return id ? DISABLED_KEY_PREFIX + id : LEGACY_DISABLED_KEY;
}

function migrateLegacy(): void {
  try {
    const pid = primaryProfileId();
    if (!pid) return;
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const perKey = STORAGE_KEY_PREFIX + pid;
      if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacy);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    }
    const legacyDisabled = localStorage.getItem(LEGACY_DISABLED_KEY);
    if (legacyDisabled) {
      const perKey = DISABLED_KEY_PREFIX + pid;
      if (!localStorage.getItem(perKey)) localStorage.setItem(perKey, legacyDisabled);
      localStorage.removeItem(LEGACY_DISABLED_KEY);
    }
  } catch {
    /* noop */
  }
}

export async function seedDefaultAddonsIfFirstRun(): Promise<void> {
  try {
    if (localStorage.getItem(SEEDED_KEY) === "1") return;
    if (loadInstalled().length > 0) {
      localStorage.setItem(SEEDED_KEY, "1");
      return;
    }
    for (const def of DEFAULT_ADDONS) {
      try {
        const manifest = await fetchManifestAt(def.transportUrl);
        const next = loadInstalled().filter((a) => a.transportUrl !== def.transportUrl);
        next.push({
          id: manifest.id || def.id,
          transportUrl: def.transportUrl,
          installedAt: Date.now(),
          manifest,
        });
        saveInstalled(next);
      } catch (e) {
        console.warn(`[addons] failed to seed ${def.id}`, e);
      }
    }
    localStorage.setItem(SEEDED_KEY, "1");
  } catch (e) {
    console.warn("[addons] seed default failed", e);
  }
}

export type InstalledAddon = {
  id: string;
  transportUrl: string;
  installedAt: number;
  manifest?: Addon["manifest"];
};

const SLIM_MANIFEST_KEYS = [
  "id",
  "name",
  "version",
  "description",
  "logo",
  "background",
  "types",
  "idPrefixes",
  "resources",
  "catalogs",
  "behaviorHints",
] as const;

function slimManifest(manifest: Addon["manifest"] | undefined): Addon["manifest"] | undefined {
  if (!manifest) return undefined;
  const src = manifest as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of SLIM_MANIFEST_KEYS) {
    const v = src[k];
    if (v === undefined) continue;
    if (k === "description" && typeof v === "string") {
      out[k] = v.slice(0, 400);
      continue;
    }
    if (k === "logo" && typeof v === "string" && v.startsWith("data:")) {
      continue;
    }
    if (k === "background" && typeof v === "string" && v.startsWith("data:")) {
      continue;
    }
    if (k === "catalogs" && Array.isArray(v)) {
      out[k] = (v as Array<Record<string, unknown>>).map((c) => ({
        id: c.id,
        type: c.type,
        name: c.name,
        extraSupported: Array.isArray(c.extraSupported)
          ? c.extraSupported.filter((name): name is string => typeof name === "string")
          : undefined,
        extra: Array.isArray(c.extra)
          ? (c.extra as Array<Record<string, unknown>>).map((e) => ({
              name: e.name,
              isRequired: e.isRequired,
              options: Array.isArray(e.options)
                ? e.options.filter((option): option is string => typeof option === "string")
                : undefined,
            }))
          : undefined,
      }));
      continue;
    }
    out[k] = v;
  }
  return out as Addon["manifest"];
}

export function loadInstalled(): InstalledAddon[] {
  migrateLegacy();
  const raw = localStorage.getItem(storeKey("installed"));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as InstalledAddon[];
  } catch {
    return [];
  }
}

export function saveInstalled(list: InstalledAddon[]) {
  const slim = list.map((a) => ({ ...a, manifest: slimManifest(a.manifest) }));
  try {
    localStorage.setItem(storeKey("installed"), JSON.stringify(slim));
  } catch (e) {
    if (e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22)) {
      const stripped = list.map((a) => ({
        id: a.id,
        transportUrl: a.transportUrl,
        installedAt: a.installedAt,
      }));
      localStorage.setItem(storeKey("installed"), JSON.stringify(stripped));
    } else {
      throw e;
    }
  }
}

export function reorderInstalled(urlSequence: string[]): void {
  const items = loadInstalled();
  if (items.length < 2) return;
  saveInstalled(applyOrderToItems(items, urlSequence));
}

function preserveOrderOnReplace(oldUrls: string[], newUrl: string): void {
  let order = loadDisplayOrder();
  if (order.length === 0) {
    order = loadInstalled().map((a) => a.transportUrl);
  }
  if (order.length === 0) return;
  saveDisplayOrder(replaceUrlsInOrder(order, oldUrls, newUrl));
}

export function loadDisabledAddons(): Set<string> {
  migrateLegacy();
  try {
    const raw = localStorage.getItem(storeKey("disabled"));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((u): u is string => typeof u === "string"));
  } catch {
    return new Set();
  }
}

function saveDisabledAddons(set: Set<string>): void {
  try {
    localStorage.setItem(storeKey("disabled"), JSON.stringify([...set]));
  } catch (e) {
    console.warn("[addons] couldn't persist disabled addons", e);
  }
}

export function isAddonEnabled(transportUrl: string): boolean {
  return !loadDisabledAddons().has(transportUrl);
}

export function setAddonEnabled(transportUrl: string, enabled: boolean): void {
  const set = loadDisabledAddons();
  if (enabled) set.delete(transportUrl);
  else set.add(transportUrl);
  saveDisabledAddons(set);
}

export function filterEnabled<T extends { transportUrl: string }>(items: T[]): T[] {
  const disabled = loadDisabledAddons();
  if (disabled.size === 0) return items;
  return items.filter((a) => !disabled.has(a.transportUrl));
}

export function isInstalled(id: string): boolean {
  return loadInstalled().some((a) => a.id === id);
}

export function transportUrlFor(id: string): string | null {
  return loadInstalled().find((a) => a.id === id)?.transportUrl ?? null;
}

// Identifies an addon instance by host + base path, ignoring manifest.json /
// configure suffixes and query strings, so distinct manifests on the same host
// (e.g. /p/1/manifest.json vs /p/2/manifest.json) stay separate addons.
function transportBaseKey(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname
      .replace(/\/manifest\.json$/i, "")
      .replace(/\/configure$/i, "")
      .replace(/\/+$/, "");
    return `${u.host.toLowerCase()}${path}`;
  } catch {
    return null;
  }
}

export function findHostnameMatch(transportUrl: string): InstalledAddon | null {
  const base = transportBaseKey(transportUrl);
  if (!base) return null;
  return loadInstalled().find((a) => transportBaseKey(a.transportUrl) === base) ?? null;
}

export type AddonUrlParse = { kind: "ok"; url: string } | { kind: "error"; message: string };

export function parseAddonUrl(input: string): AddonUrlParse {
  let raw = input.trim();
  if (!raw) return { kind: "error", message: "Paste a manifest URL or stremio:// link." };
  if (raw.startsWith("stremio://")) raw = "https://" + raw.slice("stremio://".length);
  raw = raw.replace(/\/#\/configure\/?$/, "");
  raw = raw.replace(/\/configure\/?$/, "");
  raw = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(raw)) {
    return { kind: "error", message: "URL must start with https:// or stremio://" };
  }
  try {
    const url = new URL(raw);
    if (!/\/manifest\.json$/i.test(url.pathname)) {
      url.pathname = url.pathname.replace(/\/(?:configure)?\/?$/i, "") + "/manifest.json";
    }
    return { kind: "ok", url: url.href };
  } catch {
    return { kind: "error", message: "That doesn't look like a valid URL." };
  }
}

function validateManifest(
  m: unknown,
): { ok: true; manifest: Addon["manifest"] } | { ok: false; error: string } {
  if (!m || typeof m !== "object") return { ok: false, error: "Manifest is not a JSON object." };
  const obj = m as Record<string, unknown>;
  if (typeof obj.id !== "string" || obj.id.length === 0)
    return { ok: false, error: "Manifest is missing an `id`." };
  if (typeof obj.name !== "string" || obj.name.length === 0)
    return { ok: false, error: "Manifest is missing a `name`." };
  return { ok: true, manifest: obj as Addon["manifest"] };
}

export async function fetchManifestAt(transportUrl: string): Promise<Addon["manifest"]> {
  // A self-hosted addon lives on loopback/LAN, which the guarded bridge fetch
  // rejects outright ("blocked internal target"). The URL came from the user, so
  // it may reach the local network — public URLs keep the DNS-rebinding guard.
  const doFetch = isLocalNetworkUrl(transportUrl) ? safeFetchLocal : fetch;
  const res = await doFetch(transportUrl, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Manifest fetch failed (HTTP ${res.status}). Check the URL.`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error("Response wasn't valid JSON. The URL may not be a Stremio manifest.");
  }
  const v = validateManifest(json);
  if (!v.ok) throw new Error(v.error);
  return v.manifest;
}

export type InstallResult = {
  addon: Addon;
  savedLocally: true;
  replaced: boolean;
};

export async function installAddon(id: string, transportUrl: string): Promise<Addon> {
  const owner = storeKey("installed");
  const manifest = await fetchManifestAt(transportUrl);
  if (owner !== storeKey("installed"))
    throw new Error("Profile changed during addon installation. Retry in the intended profile.");
  const canonicalId = manifest.id || id;
  const before = loadInstalled();
  // Exact URLs identify installations. Distinct configurations with the same ID coexist.
  const next = before.filter((a) => a.transportUrl !== transportUrl);
  const replaced = before.filter((a) => a.transportUrl === transportUrl);
  const replacedUrls = replaced.map((a) => a.transportUrl);
  if (replaced.length > 0) {
    preserveOrderOnReplace(replacedUrls, transportUrl);
  }
  next.push({ id: canonicalId, transportUrl, installedAt: Date.now(), manifest });
  saveInstalled(next);
  const addon: Addon = { manifest, transportUrl };
  return addon;
}

export async function installFromUrl(
  rawUrl: string,
  options: { replaceId?: string; replaceUrl?: string } = {},
): Promise<InstallResult> {
  const parsed = parseAddonUrl(rawUrl);
  if (parsed.kind === "error") throw new Error(parsed.message);
  const owner = storeKey("installed");
  const manifest = await fetchManifestAt(parsed.url);
  if (owner !== storeKey("installed"))
    throw new Error("Profile changed during addon installation. Retry in the intended profile.");
  const id = manifest.id;
  const before = loadInstalled();
  const byId = options.replaceId ? before.filter((a) => a.id === options.replaceId) : [];
  if (!options.replaceUrl && byId.length > 1)
    throw new Error(
      "Choose the addon configuration to replace. Other configurations will be kept.",
    );
  const replaceUrl = options.replaceUrl ?? byId[0]?.transportUrl;
  const replaced = before.filter(
    (a) => a.transportUrl === parsed.url || a.transportUrl === replaceUrl,
  );
  const next = before.filter((a) => !replaced.includes(a));
  const replacedUrls = replaced.map((a) => a.transportUrl);
  if (replaced.length > 0) {
    preserveOrderOnReplace(replacedUrls, parsed.url);
  }
  next.push({ id, transportUrl: parsed.url, installedAt: Date.now(), manifest });
  saveInstalled(next);
  const addon: Addon = { manifest, transportUrl: parsed.url };
  return { addon, savedLocally: true, replaced: replaced.length > 0 };
}

export async function uninstallAddon(id: string, transportUrl?: string): Promise<void> {
  const removed = transportUrl
    ? loadInstalled().filter((a) => a.transportUrl === transportUrl)
    : loadInstalled().filter((a) => a.id === id);
  const next = transportUrl
    ? loadInstalled().filter((a) => a.transportUrl !== transportUrl)
    : loadInstalled().filter((a) => a.id !== id);
  saveInstalled(next);
  if (removed.length > 0) {
    const disabled = loadDisabledAddons();
    let touched = false;
    for (const a of removed) if (disabled.delete(a.transportUrl)) touched = true;
    if (touched) saveDisabledAddons(disabled);
  }
}

export async function fetchInstalledAddons(): Promise<Addon[]> {
  const owner = storeKey("installed");
  const list = loadInstalled();
  if (list.length === 0) return [];
  const tasks = list.map(async (entry): Promise<Addon | null> => {
    if (entry.manifest) {
      return { manifest: entry.manifest, transportUrl: entry.transportUrl };
    }
    try {
      const manifest = await fetchManifestAt(entry.transportUrl);
      if (owner !== storeKey("installed")) return null;
      const updated = loadInstalled().map((e) =>
        e.transportUrl === entry.transportUrl ? { ...e, manifest } : e,
      );
      saveInstalled(updated);
      return { manifest, transportUrl: entry.transportUrl };
    } catch {
      return null;
    }
  });
  const results = await Promise.all(tasks);
  return results.filter((a): a is Addon => a !== null);
}

export function manifestToConfigureUrl(transportUrl: string): string {
  return transportUrl.replace(/manifest\.json(\?.*)?$/i, "configure");
}

export function manifestToShareUrl(
  transportUrl: string,
  scheme: "https" | "stremio" = "https",
): string {
  if (scheme === "stremio") {
    return transportUrl.replace(/^https?:\/\//i, "stremio://");
  }
  return transportUrl;
}

export function cometConfigFor(debridService: string, apiKey: string): string {
  const settings = {
    maxResultsPerResolution: 0,
    maxSize: 0,
    cachedOnly: false,
    sortCachedUncachedTogether: false,
    removeTrash: true,
    resultFormat: ["all"],
    debridServices: [{ service: debridService, apiKey: apiKey.trim() }],
    enableTorrent: true,
    deduplicateStreams: true,
    scrapeDebridAccountTorrents: false,
    debridStreamProxyPassword: "",
    languages: { required: [], allowed: [], exclude: [], preferred: [] },
    resolutions: {},
    options: {
      remove_ranks_under: -10000000000,
      allow_english_in_languages: false,
      remove_unknown_languages: false,
    },
  };
  return btoa(JSON.stringify(settings));
}

export function cometUrlFor(debridService: string, apiKey: string): string {
  const b64 = cometConfigFor(debridService, apiKey);
  return `https://comet.elfhosted.com/${b64}/manifest.json`;
}

export const COMET_ID = "comet.elfhosted.com";

export function cometKeyFromUrl(transportUrl: string): { service: string; apiKey: string } | null {
  const m = transportUrl.match(/comet\.elfhosted\.com\/([^/]+)\/manifest\.json/);
  if (!m) return null;
  try {
    const json = JSON.parse(atob(m[1]));
    const svc = json?.debridServices?.[0];
    if (!svc?.service || !svc?.apiKey) return null;
    return { service: svc.service, apiKey: svc.apiKey };
  } catch {
    return null;
  }
}
