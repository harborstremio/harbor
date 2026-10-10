import { genreSearchKey, musicGenre, type MusicDiscoveryGenre } from "./genre-catalog";

// These are narrower styles, not the related-scene suggestions used for browsing.
const STYLES: Record<string, string[]> = {
  "hip-hop": ["hip hop", "hiphop", "rap", "trap", "drill", "grime", "boom bap", "gangsta rap", "southern hip hop", "cloud rap", "alternative hip hop", "conscious hip hop", "east coast hip hop", "west coast hip hop", "memphis rap", "phonk"],
  electronic: ["electronica", "house", "techno", "trance", "drum and bass", "dubstep", "breakbeat", "synthwave", "hardstyle", "hardcore techno", "happy hardcore", "uk garage"],
  dance: ["dance music", "dance pop", "eurodance", "hands up", "house", "trance", "disco", "happy hardcore", "hardstyle", "jumpstyle"],
  rock: ["alternative rock", "indie rock", "hard rock", "punk rock", "progressive rock", "psychedelic rock", "garage rock", "soft rock", "post rock"],
  metal: ["heavy metal", "death metal", "black metal", "metalcore", "thrash metal", "doom metal", "power metal", "progressive metal"],
  house: ["deep house", "tech house", "progressive house", "afro house", "acid house", "electro house"],
  rnb: ["rnb", "r and b", "rhythm and blues", "contemporary r and b", "neo soul"],
};

const acceptedTags = new WeakMap<MusicDiscoveryGenre, Set<string>>();
export function genreMatchesTags(genre: MusicDiscoveryGenre, tags: readonly string[]): boolean {
  let accepted = acceptedTags.get(genre);
  if (!accepted) {
    accepted = new Set([genre.name, ...genre.aliases, ...(STYLES[genre.slug] ?? [])].map(genreSearchKey));
    acceptedTags.set(genre, accepted);
  }
  return tags.some(tag => accepted.has(genreSearchKey(tag)));
}

// Tag lists arrive ranked, so an early tag says far more about an artist than a late one.
// Kanye West carries hip hop, pop and electronic tags; without weighting he qualifies for
// all three and every genre mix converges on the same handful of popular artists.
export function genreTagScore(genre: MusicDiscoveryGenre, tags: readonly string[]): number {
  let accepted = acceptedTags.get(genre);
  if (!accepted) {
    accepted = new Set([genre.name, ...genre.aliases, ...(STYLES[genre.slug] ?? [])].map(genreSearchKey));
    acceptedTags.set(genre, accepted);
  }
  let score = 0;
  for (const [index, tag] of tags.entries()) {
    if (accepted.has(genreSearchKey(tag))) score += 1 / (index + 1);
  }
  return score;
}

/** The one genre an artist most belongs to, so a mix cannot borrow them from a stronger scene. */
export function primaryGenre(
  genres: readonly MusicDiscoveryGenre[],
  tags: readonly string[],
): MusicDiscoveryGenre | null {
  let best: MusicDiscoveryGenre | null = null;
  let bestScore = 0;
  for (const genre of genres) {
    const score = genreTagScore(genre, tags);
    if (score > bestScore || (score === bestScore && score > 0 && best && genre.id < best.id)) {
      best = genre;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function genreIdMatchesTags(id: number, tags: readonly string[]): boolean {
  const genre = musicGenre(id);
  return !!genre && genreMatchesTags(genre, tags);
}
