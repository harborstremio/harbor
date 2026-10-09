import { useEffect, useState } from "react";
import {
  fetchAnimeCharacters,
  fetchAnimeCharactersByKitsu,
  type AnimeCharacter,
} from "@/lib/providers/anime-characters";

export function useAnimeCharacters(
  canonicalId: string | null,
  isAnime: boolean,
): AnimeCharacter[] {
  const [characters, setCharacters] = useState<AnimeCharacter[]>([]);

  useEffect(() => {
    if (!isAnime || !canonicalId) {
      setCharacters([]);
      return;
    }
    let cancelled = false;
    const load = async (): Promise<AnimeCharacter[]> => {
      if (canonicalId.startsWith("kitsu:")) {
        const kitsuId = Number(canonicalId.slice(6));
        if (!Number.isFinite(kitsuId)) return [];
        return fetchAnimeCharactersByKitsu(kitsuId);
      }
      if (canonicalId.startsWith("anilist:")) {
        const anilistId = Number(canonicalId.slice(8));
        if (!Number.isFinite(anilistId)) return [];
        return fetchAnimeCharacters(anilistId);
      }
      return [];
    };
    setCharacters([]);
    load()
      .then((res) => {
        if (!cancelled) setCharacters(res);
      })
      .catch(() => {
        if (!cancelled) setCharacters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canonicalId, isAnime]);

  return characters;
}
