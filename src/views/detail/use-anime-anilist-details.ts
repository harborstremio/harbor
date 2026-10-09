import { useEffect, useState } from "react";
import {
  fetchAnilistMediaDetails,
  fetchAnilistMediaDetailsByKitsu,
  type AnilistMediaDetails,
} from "@/lib/anilist/media-details";

export function useAnimeAnilistDetails(
  canonicalId: string | null,
  isAnime: boolean,
): AnilistMediaDetails | null {
  const [details, setDetails] = useState<AnilistMediaDetails | null>(null);

  useEffect(() => {
    if (!isAnime || !canonicalId) {
      setDetails(null);
      return;
    }
    let cancelled = false;
    const load = async (): Promise<AnilistMediaDetails | null> => {
      if (canonicalId.startsWith("kitsu:")) {
        const kitsuId = Number(canonicalId.slice(6));
        if (!Number.isFinite(kitsuId)) return null;
        return fetchAnilistMediaDetailsByKitsu(kitsuId);
      }
      if (canonicalId.startsWith("anilist:")) {
        const anilistId = Number(canonicalId.slice(8));
        if (!Number.isFinite(anilistId)) return null;
        return fetchAnilistMediaDetails(anilistId);
      }
      return null;
    };
    setDetails(null);
    load()
      .then((res) => {
        if (!cancelled) setDetails(res);
      })
      .catch(() => {
        if (!cancelled) setDetails(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canonicalId, isAnime]);

  return details;
}
