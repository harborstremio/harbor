import { buildKitsuEpisodes, mergeAniZipEpisodes } from "@/lib/providers/anime-episode-build";
import { animeKitsuMeta } from "@/lib/providers/anime-kitsu-addon";
import { aniZipByKitsu } from "@/lib/providers/anizip";
import { kitsuEpisodes, type KitsuEpisode } from "@/lib/providers/kitsu";

const cache = new Map<number, Promise<KitsuEpisode[]>>();

function isPlayable(ep: KitsuEpisode): boolean {
  if (ep.streamId) return true;
  return !!(ep.imdbId?.startsWith("tt") && ep.imdbSeason != null && ep.imdbEpisode != null);
}

export function fetchEntryEpisodes(kitsuId: number): Promise<KitsuEpisode[]> {
  const cached = cache.get(kitsuId);
  if (cached) return cached;
  const p = (async () => {
    const [addonMeta, raw, aniZip] = await Promise.all([
      animeKitsuMeta(`kitsu:${kitsuId}`).catch(() => null),
      kitsuEpisodes(kitsuId, 100).catch(() => [] as KitsuEpisode[]),
      aniZipByKitsu(kitsuId).catch(() => null),
    ]);
    const eps = buildKitsuEpisodes(addonMeta, raw);
    mergeAniZipEpisodes(eps, aniZip);
    const sourceMetaId = `kitsu:${kitsuId}`;
    const out: KitsuEpisode[] = [];
    for (const ep of eps) {
      if (!isPlayable(ep)) continue;
      out.push({ ...ep, sourceMetaId });
    }
    return out;
  })();
  cache.set(kitsuId, p);
  return p;
}
