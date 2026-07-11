import { MOVIE_GENRES as G, dailySeed } from "./tags";

export type MoodSpec = {
  id: string;
  title: string;
  params: Record<string, string>;
};

type Mood = { id: string; name: string; params: Record<string, string> };
type Bucket = "morning" | "afternoon" | "evening" | "late";

const POOL: Mood[] = [
  {
    id: "comfort",
    name: "Comfort Watch",
    params: {
      with_genres: `${G.Family},${G.Comedy},${G.Animation}`,
      "vote_average.gte": "7.2",
      "vote_count.gte": "1200",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "mind-benders",
    name: "Mind Benders",
    params: {
      with_genres: `${G["Sci-Fi"]},${G.Mystery},${G.Thriller}`,
      "vote_average.gte": "7.4",
      "vote_count.gte": "1500",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "after-dark",
    name: "After Dark",
    params: {
      with_genres: String(G.Horror),
      "vote_average.gte": "6.6",
      "vote_count.gte": "400",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "date-night",
    name: "Date Night",
    params: {
      with_genres: `${G.Romance},${G.Comedy}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "700",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "adrenaline",
    name: "Adrenaline Rush",
    params: {
      with_genres: `${G.Action},${G.Thriller}`,
      "vote_average.gte": "6.9",
      "vote_count.gte": "1200",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "tearjerker",
    name: "Bring the Tissues",
    params: {
      with_genres: `${G.Drama},${G.Romance}`,
      "vote_average.gte": "7.6",
      "vote_count.gte": "1200",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "feel-good",
    name: "Feel-Good Hits",
    params: {
      with_genres: `${G.Comedy},${G.Family}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "1000",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "laugh",
    name: "Laugh Out Loud",
    params: {
      with_genres: String(G.Comedy),
      "vote_average.gte": "6.8",
      "vote_count.gte": "1200",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "heist",
    name: "Heists & Cons",
    params: {
      with_genres: `${G.Crime},${G.Thriller}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "space",
    name: "Into the Stars",
    params: {
      with_genres: String(G["Sci-Fi"]),
      "vote_average.gte": "7.0",
      "vote_count.gte": "1500",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "fantasy",
    name: "Sword & Sorcery",
    params: {
      with_genres: `${G.Fantasy},${G.Adventure}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "1200",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "true-crime",
    name: "True Crime Files",
    params: {
      with_genres: `${G.Crime},${G.Documentary}`,
      "vote_average.gte": "7.2",
      "vote_count.gte": "150",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "slow-burn",
    name: "Slow-Burn Dramas",
    params: {
      with_genres: String(G.Drama),
      "vote_average.gte": "7.7",
      "vote_count.gte": "1500",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "neo-noir",
    name: "Neo-Noir",
    params: {
      with_genres: `${G.Crime},${G.Mystery}`,
      "vote_average.gte": "7.3",
      "vote_count.gte": "700",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "coming-of-age",
    name: "Coming of Age",
    params: {
      with_genres: `${G.Drama},${G.Comedy}`,
      "vote_average.gte": "7.3",
      "vote_count.gte": "600",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "epic-adventure",
    name: "Epic Adventures",
    params: {
      with_genres: `${G.Adventure},${G.Action}`,
      "vote_average.gte": "7.2",
      "vote_count.gte": "1500",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "war-stories",
    name: "War Stories",
    params: {
      with_genres: `${G.War},${G.Drama}`,
      "vote_average.gte": "7.4",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "westerns",
    name: "Saddle Up",
    params: {
      with_genres: String(G.Western),
      "vote_average.gte": "7.0",
      "vote_count.gte": "300",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "animation-night",
    name: "Animation Night",
    params: {
      with_genres: String(G.Animation),
      "vote_average.gte": "7.4",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "musicals",
    name: "Turn It Up",
    params: {
      with_genres: String(G.Music),
      "vote_average.gte": "7.0",
      "vote_count.gte": "200",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "history-buff",
    name: "History Buff",
    params: {
      with_genres: `${G.History},${G.Drama}`,
      "vote_average.gte": "7.4",
      "vote_count.gte": "600",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "mystery-box",
    name: "Whodunit",
    params: {
      with_genres: `${G.Mystery},${G.Thriller}`,
      "vote_average.gte": "7.2",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    },
  },
  {
    id: "visually-stunning",
    name: "Eye Candy",
    params: {
      with_genres: `${G.Adventure},${G.Fantasy},${G["Sci-Fi"]}`,
      "vote_average.gte": "7.3",
      "vote_count.gte": "2000",
      sort_by: "popularity.desc",
    },
  },
  {
    id: "cult-classics",
    name: "Cult Classics",
    params: {
      "primary_release_date.lte": "2005-12-31",
      "vote_average.gte": "7.5",
      "vote_count.gte": "600",
      sort_by: "vote_count.desc",
    },
  },
];

const POOL_BY_ID = new Map(POOL.map((m) => [m.id, m]));

const TIME_PREFS: Record<Bucket, string[]> = {
  morning: ["feel-good", "comfort", "laugh", "animation-night", "coming-of-age"],
  afternoon: ["epic-adventure", "fantasy", "space", "westerns", "history-buff"],
  evening: ["date-night", "neo-noir", "heist", "slow-burn", "mystery-box", "visually-stunning"],
  late: ["after-dark", "mind-benders", "true-crime", "adrenaline", "war-stories"],
};

const SESSION_LABEL: Record<Bucket, string> = {
  morning: "This Morning",
  afternoon: "This Afternoon",
  evening: "Tonight",
  late: "Late Night",
};

type Seasonal = {
  id: string;
  title: string;
  relatedPoolId?: string;
  active: (m: number, d: number) => boolean;
  params: (now: Date) => Record<string, string>;
};

const SEASONALS: Seasonal[] = [
  {
    id: "new-year",
    title: "New Year, New Stories",
    relatedPoolId: "feel-good",
    active: (m, d) => (m === 11 && d >= 27) || (m === 0 && d <= 4),
    params: () => ({
      with_genres: `${G.Comedy},${G.Adventure}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "1500",
      sort_by: "popularity.desc",
    }),
  },
  {
    id: "valentine",
    title: "Be My Valentine",
    relatedPoolId: "date-night",
    active: (m, d) => m === 1 && d <= 15,
    params: () => ({
      with_genres: String(G.Romance),
      "vote_average.gte": "7.0",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    }),
  },
  {
    id: "spooky",
    title: "Spooky Season",
    relatedPoolId: "after-dark",
    active: (m) => m === 9,
    params: () => ({
      with_genres: String(G.Horror),
      "vote_average.gte": "6.4",
      "vote_count.gte": "300",
      sort_by: "popularity.desc",
    }),
  },
  {
    id: "holiday",
    title: "Holiday Warmth",
    relatedPoolId: "comfort",
    active: (m, d) => m === 11 && d <= 26,
    params: () => ({
      with_genres: `${G.Family},${G.Comedy}`,
      "vote_average.gte": "6.8",
      "vote_count.gte": "600",
      sort_by: "popularity.desc",
    }),
  },
  {
    id: "summer",
    title: "Summer Blockbusters",
    relatedPoolId: "epic-adventure",
    active: (m) => m >= 5 && m <= 7,
    params: () => ({
      with_genres: `${G.Action},${G.Adventure},${G["Sci-Fi"]}`,
      "vote_average.gte": "6.8",
      "vote_count.gte": "3000",
      sort_by: "popularity.desc",
    }),
  },
  {
    id: "awards",
    title: "Awards Contenders",
    relatedPoolId: "slow-burn",
    active: (m, d) => (m === 0 && d >= 5) || (m === 1 && d >= 16) || (m === 2 && d <= 20),
    params: (now) => ({
      "primary_release_date.gte": `${now.getFullYear() - 2}-01-01`,
      "vote_average.gte": "7.3",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    }),
  },
  {
    id: "autumn",
    title: "Cozy Autumn Nights",
    relatedPoolId: "slow-burn",
    active: (m) => m === 8 || m === 10,
    params: () => ({
      with_genres: `${G.Drama},${G.Mystery}`,
      "vote_average.gte": "7.4",
      "vote_count.gte": "800",
      sort_by: "vote_average.desc",
    }),
  },
  {
    id: "spring",
    title: "Spring Awakening",
    relatedPoolId: "feel-good",
    active: (m, d) => m === 3 || m === 4 || (m === 2 && d >= 21),
    params: () => ({
      with_genres: `${G.Comedy},${G.Adventure},${G.Family}`,
      "vote_average.gte": "7.0",
      "vote_count.gte": "800",
      sort_by: "popularity.desc",
    }),
  },
];

function bucketFor(hour: number): Bucket {
  if (hour < 11) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late";
}

function rotate<T>(arr: T[], by: number): T[] {
  if (arr.length === 0) return arr;
  const k = ((by % arr.length) + arr.length) % arr.length;
  return arr.slice(k).concat(arr.slice(0, k));
}

export function pickMoodSpecs(now: Date = new Date(), count = 6): MoodSpec[] {
  const bucket = bucketFor(now.getHours());
  const label = SESSION_LABEL[bucket];
  const seed = dailySeed(now);
  const bucketIndex = ["morning", "afternoon", "evening", "late"].indexOf(bucket);

  const out: MoodSpec[] = [];
  const used = new Set<string>();

  const seasonal = SEASONALS.find((s) => s.active(now.getMonth(), now.getDate()));
  if (seasonal) {
    out.push({ id: `mood-${seasonal.id}`, title: seasonal.title, params: seasonal.params(now) });
    used.add(seasonal.id);
    if (seasonal.relatedPoolId) used.add(seasonal.relatedPoolId);
  }

  const order = [
    ...rotate(TIME_PREFS[bucket], seed),
    ...rotate(
      POOL.map((m) => m.id),
      seed + bucketIndex * 31,
    ),
  ];

  for (const id of order) {
    if (out.length >= count) break;
    if (used.has(id)) continue;
    const mood = POOL_BY_ID.get(id);
    if (!mood) continue;
    used.add(id);
    out.push({ id: `mood-${id}`, title: `${label} · ${mood.name}`, params: mood.params });
  }

  return out.slice(0, count);
}
