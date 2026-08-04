import { anilistRequest } from "@/lib/anilist/client";
import { readArt, writeArt } from "./art-cache";

const QUERY = `query ($s: String) {
  m: Page(perPage: 1) { media(search: $s, type: MANGA) { bannerImage coverImage { extraLarge } } }
  a: Page(perPage: 1) { media(search: $s, type: ANIME) { bannerImage coverImage { extraLarge } } }
}`;

type Media = { bannerImage: string | null; coverImage: { extraLarge: string | null } | null };
type Resp = {
  m: { media: Media[] } | null;
  a: { media: Media[] } | null;
};

const cache = new Map<string, string>();

export async function mangaBackdrop(title: string): Promise<string | null> {
  const key = title.trim().toLowerCase();
  if (!key) return null;
  const hit = cache.get(key);
  if (hit) return hit;
  const disk = readArt("bg", key);
  if (disk) {
    cache.set(key, disk);
    return disk;
  }
  try {
    const data = await anilistRequest<Resp>(QUERY, { s: title }, undefined, true);
    const a = data?.a?.media?.[0];
    const m = data?.m?.media?.[0];
    const url =
      a?.bannerImage ??
      m?.bannerImage ??
      a?.coverImage?.extraLarge ??
      m?.coverImage?.extraLarge ??
      null;
    if (url) {
      cache.set(key, url);
      writeArt("bg", key, url);
    }
    return url;
  } catch {
    return null;
  }
}
