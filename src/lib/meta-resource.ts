import { cinemetaEnabled, meta as cinemetaMeta, type Meta } from "./cinemeta";
import { safeFetch as fetch } from "./safe-fetch";
import { addonAccepts, userAddons, type Addon } from "./addons";
import { loadInstalled } from "./addon-store";

const ADDON_TIMEOUT_MS = 4000;

function preferCustomMeta(): boolean {
  try {
    const profileState = JSON.parse(localStorage.getItem("harbor.profiles.v1") ?? "null") as {
      activeId?: string | null;
      profiles?: Array<{ id: string; settingsLinked?: boolean }>;
    } | null;
    const activeId = profileState?.activeId ?? "default";
    const activeProfile = profileState?.profiles?.find((profile) => profile.id === activeId);
    const preferredKey =
      activeProfile?.settingsLinked === false
        ? `harbor.settings.${activeId}`
        : "harbor.settings.shared";

    for (const key of [preferredKey, "harbor.settings.shared", "harbor.settings"]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value = (JSON.parse(raw) as { preferCustomMetaAddon?: unknown }).preferCustomMetaAddon;
      if (typeof value === "boolean") return value;
    }
    return false;
  } catch {
    return false;
  }
}

function localAddons(): Addon[] {
  return loadInstalled()
    .filter((a) => !!a.manifest)
    .map((a) => ({ manifest: a.manifest!, transportUrl: a.transportUrl }));
}

export async function resolveMeta(
  authKey: string | null,
  type: "movie" | "series",
  id: string,
): Promise<Meta | null> {
  const cinemetaPromise = cinemetaMeta(type, id).catch(() => null);

  const user = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
  const seen = new Set<string>();
  const candidates: Addon[] = [];
  for (const a of [...user, ...localAddons()]) {
    const key = a.transportUrl || a.manifest.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (addonAccepts(a, "meta", type, id) && !isCinemeta(a)) candidates.push(a);
  }

  const cinemetaOff = !cinemetaEnabled();

  if (candidates.length === 0) {
    return cinemetaOff ? cinemetaMeta(type, id, true).catch(() => null) : cinemetaPromise;
  }

  const addonRaces = candidates.map((a) => ({ a, p: fetchAddonMeta(a, type, id) }));

  if (cinemetaOff) {
    let firstAny: Meta | null = null;
    let firstAddon: Addon | null = null;
    for (const { a, p } of addonRaces) {
      const result = await p;
      if (!result) continue;
      if (result.poster) return withOrigin(result, a);
      if (!firstAny) {
        firstAny = result;
        firstAddon = a;
      }
    }
    if (firstAny && firstAddon) return withOrigin(firstAny, firstAddon);
    return cinemetaMeta(type, id, true).catch(() => null);
  }

  if (preferCustomMeta()) {
    for (const { a, p } of addonRaces) {
      const result = await p;
      if (result && result.poster) return withOrigin(result, a);
    }
    return (await cinemetaPromise) ?? null;
  }

  const cinemeta = await cinemetaPromise;
  if (cinemeta && cinemeta.poster) return cinemeta;

  for (const { a, p } of addonRaces) {
    const result = await p;
    if (result && result.poster) return withOrigin(result, a);
  }

  return cinemeta ?? null;
}

function withOrigin(meta: Meta, addon: Addon): Meta {
  if (meta.addonOrigin?.base) return meta;
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  return {
    ...meta,
    addonOrigin: {
      id: addon.manifest.id,
      name: addon.manifest.name ?? addon.manifest.id,
      logo: addon.manifest.logo,
      base,
    },
  };
}

export function hasCustomMetaAddon(): boolean {
  return localAddons().some(
    (a) =>
      !isCinemeta(a) &&
      (addonAccepts(a, "meta", "movie", "tt0000000") ||
        addonAccepts(a, "meta", "series", "tt0000000")),
  );
}

function isCinemeta(addon: Addon): boolean {
  const id = (addon.manifest.id ?? "").toLowerCase();
  const url = (addon.transportUrl ?? "").toLowerCase();
  return id.includes("cinemeta") || url.includes("v3-cinemeta") || url.includes("cinemeta.strem");
}

async function fetchAddonMeta(addon: Addon, type: string, id: string): Promise<Meta | null> {
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  const url = `${base}/meta/${type}/${id}.json`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ADDON_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { meta?: Meta };
    return json.meta ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
