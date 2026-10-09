import { artistCreditParts } from "./search-artists";
import { artistIdentityKey, resolveArtist } from "./artist-authority";
import type { MusicArtistRef } from "./types";
export type ArtistCreditPart = { name: string; separator: string };
export function splitArtistCredit(credit: string): ArtistCreditPart[] {
  return artistCreditParts(credit, true).map((name, index) => ({
    name,
    separator: index ? ", " : "",
  }));
}

const FEATURE_BRACKET = /[([]\s*(?:feat|ft|featuring)\.?\s+([^)\]]+)[)\]]/i;
const FEATURE_TRAIL = /(?:^|\s)(?:feat|ft|featuring)\.?\s+(.+)$/i;
const FEATURE_SPLIT = /\s*[,&]\s*/;

/** Most catalogues credit only the lead and bury the guests in the title, so read them back out. */
export function featuredCreditNames(title: string): string[] {
  const clause = FEATURE_BRACKET.exec(title)?.[1] ?? FEATURE_TRAIL.exec(title)?.[1];
  if (!clause) return [];
  return clause
    .split(FEATURE_SPLIT)
    .map((part) =>
      part
        .trim()
        .replace(/[)\]]+$/, "")
        .trim(),
    )
    .filter((part) => part.length > 1 && part.length < 60);
}

export function withFeaturedCredits(parts: ArtistCreditPart[], title: string): ArtistCreditPart[] {
  const named = new Set(parts.map((part) => part.name.trim().toLowerCase()));
  const guests = featuredCreditNames(title).filter((name) => !named.has(name.toLowerCase()));
  if (!guests.length) return parts;
  return [
    ...parts,
    ...guests.map((name, index) => ({
      name,
      separator: index || !parts.length ? ", " : " feat. ",
    })),
  ];
}

const cache = new Map<string, Promise<ArtistCreditPart[]>>();
const waiting: (() => void)[] = [];
let running = 0;
function release() {
  running--;
  waiting.shift()?.();
}
/** Verify punctuation-bearing artist names without merging the people in an unverified credit. */
export async function resolveDisplayCredits(
  name: string,
  lookup = async (query: string): Promise<MusicArtistRef[]> => {
    const canonical = (await resolveArtist(query)).canonical;
    return canonical ? [canonical] : [];
  },
): Promise<ArtistCreditPart[]> {
  const parts = artistCreditParts(name).map((part, index) => ({
    name: part,
    separator: index ? ", " : "",
  }));
  if (parts.length < 2 || /\b(?:feat\.?|ft\.?|featuring)\s/i.test(name)) return parts;
  const saved = cache.get(name);
  if (saved) return saved;
  if (waiting.length >= 32) return parts;
  const work = (async () => {
    await new Promise<void>((resolve) => {
      const start = () => {
        running++;
        resolve();
      };
      if (running < 3) start();
      else waiting.push(start);
    });
    try {
      const candidates = await new Promise<MusicArtistRef[]>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Artist lookup timed out")), 12000);
        lookup(name)
          .then(resolve, reject)
          .finally(() => clearTimeout(timer));
      });
      const exact = candidates.some(
        (artist) =>
          artistIdentityKey(artist.name) === artistIdentityKey(name) &&
          (artist.musicBrainzId ||
            /^(?:deezer:artist:|spotify:artist:|musicbrainz:artist:)/.test(artist.id)),
      );
      return exact ? [{ name, separator: "" }] : parts;
    } catch {
      cache.delete(name);
      return parts;
    } finally {
      release();
    }
  })();
  cache.set(name, work);
  while (cache.size > 200) cache.delete(cache.keys().next().value!);
  return work;
}
