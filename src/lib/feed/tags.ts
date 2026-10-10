export const MOVIE_GENRES: Record<string, number> = {
  Action: 28,
  Adventure: 12,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Family: 10751,
  Fantasy: 14,
  History: 36,
  Horror: 27,
  Music: 10402,
  Mystery: 9648,
  Romance: 10749,
  "Sci-Fi": 878,
  Thriller: 53,
  War: 10752,
  Western: 37,
};

export const TV_GENRES: Record<string, number> = {
  "Action & Adventure": 10759,
  Animation: 16,
  Comedy: 35,
  Crime: 80,
  Documentary: 99,
  Drama: 18,
  Mystery: 9648,
  "Sci-Fi & Fantasy": 10765,
  War: 10768,
};

export const GENRE_MOVIE_TO_TV: Record<number, number> = {
  28: 10759,
  12: 10759,
  878: 10765,
  14: 10765,
  10752: 10768,
  16: 16,
  35: 35,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  9648: 9648,
  37: 37,
};

export const GENRE_TV_TO_MOVIE: Record<number, number> = {
  10759: 28,
  10765: 878,
  10768: 10752,
  16: 16,
  35: 35,
  80: 80,
  99: 99,
  18: 18,
  10751: 10751,
  9648: 9648,
  37: 37,
};

export function genreEquivalents(id: number): number[] {
  const out = new Set<number>([id]);
  const tv = GENRE_MOVIE_TO_TV[id];
  if (tv) out.add(tv);
  const movie = GENRE_TV_TO_MOVIE[id];
  if (movie) out.add(movie);
  return [...out];
}

export type Decade = { label: string; from: string; to: string };

export const DECADES: Decade[] = [
  { label: "70s", from: "1970-01-01", to: "1979-12-31" },
  { label: "80s", from: "1980-01-01", to: "1989-12-31" },
  { label: "90s", from: "1990-01-01", to: "1999-12-31" },
  { label: "2000s", from: "2000-01-01", to: "2009-12-31" },
  { label: "2010s", from: "2010-01-01", to: "2019-12-31" },
];

export const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "fr", label: "French Cinema" },
  { code: "ja", label: "Japanese Cinema" },
  { code: "ko", label: "Korean Cinema" },
  { code: "es", label: "Spanish-Language" },
  { code: "it", label: "Italian Cinema" },
  { code: "de", label: "German Cinema" },
  { code: "sv", label: "Swedish Cinema" },
  { code: "da", label: "Danish Cinema" },
  { code: "zh", label: "Chinese Cinema" },
  { code: "hi", label: "Indian Cinema" },
  { code: "pt", label: "Portuguese-Language" },
  { code: "ru", label: "Russian Cinema" },
];

export function pickRandom<T>(arr: readonly T[], n: number, seed?: number): T[] {
  const copy = [...arr];
  let s = seed ?? Math.floor(Math.random() * 0x7fffffff);
  for (let i = copy.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  let s = seed ?? Math.floor(Math.random() * 0x7fffffff);
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dailySeed(now: Date = new Date()): number {
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

export function dayIndex(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 86_400_000);
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function mixSeed(base: number, salt: number): number {
  return (Math.imul(base, 2654435761) + salt) >>> 0;
}

export const LANG_TO_COUNTRY: Record<string, string> = {
  ja: "JP",
  ko: "KR",
  fr: "FR",
  it: "IT",
  de: "DE",
  sv: "SE",
  da: "DK",
  zh: "CN",
  hi: "IN",
  ru: "RU",
};
