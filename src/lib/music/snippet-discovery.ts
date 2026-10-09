import { safeFetch } from "@/lib/safe-fetch";
import { artistCreditParts } from "./search-artists";
import { normalizeName } from "./search-normalize";
import { snippetTracksFromCatalog } from "./snippets";
import { musicTrackCredit } from "./track-identity";
import type { MusicTrack } from "./types";

type CatalogRow = { id?: unknown; name?: unknown; data?: unknown; artist?: { id?: unknown }; error?: unknown };
const artists = new Map<string, number>();
const rows = (value: unknown): CatalogRow[] => Array.isArray(value) ? value.filter(row => row && typeof row === "object").slice(0, 100) : [];
const artistId = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;

async function read(path: string, signal: AbortSignal): Promise<CatalogRow> {
  signal.throwIfAborted();
  const response = await safeFetch(`https://api.deezer.com/${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(6000)]) });
  if (!response.ok) throw new Error("Snippet catalog unavailable");
  const value = await response.json();
  if (!value || typeof value !== "object" || value.error) throw new Error("Snippet catalog unavailable");
  return value;
}

async function findArtist(seed: MusicTrack, signal: AbortSignal): Promise<number | undefined> {
  const credit = musicTrackCredit(seed);
  const lead = artistCreditParts(credit.artist)[0] ?? credit.artist;
  const key = normalizeName(lead);
  if (!key) return undefined;
  const held = artists.get(key);
  if (held) return held;
  const id = /^deezer:track:(\d+)$/.exec(seed.collectionOrigin?.id ?? seed.id)?.[1];
  let found: number | undefined;
  if (id) found = artistId((await read(`track/${id}`, signal).catch(() => null))?.artist?.id);
  if (!found) {
    const page = await read(`search/artist?q=${encodeURIComponent(lead)}&limit=5`, signal);
    found = artistId(rows(page.data).find(row => typeof row.name === "string" && normalizeName(row.name) === key)?.id);
  }
  if (found) {
    artists.set(key, found);
    while (artists.size > 60) artists.delete(artists.keys().next().value!);
  }
  return found;
}

/** Stream preview-bearing recommendations as each lane returns, without full-radio enrichment. */
export async function discoverSnippetTracks(seed: MusicTrack | null, signal: AbortSignal, publish: (tracks: MusicTrack[]) => void): Promise<void> {
  const deliver = (page: CatalogRow) => { if (!signal.aborted) publish(snippetTracksFromCatalog(page.data)); };
  // A new library can open Quick listen before the home rows have supplied a seed.
  if (!seed) { await read("chart/0/tracks?limit=60", signal).then(deliver); return; }
  const id = await findArtist(seed, signal);
  if (!id || signal.aborted) return;
  await Promise.allSettled([
    read(`artist/${id}/radio?limit=40`, signal).then(deliver),
    read(`artist/${id}/top?limit=30`, signal).then(deliver),
    read(`artist/${id}/related?limit=6`, signal).then(async page => {
      const related = rows(page.data).map(row => artistId(row.id)).filter((id): id is number => !!id);
      // Keep related-artist requests bounded; the first radio/top response is already usable.
      let cursor = 0;
      await Promise.all(Array.from({ length: 2 }, async () => {
        while (cursor < related.length && !signal.aborted) {
          const next = related[cursor++];
          await read(`artist/${next}/top?limit=8`, signal).then(deliver).catch(() => {});
        }
      }));
    }),
  ]);
}
