import { MIRROR_KEY, SHARED_KEY, profileKey, sourceKeyFor } from "@/lib/settings/profile-store";

const PROFILES_KEY = "harbor.profiles.v1";

// Addons pre-selected when seeding a fresh separate profile. Matched against the
// stored transportUrl first; the name check is a fallback for forks of these
// manifests that live at a different URL.
export const DEFAULT_IMPORT_ADDON_URLS: readonly string[] = [
  "https://v3-cinemeta.strem.io/manifest.json",
];

export type ImportDomain =
  | "settings"
  | "addons"
  | "watchlist"
  | "favorites"
  | "watched"
  | "continueWatching";

// Per-profile storage prefixes grouped by domain. Settings are handled
// separately because their source key depends on whether the source profile is
// linked to shared settings. Keep prefixes in sync with the owning modules.
const DOMAIN_PREFIXES: Record<Exclude<ImportDomain, "settings" | "addons">, readonly string[]> = {
  watchlist: ["harbor.watchlist.v1.", "harbor.watchlist.aggregate.v1."],
  favorites: ["harbor.favorites.v1.", "harbor.mangafav.v1.", "harbor.charfavorites.v1."],
  watched: [
    "harbor.watchedFlag.v1.",
    "harbor.moviewatched.v1.",
    "harbor.watchevents.v1.",
    "harbor.stremio.freshwatched.v1.",
    "harbor.manualwatched.v1.",
    "harbor.manualunwatched.v1.",
    "harbor.manualwatched.meta.v1.",
    "harbor.manualwatched.dismissed.v1.",
    "harbor.manualunwatched.at.v1.",
    "harbor.manualwatched.fromremote.v1.",
  ],
  continueWatching: ["harbor.localcw.v1.", "harbor.playback-history.v1."],
};

const INSTALLED_PREFIX = "harbor.installed-addons.";
const DISABLED_PREFIX = "harbor.addons.disabled.";

type StoredAddon = {
  id?: string;
  transportUrl?: string;
  manifest?: { name?: string };
};

export type ImportDomainChoice = "merge" | "replace";

// Only id/url-keyed array domains can be merged; the rest (settings blob, watched
// flags, continue-watching positions) stay replace-only.
const MERGEABLE_DOMAINS = new Set<ImportDomain>(["watchlist", "favorites", "addons"]);

type KeyOf = (o: Record<string, unknown>) => string | null;

const byId: KeyOf = (o) => (typeof o.id === "string" && o.id) || null;
const byUrl: KeyOf = (o) => (typeof o.transportUrl === "string" && o.transportUrl) || null;

const DOMAIN_KEY_OF: Partial<Record<ImportDomain, KeyOf>> = {
  watchlist: byId,
  favorites: byId,
  addons: byUrl,
};

type KeyedEntry = { key: string; raw: unknown };

function readKeyedArray(key: string, keyOf: KeyOf): KeyedEntry[] {
  const arr = readJson<unknown[]>(key);
  if (!Array.isArray(arr)) return [];
  const out: KeyedEntry[] = [];
  for (const el of arr) {
    if (typeof el === "string") {
      out.push({ key: el, raw: el });
    } else if (el && typeof el === "object") {
      const k = keyOf(el as Record<string, unknown>);
      if (k) out.push({ key: k, raw: el });
    }
  }
  return out;
}

// Union source into existing target by identity key. Existing target entries win so a
// merge never loses or clobbers data that is already on the target profile.
function unionKeyedArray(srcKey: string, dstKey: string, keyOf: KeyOf): void {
  const map = new Map<string, unknown>();
  for (const e of readKeyedArray(dstKey, keyOf)) if (!map.has(e.key)) map.set(e.key, e.raw);
  for (const e of readKeyedArray(srcKey, keyOf)) if (!map.has(e.key)) map.set(e.key, e.raw);
  localStorage.setItem(dstKey, JSON.stringify(Array.from(map.values())));
}

export type DomainOverlap = {
  sourceCount: number;
  targetCount: number;
  overlapCount: number;
};

