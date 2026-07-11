import type { Addon } from "@/lib/addons";
import { safeFetch as fetch } from "@/lib/safe-fetch";

const STREMIO_DIRECTORIES = [
  "https://v3-cinemeta.strem.io/addon_catalog/all/community.json",
  "https://v3-cinemeta.strem.io/addon_catalog/all/official.json",
];

const STREMIO_FLAT_DIRECTORY = "https://api.strem.io/addonsofficialcollection.json";

async function fetchAddonCatalog(url: string): Promise<Addon[]> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const json = (await res.json()) as { addons?: Addon[] };
    return json.addons ?? [];
  } catch {
    return [];
  }
}

async function fetchFlatCollection(url: string): Promise<Addon[]> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    const raw = (await res.json()) as Addon[] | { addons?: Addon[] };
    if (Array.isArray(raw)) return raw;
    return raw.addons ?? [];
  } catch {
    return [];
  }
}

export async function fetchCommunityAddons(): Promise<Addon[]> {
  const out: Addon[] = [];
  const seen = new Set<string>();
  const lists = await Promise.all([
    ...STREMIO_DIRECTORIES.map(fetchAddonCatalog),
    fetchFlatCollection(STREMIO_FLAT_DIRECTORY),
  ]);
  for (const list of lists) {
    for (const a of list) {
      const id = a.manifest?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(a);
    }
  }
  return out;
}

export async function fetchManifest(transportUrl: string): Promise<Addon["manifest"] | null> {
  try {
    const res = await fetch(transportUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    return (await res.json()) as Addon["manifest"];
  } catch {
    return null;
  }
}
