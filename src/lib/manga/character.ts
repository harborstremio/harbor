import { anilistRequest } from "@/lib/anilist/client";
import { readArt, writeArt } from "./art-cache";

const QUERY = `query ($s: String) {
  Media(search: $s, type: MANGA) {
    characters(sort: FAVOURITES_DESC, perPage: 1) {
      nodes { image { large } }
    }
  }
}`;

type Resp = {
  Media: { characters: { nodes: Array<{ image: { large: string | null } | null }> } | null } | null;
};

const cache = new Map<string, string>();

export async function topCharacterImage(name: string): Promise<string | null> {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const mem = cache.get(key);
  if (mem) return mem;
  const disk = readArt("char", key);
  if (disk) {
    cache.set(key, disk);
    return disk;
  }
  try {
    const data = await anilistRequest<Resp>(QUERY, { s: name }, undefined, true);
    const img = data?.Media?.characters?.nodes?.[0]?.image?.large ?? null;
    if (img) {
      cache.set(key, img);
      writeArt("char", key, img);
    }
    return img;
  } catch {
    return null;
  }
}
