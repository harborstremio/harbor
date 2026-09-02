import { userAddons, type Addon, type AddonCatalogCursor, type CatalogDef } from "@/lib/addons";
import { fetchManifestAt, filterEnabled, loadInstalled } from "@/lib/addon-store";
import { applyOrderToItems, hostOf, loadDisplayOrder } from "@/lib/addons-store/reorder";
import { bpAddonLogo } from "./bp-addon-logo";

export type BpAddonEntry = {
  key: string;
  id: string;
  name: string;
  transportUrl: string;
  base: string;
  logo?: string;
  hasCatalogs: boolean;
  cursor?: AddonCatalogCursor;
};

export const BP_ADDON_MAX_CARDS = 16;

const HYDRATE_AT_ONCE = 4;
// A quota strip leaves every entry manifest-less, so an uncapped repair is one
// manifest GET per installed addon on the same tick home is fanning out its
// catalogs. Sixteen cards only need the ones a person can actually reach.
const HYDRATE_MAX = 8;

export function bpAddonBase(transportUrl: string): string {
  return transportUrl.replace(/\/manifest\.json$/, "");
}

export function bpUsableCatalogs(manifest: Addon["manifest"] | undefined): CatalogDef[] {
  return (manifest?.catalogs ?? []).filter((c) => {
    if (!c?.name || !c.type || !c.id) return false;
    if (c.type.toLowerCase() === "addon_catalog") return false;
    return !(c.extra ?? []).some((e) => e.isRequired && e.name === "search");
  });
}

// slimManifest keeps `catalogs` but rewrites each extra as { name, isRequired }
// and drops `options`, so a locally persisted catalog with a required non-search
// extra has no value to send and is correctly skipped here. The consequence is
// that the local cursor is thinner than the one built from a cloud manifest,
// which is what enrich() is for.
export function bpCursorFor(base: string, cats: CatalogDef[]): AddonCatalogCursor | undefined {
  for (const cat of cats) {
    const required = (cat.extra ?? []).filter((e) => e.isRequired);
    const extras: Array<{ name: string; value: string }> = [];
    let ok = true;
    for (const e of required) {
      const opt = e.options?.[0];
      if (!opt) {
        ok = false;
        break;
      }
      extras.push({ name: e.name, value: opt });
    }
    if (ok) return { base, type: cat.type, id: cat.id, extras: extras.length ? extras : undefined };
  }
  return undefined;
}

function toEntry(
  id: string,
  transportUrl: string,
  manifest: Addon["manifest"] | undefined,
): BpAddonEntry {
  const base = bpAddonBase(transportUrl);
  const cats = bpUsableCatalogs(manifest);
  return {
    key: `${manifest?.id ?? id}:${transportUrl}`,
    id: manifest?.id ?? id,
    name: manifest?.name ?? hostOf(transportUrl),
    transportUrl,
    base,
    // Resolved once, here, so the card and the band hero can never disagree
    // about which mark belongs to the addon under the ring.
    logo: bpAddonLogo(manifest?.logo, transportUrl),
    hasCatalogs: cats.length > 0,
    cursor: cats.length > 0 ? bpCursorFor(base, cats) : undefined,
  };
}

// The mark's geometry is chosen from hasCatalogs, so a card that flipped once a
// late manifest landed would resize under the focus ring. First answer wins for
// the life of the session; a hydrated name is a cross-fade, a resize is a jump.
const catalogLatch = new Map<string, boolean>();

function latch(entry: BpAddonEntry): BpAddonEntry {
  const seen = catalogLatch.get(entry.key);
  if (seen === undefined) {
    catalogLatch.set(entry.key, entry.hasCatalogs);
    return entry;
  }
  return seen === entry.hasCatalogs ? entry : { ...entry, hasCatalogs: seen };
}