export function analyzeOverlaps(
  fromProfileId: string,
  toProfileId: string,
  domains: ImportDomain[],
  addonUrls?: string[] | null,
): Partial<Record<ImportDomain, DomainOverlap>> {
  const result: Partial<Record<ImportDomain, DomainOverlap>> = {};
  const srcKeys = new Map<ImportDomain, Set<string>>();
  const dstKeys = new Map<ImportDomain, Set<string>>();
  // Mirror applyAddons: a present (even empty) selection is a real subset; only
  // null means "no subset / every source addon". An empty selection filters out
  // all source addons, so it must report no addon overlap.
  const addonSubset = addonUrls != null ? new Set(addonUrls) : null;
  for (const domain of domains) {
    if (!MERGEABLE_DOMAINS.has(domain)) continue;
    const keyOf = DOMAIN_KEY_OF[domain];
    if (!keyOf) continue;
    const s = new Set<string>();
    const d = new Set<string>();
    if (domain === "addons") {
      for (const e of readKeyedArray(INSTALLED_PREFIX + fromProfileId, keyOf)) {
        if (addonSubset && !addonSubset.has(e.key)) continue;
        s.add(e.key);
      }
      for (const e of readKeyedArray(INSTALLED_PREFIX + toProfileId, keyOf)) d.add(e.key);
    } else if (domain !== "settings") {
      const prefixes = DOMAIN_PREFIXES[domain];
      for (const prefix of prefixes) {
        for (const e of readKeyedArray(prefix + fromProfileId, keyOf)) s.add(e.key);
        for (const e of readKeyedArray(prefix + toProfileId, keyOf)) d.add(e.key);
      }
    }
    srcKeys.set(domain, s);
    dstKeys.set(domain, d);
  }
  for (const domain of domains) {
    const s = srcKeys.get(domain);
    const d = dstKeys.get(domain);
    if (!s || !d) continue;
    let overlap = 0;
    for (const k of s) if (d.has(k)) overlap++;
    result[domain] = { sourceCount: s.size, targetCount: d.size, overlapCount: overlap };
  }
  return result;
}

type MinimalProfilesState = {
  profiles?: Array<{ id?: string; isPrimary?: boolean; settingsLinked?: boolean }>;
  activeId?: string | null;
};

function readProfilesState(): MinimalProfilesState | null {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MinimalProfilesState;
  } catch {
    return null;
  }
}

