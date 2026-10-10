import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useSettings } from "./settings";

const TMDB = "https://api.themoviedb.org/3";
const STALE_MS = 6 * 60 * 60 * 1000;
const PAGES = 5;
const TOP = 100;

export type KnownForEntry = {
  id: number;
  title: string;
  mediaType: "movie" | "tv";
  posterPath: string | null;
  releaseInfo: string | null;
};

export type PersonEntry = {
  id: number;
  rank: number;
  name: string;
  profilePath: string | null;
  popularity: number;
  department: string;
  knownFor: KnownForEntry[];
};

type RankMaps = {
  actors: PersonEntry[];
  directors: PersonEntry[];
  producers: PersonEntry[];
  writers: PersonEntry[];
  loadedAt: number;
};

let cache: RankMaps | null = null;
let inflight: Promise<RankMaps | null> | null = null;

function normalizeKnownFor(arr: any[] | undefined): KnownForEntry[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((k) => k.media_type === "movie" || k.media_type === "tv")
    .map((k) => ({
      id: k.id,
      title: k.title || k.name || "",
      mediaType: k.media_type,
      posterPath: k.poster_path ?? null,
      releaseInfo: (k.release_date || k.first_air_date || "").slice(0, 4) || null,
    }))
    .filter((k) => k.title);
}

async function fetchPopular(key: string): Promise<RankMaps | null> {
  if (!key) return null;
  const pages = await Promise.all(
    Array.from({ length: PAGES }, (_, i) => i + 1).map((p) =>
      fetch(`${TMDB}/person/popular?api_key=${key}&page=${p}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ),
  );

  const all = pages.filter(Boolean).flatMap((p: any) => (p?.results ?? []) as any[]);

  const buckets: Record<string, PersonEntry[]> = {
    Acting: [],
    Directing: [],
    Production: [],
    Writing: [],
  };

  const seen = new Set<number>();

  for (const p of all) {
    const dept = p.known_for_department;
    if (!dept || !(dept in buckets)) continue;
    if (p.adult) continue;
    const kf: any[] = Array.isArray(p.known_for) ? p.known_for : [];
    if (kf.some((k) => k.adult)) continue;
    if (!kf.some((k) => (k.vote_count ?? 0) >= 200)) continue;
    if (seen.has(p.id)) continue;
    if (buckets[dept].length >= TOP) continue;
    seen.add(p.id);
    buckets[dept].push({
      id: p.id,
      rank: buckets[dept].length + 1,
      name: p.name,
      profilePath: p.profile_path ?? null,
      popularity: p.popularity ?? 0,
      department: dept,
      knownFor: normalizeKnownFor(p.known_for),
    });
  }

  return {
    actors: buckets.Acting,
    directors: buckets.Directing,
    producers: buckets.Production,
    writers: buckets.Writing,
    loadedAt: Date.now(),
  };
}

async function loadRankings(key: string): Promise<RankMaps | null> {
  if (cache && Date.now() - cache.loadedAt < STALE_MS) return cache;
  if (inflight) return inflight;
  inflight = fetchPopular(key).then((r) => {
    if (r) cache = r;
    inflight = null;
    return r;
  });
  return inflight;
}

type RankingsValue = {
  ready: boolean;
  rank: (id: number, dept?: string) => number | undefined;
  topList: (dept: string) => PersonEntry[];
};

const Ctx = createContext<RankingsValue>({ ready: false, rank: () => undefined, topList: () => [] });

export function RankingsProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [ready, setReady] = useState(!!cache);

  useEffect(() => {
    if (!settings.tmdbKey) return;
    let cancelled = false;
    loadRankings(settings.tmdbKey).then(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [settings.tmdbKey]);

  const list = (dept: string): PersonEntry[] => {
    if (!cache) return [];
    if (dept === "Directing") return cache.directors;
    if (dept === "Production") return cache.producers;
    if (dept === "Writing") return cache.writers;
    return cache.actors;
  };

  const rank = (id: number, dept = "Acting"): number | undefined => {
    return list(dept).find((p) => p.id === id)?.rank;
  };

  return <Ctx.Provider value={{ ready, rank, topList: list }}>{children}</Ctx.Provider>;
}

export function useRankings() {
  return useContext(Ctx);
}
