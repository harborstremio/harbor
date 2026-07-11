import type { Affinity } from "@/lib/discover/types";
import { providerIdsFor, SERVICES } from "@/lib/providers/streaming";
import type { StreamingService } from "@/lib/settings";

import { ANCHORS } from "./daily-rows-anchors";
import { PEOPLE_TEMPLATES } from "./daily-rows-people";
import { normalizedAffinity, weightedPickWithoutReplacement } from "./daily-rows-select";
import { LAMBDA, movieGenre, relax, rng, type CatalogEntry, type ExpandedRow } from "./daily-rows-types";
import { genreToTmdbId } from "./sections";
import { DECADES, GENRE_MOVIE_TO_TV, LANG_TO_COUNTRY, LANGUAGES, MOVIE_GENRES, TV_GENRES, mixSeed } from "./tags";

export type { CatalogEntry, ExpandedRow } from "./daily-rows-types";
export { setPersonLabels } from "./daily-rows-people";

function genreNames(affinity: Affinity, base: number, n: number): string[] {
  return weightedPickWithoutReplacement(
    Object.keys(MOVIE_GENRES),
    (name) => 1 + LAMBDA * normalizedAffinity(affinity.genres, name),
    rng(base, "genre"),
    n,
  );
}

function decadePicks(affinity: Affinity, base: number, n: number) {
  return weightedPickWithoutReplacement(
    DECADES,
    (d) => 1 + LAMBDA * normalizedAffinity(affinity.decades, `${parseInt(d.from, 10)}s`),
    rng(base, "decade"),
    n,
  );
}

function langPicks(affinity: Affinity, base: number, n: number) {
  return weightedPickWithoutReplacement(
    LANGUAGES,
    (l) => 1 + LAMBDA * normalizedAffinity(affinity.languages, l.code),
    rng(base, "lang"),
    n,
  );
}

