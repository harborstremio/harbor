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
  opts?: { addonTransportUrls?: string[] | null },
): void {
  if (!fromProfileId || !toProfileId || fromProfileId === toProfileId) return;
  try {
    for (const domain of domains) {
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
        const installedRaw = localStorage.getItem(INSTALLED_PREFIX + fromProfileId);
        if (installedRaw == null) continue;
        const subset = opts?.addonTransportUrls ? new Set(opts.addonTransportUrls) : null;
        if (!subset) {
          localStorage.setItem(INSTALLED_PREFIX + toProfileId, installedRaw);
          const disabledRaw = localStorage.getItem(DISABLED_PREFIX + fromProfileId);
          if (disabledRaw != null) localStorage.setItem(DISABLED_PREFIX + toProfileId, disabledRaw);
          continue;
        }
        // Subset import: keep only user-selected addons. The disabled list is
        // filtered through an id->transportUrl map so entries survive either shape.
        const installed = readJson<StoredAddon[]>(INSTALLED_PREFIX + fromProfileId) ?? [];
        const list = Array.isArray(installed) ? installed : [];
        const idToUrl = new Map<string, string>();
        for (const a of list) {
          if (a && typeof a.id === "string" && typeof a.transportUrl === "string") {
            idToUrl.set(a.id, a.transportUrl);
          }
        }
        const kept = list.filter(
          (a) => a && typeof a.transportUrl === "string" && subset.has(a.transportUrl),
        );
        localStorage.setItem(INSTALLED_PREFIX + toProfileId, JSON.stringify(kept));
        const disabledParsed = readJson<unknown>(DISABLED_PREFIX + fromProfileId);
        if (Array.isArray(disabledParsed)) {
          const keptDisabled = disabledParsed.filter((entry) => {
            if (typeof entry === "string") {
              const url = idToUrl.get(entry);
              return (url != null && subset.has(url)) || subset.has(entry);
            }
            if (entry && typeof entry === "object") {
              const o = entry as { id?: unknown; transportUrl?: unknown };
              if (typeof o.transportUrl === "string") return subset.has(o.transportUrl);
              if (typeof o.id === "string") {
                const url = idToUrl.get(o.id);
                return url != null && subset.has(url);
              }
            }
            return false;
          });
          localStorage.setItem(DISABLED_PREFIX + toProfileId, JSON.stringify(keptDisabled));
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
