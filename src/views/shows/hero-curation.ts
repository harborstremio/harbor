import type { Meta } from "@/lib/cinemeta";
import { TV_GENRES } from "@/lib/feed/tags";
import { tmdbDiscover, tmdbSeriesRow, tmdbTrending } from "@/lib/providers/tmdb";

const HERO_POOL_TARGET = 12;
const HERO_CANDIDATE_TARGET = 240;
const POOL_CACHE_KEY = "harbor.shows.hero.pool.v2";
const POOL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type DayBucket = "morning" | "afternoon" | "evening" | "night";

export function dayBucket(now: Date = new Date()): DayBucket {
  const h = now.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

export type BucketCopy = { kicker: string; title: string; subtitle: string };

const BUCKET_VARIANTS: Record<DayBucket, BucketCopy[]> = {
  morning: [
    {
      kicker: "Morning Lineup",
      title: "Easing into series",
      subtitle: "Slow-burn worlds and bright chapters worth opening with coffee.",
    },
    {
      kicker: "Good Morning",
      title: "Today's openers",
      subtitle: "Series to ease into while the day is still quiet.",
    },
    {
      kicker: "Daybreak",
      title: "First-light picks",
      subtitle: "Worlds to step into before the inbox catches up.",
    },
    {
      kicker: "AM Picks",
      title: "Coffee-and-couch",
      subtitle: "Half-hours, anthologies, and a few epics for the morning routine.",
    },
    {
      kicker: "Open the Day",
      title: "Series with mileage",
      subtitle: "Long-running comforts and new chapters worth pressing play on.",
    },
    {
      kicker: "Quiet Hours",
      title: "Slow-burn starts",
      subtitle: "Stories that reward your attention before the day gets loud.",
    },
    {
      kicker: "This Morning",
      title: "Worth catching up on",
      subtitle: "What everyone has been quietly binging this week.",
    },
  ],
  afternoon: [
    {
      kicker: "Afternoon Picks",
      title: "Daytime watching",
      subtitle: "Easy half-hours and lighter dramas to ride out the afternoon.",
    },
    {
      kicker: "Midday Lineup",
      title: "Between meetings",
      subtitle: "Episodes you can drop into without losing the thread.",
    },
    {
      kicker: "Afternoon Roll",
      title: "Pick up an episode",
      subtitle: "Lunch-break comedies and slow-cooker dramas, ready when you are.",
    },
    {
      kicker: "The Long Lunch",
      title: "Series to disappear into",
      subtitle: "Worlds wide enough for an hour or a whole free afternoon.",
    },
    {
      kicker: "Daylight Watching",
      title: "Bright-side series",
      subtitle: "Sharp comedies, sunny worlds, and the occasional binge bait.",
    },
    {
      kicker: "Holdover Picks",
      title: "Carry it through the day",
      subtitle: "Companion series for whatever the afternoon throws at you.",
    },
    {
      kicker: "PM Picks",
      title: "Couch hours",
      subtitle: "Series for the part of the day that runs on coffee and snacks.",
    },
  ],
  evening: [
    {
      kicker: "Tonight",
      title: "Tonight's lineup",
      subtitle: "Prestige drama, weekly chapters, and series worth disappearing into.",
    },
    {
      kicker: "Prime Time",
      title: "What to watch tonight",
      subtitle: "Crowd-pleasers, prestige picks, and the kind of series people text about.",
    },
    {
      kicker: "Sundown",
      title: "Evening on the couch",
      subtitle: "Drop-in chapters and long arcs for the post-dinner stretch.",
    },
    {
      kicker: "Press Play",
      title: "Tonight's marquee",
      subtitle: "The series that make the rest of the night disappear.",
    },
    {
      kicker: "Tonight's Slate",
      title: "Episodes worth the evening",
      subtitle: "What's hot this week, what's prestige forever, what's worth the hours.",
    },
    {
      kicker: "Showtime",
      title: "Tonight's main event",
      subtitle: "Series for the part of the day you actually look forward to.",
    },
    {
      kicker: "Saved for Now",
      title: "Tonight's binge bait",
      subtitle: "Pilots that pull you in and finales that earn the season.",
    },
  ],
  night: [
    {
      kicker: "Late Night",
      title: "After-hours picks",
      subtitle: "Dark, immersive, and binge-worthy when the house is quiet.",
    },
    {
      kicker: "Past Midnight",
      title: "One more episode",
      subtitle: "Series for the part of the night that won't let you sleep.",
    },
    {
      kicker: "Witching Hour",
      title: "Late-night chapters",
      subtitle: "Pull-you-under stories for the quietest part of the day.",
    },
    {
      kicker: "Lights Out",
      title: "Headphone series",
      subtitle: "Slow, strange, and absorbing. Best with the lights down low.",
    },
    {
      kicker: "Insomnia Lineup",
      title: "Worth the lost hour",
      subtitle: "Dense plots and rich worlds for when sleep is not happening.",
    },
    {
      kicker: "Late Show",
      title: "After the news",
      subtitle: "Quiet dramas, sharp thrillers, and series you save for yourself.",
    },
    {
      kicker: "Night Owl",
      title: "While the world's asleep",
      subtitle: "Series with the patience to match your late-night hours.",
    },
  ],
};

const BUCKET_INDEX: Record<DayBucket, number> = {
  morning: 0,
  afternoon: 1,
  evening: 2,
  night: 3,
};

export function dayOfYear(d: Date = new Date()): number {
  const start = new Date(d.getFullYear(), 0, 0);
  return Math.floor((d.getTime() - start.getTime()) / 86_400_000);
}

export function rotationSeed(): number {
  return dayOfYear() * 4 + BUCKET_INDEX[dayBucket()];
}

export function bucketCopy(): BucketCopy {
  const bucket = dayBucket();
  const variants = BUCKET_VARIANTS[bucket];
  const idx = (dayOfYear() + BUCKET_INDEX[bucket] * 3) % variants.length;
  return variants[idx];
}

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function readPoolCache(): Meta[] | null {
  try {
    const raw = localStorage.getItem(POOL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { expires?: number; metas?: Meta[] };
    if (!parsed.expires || parsed.expires < Date.now()) return null;
    if (!Array.isArray(parsed.metas) || parsed.metas.length < HERO_POOL_TARGET) return null;
    return parsed.metas;
  } catch {
    return null;
  }
}

function writePoolCache(metas: Meta[]): void {
  try {
    localStorage.setItem(
      POOL_CACHE_KEY,
      JSON.stringify({ expires: Date.now() + POOL_CACHE_TTL_MS, metas }),
    );
  } catch {}
}

async function fetchPool(key: string): Promise<Meta[]> {
  const drama = String(TV_GENRES.Drama);
  const comedy = String(TV_GENRES.Comedy);
  const crime = String(TV_GENRES.Crime);
  const sciFi = String(TV_GENRES["Sci-Fi & Fantasy"]);
  const doc = String(TV_GENRES.Documentary);

  const safe = <T>(p: Promise<T[]>) => p.catch(() => [] as T[]);

  const fetchers: Array<() => Promise<Meta[]>> = [
    () => safe(tmdbTrending(key, "tv", "week", 1)),
    () => safe(tmdbSeriesRow(key, "popular", 1)),
    () => safe(tmdbSeriesRow(key, "on_the_air", 1)),
    () => safe(tmdbSeriesRow(key, "top_rated", 1)),
    () => safe(tmdbDiscover(key, "tv", {
      "vote_average.gte": "8.6",
      "vote_count.gte": "2000",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_genres: drama,
      "vote_average.gte": "8.2",
      "vote_count.gte": "1000",
      "first_air_date.gte": "2018-01-01",
      sort_by: "popularity.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_genres: comedy,
      "vote_average.gte": "8.0",
      "vote_count.gte": "700",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_genres: crime,
      "vote_average.gte": "8.0",
      "vote_count.gte": "600",
      sort_by: "vote_count.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_genres: sciFi,
      "vote_average.gte": "8.0",
      "vote_count.gte": "600",
      sort_by: "vote_count.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_genres: doc,
      "vote_average.gte": "8.0",
      "vote_count.gte": "150",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_type: "2",
      "vote_average.gte": "7.8",
      "vote_count.gte": "300",
      sort_by: "vote_count.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      "first_air_date.gte": isoDaysAgo(90),
      "vote_count.gte": "60",
      "vote_average.gte": "7.4",
      sort_by: "popularity.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_origin_country: "GB",
      "vote_average.gte": "8.0",
      "vote_count.gte": "300",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_origin_country: "KR",
      "vote_average.gte": "7.8",
      "vote_count.gte": "120",
      sort_by: "popularity.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_networks: "49",
      "vote_count.gte": "250",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      with_networks: "213",
      "vote_average.gte": "7.8",
      "vote_count.gte": "400",
      sort_by: "vote_average.desc",
      page: "1",
    })),
    () => safe(tmdbDiscover(key, "tv", {
      "vote_average.gte": "7.8",
      "vote_count.gte": "500",
      "first_air_date.lte": "2010-12-31",
      sort_by: "vote_count.desc",
      page: "1",
    })),
  ];

  const sources: Meta[][] = [];
  const BATCH = 4;
  for (let i = 0; i < fetchers.length; i += BATCH) {
    const batch = fetchers.slice(i, i + BATCH);
    const results = await Promise.all(batch.map((fn) => fn()));
    sources.push(...results);
  }

  const seen = new Set<string>();
  const pool: Meta[] = [];
  const cap = HERO_CANDIDATE_TARGET;
  for (let i = 0; i < 24 && pool.length < cap; i++) {
    for (const list of sources) {
      const m = list[i];
      if (!m || !m.background || seen.has(m.id)) continue;
      seen.add(m.id);
      pool.push(m);
      if (pool.length >= cap) break;
    }
  }
  return pool;
}

export async function buildShowHero(key: string): Promise<Meta[]> {
  let pool = readPoolCache();
  if (!pool) {
    pool = await fetchPool(key);
    if (pool.length === 0) return [];
    writePoolCache(pool);
  }
  const shuffled = seededShuffle(pool, rotationSeed());
  return shuffled.slice(0, HERO_POOL_TARGET);
}
