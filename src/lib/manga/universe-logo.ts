import { anilistRequest } from "@/lib/anilist/client";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { fetchTvdbArtwork } from "@/lib/providers/tvdb-proxy";
import { readArt, writeArt } from "./art-cache";

const QUERY = `query ($s: String) { Media(search: $s, type: ANIME) { idMal } }`;

const cache = new Map<string, string>();

export async function universeLogo(query: string): Promise<string | null> {
  const key = query.trim().toLowerCase();
  if (!key) return null;
  const mem = cache.get(key);
  if (mem) return mem;
  const disk = readArt("logo", key);
  if (disk) {
    cache.set(key, disk);
    return disk;
  }
  try {
    const data = await anilistRequest<{ Media: { idMal: number | null } | null }>(
      QUERY,
      { s: query },
      undefined,
      true,
    );
    const malId = data?.Media?.idMal ?? null;
    if (malId == null) return null;
    const kitsuId = await externalToKitsu("myanimelist", malId).catch(() => null);
    if (kitsuId == null) return null;
    const art = await fetchTvdbArtwork({ kitsuId });
    const logo = art.clearLogos[0] ?? null;
    if (logo) {
      cache.set(key, logo);
      writeArt("logo", key, logo);
    }
    return logo;
  } catch {
    return null;
  }
}