function profileSettingsLinked(profileId: string): boolean {
  const state = readProfilesState();
  const profile = state?.profiles?.find((p) => p?.id === profileId);
  return profile ? profile.settingsLinked !== false : true;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type ImportAddonPreview = { name: string; transportUrl: string };

export type ImportSourceSummary = {
  addons: ImportAddonPreview[];
  watchlistCount: number;
  favoriteCount: number;
};

export function summarizeSource(profileId: string): ImportSourceSummary {
  const installed = readJson<StoredAddon[]>(INSTALLED_PREFIX + profileId);
  const addons = Array.isArray(installed)
    ? installed.flatMap((a) =>
        a && typeof a.transportUrl === "string"
          ? [
              {
                name:
                  typeof a.manifest?.name === "string" && a.manifest.name
                    ? a.manifest.name
                    : typeof a.id === "string" && a.id
                      ? a.id
                      : "Addon",
                transportUrl: a.transportUrl,
              },
            ]
          : [],
      )
    : [];
  let watchlistCount = 0;
  const watchlist = readJson<unknown>("harbor.watchlist.v1." + profileId);
  if (Array.isArray(watchlist)) {
    watchlistCount = watchlist.length;
  } else if (watchlist && typeof watchlist === "object") {
    const items = (watchlist as { items?: unknown }).items;
    if (Array.isArray(items)) watchlistCount = items.length;
  }
  let favoriteCount = 0;
  for (const prefix of DOMAIN_PREFIXES.favorites) {
    const list = readJson<unknown>(prefix + profileId);
    if (Array.isArray(list)) favoriteCount += list.length;
  }
  return { addons, watchlistCount, favoriteCount };
}

// Which imported addons start checked when none were chosen yet.
export function defaultSelectedAddonUrls(addons: ImportAddonPreview[]): Set<string> {
  const selected = new Set<string>();
  for (const addon of addons) {
    const url = addon.transportUrl.toLowerCase();
    const name = addon.name.toLowerCase();
    const matches =
      DEFAULT_IMPORT_ADDON_URLS.includes(addon.transportUrl) ||
      url.includes("v3-cinemeta.strem.io") ||
      name.includes("cinemeta");
    if (matches) selected.add(addon.transportUrl);
  }
  return selected;
}

export function importDomains(
  fromProfileId: string,
  toProfileId: string,
  domains: ImportDomain[],
  opts?: {
    addonTransportUrls?: string[] | null;
    choices?: Partial<Record<ImportDomain, ImportDomainChoice>>;
  },
): void {
  if (!fromProfileId || !toProfileId || fromProfileId === toProfileId) return;
  const choices = opts?.choices ?? {};
  const currentOverlaps = analyzeOverlaps(
    fromProfileId,
    toProfileId,
    domains,
    opts?.addonTransportUrls ?? null,
  );
  const choiceFor = (domain: ImportDomain): ImportDomainChoice => {
    const requested = choices[domain] ?? (MERGEABLE_DOMAINS.has(domain) ? "merge" : "replace");
    if (
      requested === "replace" &&
      MERGEABLE_DOMAINS.has(domain) &&
      (currentOverlaps[domain]?.overlapCount ?? 0) === 0
    ) {
      return "merge";
    }
    return requested;
  };
  try {
    for (const domain of domains) {
      const choice = choiceFor(domain);
      if (domain === "settings") {
        // Copy the source's effective blob into the target's own blob. The
        // caller unlinks settings on the target so this copy is what loads.
        const src = sourceKeyFor(fromProfileId, profileSettingsLinked(fromProfileId));
        const blob =
          localStorage.getItem(src) ??
          localStorage.getItem(SHARED_KEY) ??
          localStorage.getItem(MIRROR_KEY);
        if (blob != null) localStorage.setItem(profileKey(toProfileId), blob);
        continue;
      }

      if (domain === "addons") {
        applyAddons(fromProfileId, toProfileId, choice, opts?.addonTransportUrls ?? null);
        continue;
      }

      if (MERGEABLE_DOMAINS.has(domain)) {
        const keyOf = DOMAIN_KEY_OF[domain];
        if (!keyOf) continue;
        for (const prefix of DOMAIN_PREFIXES[domain]) {
          if (choice === "replace") {
            const raw = localStorage.getItem(prefix + fromProfileId);
            if (raw != null) localStorage.setItem(prefix + toProfileId, raw);
          } else {
            unionKeyedArray(prefix + fromProfileId, prefix + toProfileId, keyOf);
          }
        }
        continue;
      }

      for (const prefix of DOMAIN_PREFIXES[domain]) {
        const raw = localStorage.getItem(prefix + fromProfileId);
        if (raw != null) localStorage.setItem(prefix + toProfileId, raw);
      }
    }
  } catch (e) {
    console.warn("[profile-import] failed", e);
  }
}

function applyAddons(
  fromProfileId: string,
  toProfileId: string,
  choice: ImportDomainChoice,
  selectedUrls: string[] | null,
): void {
  const subset = selectedUrls ? new Set(selectedUrls) : null;
  const sourceEntries = readKeyedArray(INSTALLED_PREFIX + fromProfileId, byUrl);
  const picked = subset ? sourceEntries.filter((e) => subset.has(e.key)) : sourceEntries;

  if (choice === "replace") {
    const keptRaw = picked.map((e) => e.raw);
    localStorage.setItem(INSTALLED_PREFIX + toProfileId, JSON.stringify(keptRaw));
    const idToUrl = new Map<string, string>();
    for (const e of sourceEntries) {
      const o = e.raw as { id?: unknown };
      if (typeof o.id === "string") idToUrl.set(o.id, e.key);
    }
    replaceDisabled(fromProfileId, toProfileId, picked, idToUrl);
    return;
  }

  const targetEntries = readKeyedArray(INSTALLED_PREFIX + toProfileId, byUrl);
  const map = new Map<string, unknown>();
  for (const e of targetEntries) if (!map.has(e.key)) map.set(e.key, e.raw);
  for (const e of picked) if (!map.has(e.key)) map.set(e.key, e.raw);
  localStorage.setItem(INSTALLED_PREFIX + toProfileId, JSON.stringify(Array.from(map.values())));
  const targetIdToUrl = new Map<string, string>();
  for (const e of targetEntries) {
    const o = e.raw as { id?: unknown };
    if (typeof o.id === "string") targetIdToUrl.set(o.id, e.key);
  }
  const srcIdToUrl = new Map<string, string>();
  for (const e of sourceEntries) {
    const o = e.raw as { id?: unknown };
    if (typeof o.id === "string") srcIdToUrl.set(o.id, e.key);
  }
  const srcDisabled = readJson<unknown>(DISABLED_PREFIX + fromProfileId);
  if (Array.isArray(srcDisabled)) {
    const disabledMap = new Map<string, unknown>();
    const existingDisabled = readJson<unknown>(DISABLED_PREFIX + toProfileId);
    if (Array.isArray(existingDisabled)) {
      for (const entry of existingDisabled) {
        const key = disabledKey(entry, targetIdToUrl);
        if (key && !disabledMap.has(key)) disabledMap.set(key, entry);
      }
    }
    for (const entry of srcDisabled) {
      const key = disabledKey(entry, srcIdToUrl);
      if (!key) continue;
      if (subset && !subset.has(key)) continue;
      if (!disabledMap.has(key)) disabledMap.set(key, entry);
    }
    localStorage.setItem(
      DISABLED_PREFIX + toProfileId,
      JSON.stringify(Array.from(disabledMap.values())),
    );
  }
}

function disabledKey(entry: unknown, idToUrl: Map<string, string>): string | null {
  if (typeof entry === "string") return idToUrl.get(entry) ?? entry;
  if (entry && typeof entry === "object") {
    const o = entry as { id?: unknown; transportUrl?: unknown };
    if (typeof o.transportUrl === "string") return o.transportUrl;
    if (typeof o.id === "string") return idToUrl.get(o.id) ?? o.id;
  }
  return null;
}

function replaceDisabled(
  fromProfileId: string,
  toProfileId: string,
  picked: KeyedEntry[],
  idToUrl: Map<string, string>,
): void {
  const srcDisabled = readJson<unknown>(DISABLED_PREFIX + fromProfileId);
  if (!Array.isArray(srcDisabled)) return;
  const keptDisabled = srcDisabled.filter((entry) => {
    const key = disabledKey(entry, idToUrl);
    return key != null && picked.some((e) => e.key === key);
  });
  localStorage.setItem(DISABLED_PREFIX + toProfileId, JSON.stringify(keptDisabled));
}