const PARAMETERIZED: CatalogEntry[] = [
  {
    id: "top_genre",
    dimension: "genre",
    eligible: () => true,
    expand: (affinity, base) =>
      genreNames(affinity, base, 3)
        .map((name): ExpandedRow | null => {
          const gid = genreToTmdbId(name);
          if (gid == null) return null;
          const floorPrimary = movieGenre(gid, {
            "vote_average.gte": "6.8",
            "vote_count.gte": "300",
            sort_by: "vote_average.desc",
          });
          return {
            key: `top_genre:${name}`,
            title: `Top Rated ${name}`,
            mediaType: "movie",
            endpoint: "discover",
            floorPrimary,
            floorRelaxed: relax(floorPrimary),
          };
        })
        .filter((r): r is ExpandedRow => r != null),
  },
  {
    id: "fresh_genre",
    dimension: "genre",
    eligible: () => true,
    expand: (affinity, base) => {
      const since = new Date(Date.now() - 540 * 86_400_000).toISOString().slice(0, 10);
      return genreNames(affinity, mixSeed(base, 2), 2)
        .map((name): ExpandedRow | null => {
          const gid = genreToTmdbId(name);
          if (gid == null) return null;
          const floorPrimary = movieGenre(gid, {
            "primary_release_date.gte": since,
            "vote_count.gte": "80",
            "vote_average.gte": "6.3",
            sort_by: "popularity.desc",
          });
          return {
            key: `fresh_genre:${name}`,
            title: `New in ${name}`,
            mediaType: "movie",
            endpoint: "discover",
            floorPrimary,
            floorRelaxed: relax(floorPrimary),
          };
        })
        .filter((r): r is ExpandedRow => r != null);
    },
  },
  {
    id: "genre_blend",
    dimension: "genre",
    eligible: (affinity) => affinity.totalEvents > 0,
    expand: (affinity, base) => {
      const names = genreNames(affinity, mixSeed(base, 4), 4);
      const out: ExpandedRow[] = [];
      for (let i = 0; i + 1 < names.length && out.length < 2; i += 2) {
        const ga = genreToTmdbId(names[i]);
        const gb = genreToTmdbId(names[i + 1]);
        if (ga == null || gb == null) continue;
        const floorPrimary: Record<string, string> = {
          with_genres: `${ga},${gb}`,
          "with_runtime.gte": "70",
          "vote_average.gte": "6.6",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
        };
        out.push({
          key: `genre_blend:${names[i]}_${names[i + 1]}`,
          title: `${names[i]} + ${names[i + 1]}`,
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        });
      }
      return out;
    },
  },
  {
    id: "hidden_gem_decade",
    dimension: "decade",
    eligible: () => true,
    expand: (affinity, base) =>
      decadePicks(affinity, base, 2).map((d) => {
        const floorPrimary: Record<string, string> = {
          "primary_release_date.gte": d.from,
          "primary_release_date.lte": d.to,
          "vote_average.gte": "7.2",
          "vote_count.gte": "200",
          "vote_count.lte": "3000",
          "with_runtime.gte": "70",
          sort_by: "vote_average.desc",
        };
        return {
          key: `hidden_gem_decade:${d.label}`,
          title: `Hidden Gems from the ${d.label}`,
          kicker: `Quietly great, ${d.label}`,
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        };
      }),
  },
  {
    id: "best_decade",
    dimension: "decade",
    eligible: () => true,
    expand: (affinity, base) =>
      decadePicks(affinity, mixSeed(base, 7), 1).map((d) => {
        const floorPrimary: Record<string, string> = {
          "primary_release_date.gte": d.from,
          "primary_release_date.lte": d.to,
          "vote_average.gte": "7.5",
          "vote_count.gte": "800",
          sort_by: "vote_average.desc",
        };
        return {
          key: `best_decade:${d.label}`,
          title: `Best of the ${d.label}`,
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        };
      }),
  },
  {
    id: "language",
    dimension: "country",
    eligible: () => true,
    expand: (affinity, base) =>
      langPicks(affinity, base, 1).map((l) => {
        const floorPrimary: Record<string, string> = {
          with_original_language: l.code,
          "vote_average.gte": "7.0",
          "vote_count.gte": "150",
          sort_by: "vote_average.desc",
        };
        return {
          key: `language:${l.code}`,
          title: l.label,
          kicker: "Top rated abroad",
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        };
      }),
  },
  {
    id: "country",
    dimension: "country",
    eligible: () => true,
    expand: (affinity, base) =>
      langPicks(affinity, mixSeed(base, 11), 2)
        .map((l): ExpandedRow | null => {
          const iso = LANG_TO_COUNTRY[l.code];
          if (!iso) return null;
          const floorPrimary: Record<string, string> = {
            with_origin_country: iso,
            "vote_average.gte": "7.0",
            "vote_count.gte": "120",
            sort_by: "vote_average.desc",
          };
          return {
            key: `country:${iso}`,
            title: `${l.label.replace(/ Cinema$/, "")} Films`,
            kicker: "From the region",
            mediaType: "movie",
            endpoint: "discover",
            floorPrimary,
            floorRelaxed: relax(floorPrimary),
          };
        })
        .filter((r): r is ExpandedRow => r != null)
        .slice(0, 1),
  },
  {
    id: "runtime_short",
    dimension: "runtime",
    eligible: () => true,
    expand: (affinity, base) =>
      genreNames(affinity, mixSeed(base, 3), 1).map((name) => {
        const gid = genreToTmdbId(name);
        const floorPrimary: Record<string, string> = {
          "with_runtime.lte": "90",
          "with_runtime.gte": "70",
          ...(gid != null ? { with_genres: String(gid) } : {}),
          "vote_average.gte": "7.0",
          "vote_count.gte": "250",
          sort_by: "vote_average.desc",
        };
        return {
          key: `runtime_short:${name}`,
          title: `A Short Tonight: ${name} Under 90`,
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        };
      }),
  },
  {
    id: "tv_genre",
    dimension: "genre",
    eligible: () => true,
    expand: (affinity, base) => {
      const since = new Date(Date.now() - 540 * 86_400_000).toISOString().slice(0, 10);
      const names = genreNames(affinity, mixSeed(base, 5), 6);
      const out: ExpandedRow[] = [];
      const usedTv = new Set<number>();
      for (const name of names) {
        if (out.length >= 3) break;
        const gid = genreToTmdbId(name);
        const tvId = gid != null ? GENRE_MOVIE_TO_TV[gid] : TV_GENRES[name];
        if (tvId == null || usedTv.has(tvId)) continue;
        usedTv.add(tvId);
        const isFresh = out.length === 1;
        const floorPrimary: Record<string, string> = isFresh
          ? {
              with_genres: String(tvId),
              "first_air_date.gte": since,
              "vote_count.gte": "60",
              "vote_average.gte": "6.8",
              sort_by: "popularity.desc",
            }
          : {
              with_genres: String(tvId),
              "vote_average.gte": "7.5",
              "vote_count.gte": "200",
              sort_by: "vote_average.desc",
            };
        out.push({
          key: `tv_genre:${isFresh ? "new" : "top"}:${name}`,
          title: isFresh ? `New ${name} Series` : `Top Rated ${name} Series`,
          kicker: isFresh ? "Fresh on TV" : "Critically acclaimed TV",
          mediaType: "tv",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        });
      }
      return out;
    },
  },
  {
    id: "provider",
    dimension: "network",
    eligible: (_affinity, settings) =>
      !!settings.tmdbKey && (Object.keys(SERVICES) as StreamingService[]).some((s) => settings.streaming[s]),
    expand: (affinity, base, settings) => {
      const enabled = (Object.keys(SERVICES) as StreamingService[]).filter((s) => settings.streaming[s]);
      if (enabled.length === 0) return [];
      const svc = weightedPickWithoutReplacement(enabled, () => 1, rng(base, "provider"), 1)[0];
      const service = SERVICES[svc];
      const names = genreNames(affinity, mixSeed(base, 13), 1);
      const gid = names.length ? genreToTmdbId(names[0]) : undefined;
      const floorPrimary: Record<string, string> = {
        with_watch_providers: providerIdsFor(service),
        watch_region: settings.region,
        ...(gid != null ? { with_genres: String(gid) } : {}),
        "vote_count.gte": "80",
        sort_by: "popularity.desc",
      };
      return [
        {
          key: `provider:${svc}`,
          title: `On ${service.name}, picked for you`,
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        },
      ];
    },
  },
];

export const CATALOG: CatalogEntry[] = [...PARAMETERIZED, ...PEOPLE_TEMPLATES, ...ANCHORS];
