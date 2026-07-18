import {
  fetchFullModeCatalog,
  fetchFullModeManifest,
  fetchStremboxdCatalog,
  fetchStremboxdManifest,
} from "./client";
import { stremboxdMetaToMeta } from "./to-meta";
import type { LetterboxdListRef, LetterboxdSession } from "./types";
import type { Meta } from "@/lib/cinemeta";
import type { HomeRow } from "@/views/home/home-types";

export const LETTERBOXD_CATALOG_IDS = [
  "letterboxd-watchlist",
  "letterboxd-diary",
  "letterboxd-liked",
  "letterboxd-friends",
  "letterboxd-recommended",
  "letterboxd-popular",
  "letterboxd-top250",
] as const;

export const FULL_MODE_CATALOG_IDS = new Set<string>([
  "letterboxd-diary",
  "letterboxd-friends",
  "letterboxd-recommended",
]);

// Catalog IDs as exposed by the Stremboxd backend.
// In full mode (/:userId) the backend uses these IDs:
//   letterboxd-watchlist, letterboxd-diary, letterboxd-friends,
//   letterboxd-liked-films, letterboxd-recommended (needs TMDB),
//   letterboxd-popular, letterboxd-top250, letterboxd-list-{id}
// In public mode (/:config) the IDs are the same for popular/top250,
// and watchlist/liked-films appear when a username is set.
//
// IMPORTANT: the full-mode id for liked films is "letterboxd-liked-films",
// NOT "letterboxd-liked". We map the user-facing toggle to the real id.
const PUBLIC_TO_FULL_ID: Record<string, string> = {
  "letterboxd-liked": "letterboxd-liked-films",
};

function resolveCatalogId(id: string, useFull: boolean): string {
  if (useFull && PUBLIC_TO_FULL_ID[id]) return PUBLIC_TO_FULL_ID[id];
  return id;
}

const PRIORITY = new Map<string, number>([
  ["letterboxd-watchlist", 0],
  ["letterboxd-diary", 1],
  ["letterboxd-liked", 2],
  ["letterboxd-liked-films", 2],
  ["letterboxd-friends", 3],
  ["letterboxd-recommended", 4],
  ["letterboxd-popular", 5],
  ["letterboxd-top250", 6],
]);

// Default names for public mode (no username). In full mode, the server
// generates personalized names like "karsten's Watchlist" — we fetch those
// from the /stremio/:userId/manifest.json endpoint. These are fallbacks only.
const DEFAULT_NAMES: Record<string, string> = {
  "letterboxd-watchlist": "Letterboxd Watchlist",
  "letterboxd-diary": "Recent Diary",
  "letterboxd-liked": "Liked Films",
  "letterboxd-liked-films": "Liked Films",
  "letterboxd-friends": "Friends' Activity",
  "letterboxd-recommended": "Recommended for You",
  "letterboxd-popular": "Popular This Week",
  "letterboxd-top250": "Top 250 Narrative Features",
};

// Name templates for full-mode fallback when manifest fetch fails.
// {name} is replaced with the user's display name or username.
const FULL_NAME_TEMPLATES: Record<string, string> = {
  "letterboxd-watchlist": "{name}'s Watchlist",
  "letterboxd-diary": "{name}'s Recent Diary",
  "letterboxd-liked": "{name}'s Liked Films",
  "letterboxd-liked-films": "{name}'s Liked Films",
  "letterboxd-friends": "{name}'s Friends Activity",
  "letterboxd-recommended": "Recommended for {name}",
  "letterboxd-popular": "Popular This Week",
  "letterboxd-top250": "Top 250 Narrative Features",
};

const MIN_ROW_METAS = 4;

export type BuildLetterboxdRowsArgs = {
  configSegment: string;
  selectedCatalogs: string[];
  hiddenCatalogs?: string[];
  catalogOrder?: string[];
  session: LetterboxdSession | null;
  listRefs?: LetterboxdListRef[];
};