export function readLocalAddonEntries(): BpAddonEntry[] {
  try {
    const items = applyOrderToItems(filterEnabled(loadInstalled()), loadDisplayOrder());
    return items
      .slice(0, BP_ADDON_MAX_CARDS)
      .map((a) => latch(toEntry(a.id, a.transportUrl, a.manifest)));
  } catch {
    return [];
  }
}

const cloudMemo = new Map<string, Promise<Addon[]>>();

// gatherCatalogAddons is the usual merge, but it re-fetches a manifest for every
// catalog-less addon on every call, and stream-only addons are the majority of a
// real install list. The row only needs the cloud half, so it pays one POST and
// no manifest fetches at all.
export function loadCloudAddons(authKey: string): Promise<Addon[]> {
  const hit = cloudMemo.get(authKey);
  if (hit) return hit;
  const next = userAddons(authKey)
    .then((list) => filterEnabled(list))
    .catch(() => [] as Addon[]);
  cloudMemo.set(authKey, next);
  return next;
}

export function mergeCloud(local: BpAddonEntry[], cloud: Addon[]): BpAddonEntry[] {
  const seen = new Set(local.map((e) => e.transportUrl));
  const out = local.slice();
  for (const addon of cloud) {
    if (out.length >= BP_ADDON_MAX_CARDS) break;
    if (seen.has(addon.transportUrl)) continue;
    seen.add(addon.transportUrl);
    out.push(latch(toEntry(addon.manifest.id, addon.transportUrl, addon.manifest)));
  }
  return out;
}

// A cloud manifest is whole where the persisted one was slimmed, so the entry
// keeps its position and only gains what it was missing. Nothing the user is
// looking at moves.
export function enrich(entries: BpAddonEntry[], cloud: Addon[]): BpAddonEntry[] {
  if (cloud.length === 0) return entries;
  const byUrl = new Map(cloud.map((a) => [a.transportUrl, a.manifest]));
  return entries.map((e) => {
    const manifest = byUrl.get(e.transportUrl);
    if (!manifest) return e;
    const fresh = latch(toEntry(manifest.id, e.transportUrl, manifest));
    return sameEntry(fresh, e) ? e : fresh;
  });
}

export async function hydrateStripped(entries: BpAddonEntry[]): Promise<BpAddonEntry[]> {
  const todo = entries
    .filter((e) => !e.logo && e.name === hostOf(e.transportUrl))
    .slice(0, HYDRATE_MAX);
  if (todo.length === 0) return entries;
  const found = new Map<string, Addon["manifest"]>();
  for (let i = 0; i < todo.length; i += HYDRATE_AT_ONCE) {
    const slice = todo.slice(i, i + HYDRATE_AT_ONCE);
    await Promise.all(
      slice.map(async (e) => {
        const manifest = await fetchManifestAt(e.transportUrl).catch(() => null);
        if (manifest) found.set(e.transportUrl, manifest);
      }),
    );
  }
  if (found.size === 0) return entries;
  return entries.map((e) => {
    const manifest = found.get(e.transportUrl);
    return manifest ? latch(toEntry(manifest.id, e.transportUrl, manifest)) : e;
  });
}

// Cursor identity is part of the comparison on purpose. Comparing name and logo
// alone threw away the one thing enrich() exists to repair: a locally slimmed
// catalog resolves to no cursor, the cloud manifest resolves to a real one, and
// dropping that left the addon permanently unable to fetch its own mosaic.
function sameEntry(a: BpAddonEntry, b: BpAddonEntry): boolean {
  return (
    a.key === b.key &&
    a.name === b.name &&
    a.logo === b.logo &&
    a.hasCatalogs === b.hasCatalogs &&
    a.cursor?.id === b.cursor?.id &&
    a.cursor?.type === b.cursor?.type &&
    a.cursor?.extras?.length === b.cursor?.extras?.length
  );
}

export function sameEntries(a: readonly BpAddonEntry[], b: readonly BpAddonEntry[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((e, i) => sameEntry(e, b[i]));
}
