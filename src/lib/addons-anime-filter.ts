import {
  contentCatalogs,
  dedupeAddonRows,
  fetchCatalogRow,
  gatherCatalogAddons,
  type Addon,
  type AddonRow,
  type CatalogDef,
} from "@/lib/addons";
import { runLanes } from "@/lib/run-lanes";
import { isAnimeRow } from "@/views/anime/anime-rows";

const ANIME_ROW_CAP = 24;
const CATALOG_LANES = 6;
const IDLE_TIMEOUT_MS = 3000;
const IDLE_FALLBACK_MS = 1500;

type CatalogTask = { addon: Addon; cat: CatalogDef };

// isAnimeRow runs three tests: type === "anime", a name regex, then a sample of the metas.
// Handing it an EMPTY metas array makes the third test bail out, so what comes back is
// exactly "do the manifest fields alone qualify this catalog". That is the whole point:
// never duplicate the regex here, or the two lists drift and a rename in anime-rows.tsx
// silently stops matching.
function manifestQualifies(cat: CatalogDef): boolean {
  return isAnimeRow({ key: "", type: cat.type, name: cat.name, metas: [] });
}

function whenIdle(run: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  if (typeof win.requestIdleCallback === "function") {
    const handle = win.requestIdleCallback(run, { timeout: IDLE_TIMEOUT_MS });
    return () => win.cancelIdleCallback?.(handle);
  }
  const timer = window.setTimeout(run, IDLE_FALLBACK_MS);
  return () => window.clearTimeout(timer);
}

async function fetchAnimeRows(tasks: CatalogTask[]): Promise<AddonRow[]> {
  const rows = await runLanes(tasks, CATALOG_LANES, (t) =>
    fetchCatalogRow(t.addon, t.cat).catch(() => null),
  );
  return rows.filter((r): r is AddonRow => r != null).filter(isAnimeRow);
}

// loadAddonRows fetches every catalog of every installed addon and the anime page then
// throws away everything that is not anime, so the cold path pays for catalogs nobody on
// this page will ever see. Split the work: catalogs the manifest already proves are anime
// go out immediately, the rest are swept at idle so an addon that only reveals itself
// through kitsu:/mal: ids is still picked up, just not ahead of first paint.
export function loadAnimeAddonRows(
  authKey: string | null,
  onRows: (rows: AddonRow[]) => void,
): () => void {
  let cancelled = false;
  let cancelIdle: (() => void) | null = null;

  void (async () => {
    const addons = await gatherCatalogAddons(authKey).catch(() => [] as Addon[]);
    if (cancelled) return;

    const fast: CatalogTask[] = [];
    const rest: CatalogTask[] = [];
    for (const addon of addons) {
      for (const cat of contentCatalogs(addon)) {
        (manifestQualifies(cat) ? fast : rest).push({ addon, cat });
      }
    }

    const first = await fetchAnimeRows(fast);
    if (cancelled) return;
    onRows(dedupeAddonRows(first, ANIME_ROW_CAP));
    if (rest.length === 0) return;

    cancelIdle = whenIdle(() => {
      void (async () => {
        const swept = await fetchAnimeRows(rest);
        if (cancelled || swept.length === 0) return;
        onRows(dedupeAddonRows([...first, ...swept], ANIME_ROW_CAP));
      })().catch(() => {});
    });
  })().catch(() => {
    if (!cancelled) onRows([]);
  });

  return () => {
    cancelled = true;
    cancelIdle?.();
  };
}