export async function buildLetterboxdHomeRows({
  configSegment,
  selectedCatalogs,
  hiddenCatalogs = [],
  catalogOrder = [],
  session,
  listRefs,
}: BuildLetterboxdRowsArgs): Promise<HomeRow[]> {
  if (selectedCatalogs.length === 0) return [];

  // Filter out hidden catalogs
  const hidden = new Set(hiddenCatalogs);
  const visible = selectedCatalogs.filter((id) => !hidden.has(id));
  if (visible.length === 0) return [];

  const listNameById = new Map<string, string>();
  for (const l of listRefs ?? []) {
    listNameById.set(`letterboxd-list-${l.id}`, l.name);
  }

  let manifestNames = new Map<string, string>();
  try {
    // In full mode, fetch the personalized manifest (has names like
    // "karsten's Watchlist", "Recommended for karsten"). In public mode,
    // fetch the config-based manifest.
    const manifest = session
      ? await fetchFullModeManifest(session.userId)
      : await fetchStremboxdManifest(configSegment);
    manifestNames = new Map(manifest.catalogs.map((c) => [c.id, c.name]));
  } catch {
    /* fall back to default/template names */
  }

  // Fallback name generator for full mode when manifest fetch failed
  const displayName = session?.displayName || session?.username || "";
  const fallbackName = (catalogId: string, realId: string): string => {
    if (session && FULL_NAME_TEMPLATES[realId]) {
      return FULL_NAME_TEMPLATES[realId]!.replace("{name}", displayName);
    }
    return DEFAULT_NAMES[catalogId] ?? DEFAULT_NAMES[realId] ?? catalogId;
  };

  // Use explicit catalogOrder if set, otherwise fall back to priority
  const orderMap = new Map<string, number>();
  if (catalogOrder.length > 0) {
    catalogOrder.forEach((id, i) => orderMap.set(id, i));
  }
  const ordered = [...visible].sort((a, b) => {
    const pa = orderMap.has(a) ? orderMap.get(a)! : (PRIORITY.get(a) ?? 99) + 1000;
    const pb = orderMap.has(b) ? orderMap.get(b)! : (PRIORITY.get(b) ?? 99) + 1000;
    if (pa !== pb) return pa - pb;
    return a.localeCompare(b);
  });

  const rows: HomeRow[] = [];

  for (const catalogId of ordered) {
    const isFullOnly = FULL_MODE_CATALOG_IDS.has(catalogId);
    if (isFullOnly && !session) continue;

    // In full mode, use the authenticated /stremio/:userId/ endpoint for ALL
    // catalogs — it sees the private watchlist + liked films too, whereas the
    // public /:config/ endpoint only sees public data.
    const useFull = !!session;
    const realCatalogId = resolveCatalogId(catalogId, useFull);

    let firstPage;
    try {
      firstPage = useFull
        ? await fetchFullModeCatalog(session!.userId, realCatalogId, 0)
        : await fetchStremboxdCatalog(configSegment, realCatalogId, 0);
    } catch {
      continue;
    }
    if (firstPage.metas.length < MIN_ROW_METAS) continue;

    const metas = firstPage.metas.map(stremboxdMetaToMeta);
    // Use the real catalog id for manifest name lookup, fall back to template
    const manifestName = manifestNames.get(realCatalogId);
    const listRef = listRefs?.find((r) => `letterboxd-list-${r.id}` === catalogId);
    // For custom lists, append the owner name if not already in the manifest name
    let name: string;
    if (manifestName) {
      name = manifestName;
    } else if (listRef) {
      const owner = listRef.owner ? ` · ${listRef.owner}` : "";
      name = `${listRef.name}${owner}`;
    } else {
      name = fallbackName(catalogId, realCatalogId);
    }

    rows.push({
      key: `letterboxd-${catalogId}`,
      type: "movie",
      name,
      metas,
      page: 1,
      hasMore: false,
      noDedup: true,
      fetcher: async (page: number): Promise<Meta[]> => {
        const skip = (page - 1) * 100;
        const p = useFull
          ? await fetchFullModeCatalog(session!.userId, realCatalogId, skip)
          : await fetchStremboxdCatalog(configSegment, realCatalogId, skip);
        return p.metas.map(stremboxdMetaToMeta);
      },
    });
  }

  return rows;
}
