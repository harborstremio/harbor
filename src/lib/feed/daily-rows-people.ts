import { topEntries } from "@/lib/discover/affinity";
import type { Affinity } from "@/lib/discover/types";

import { relax, type CatalogEntry, type ExpandedRow } from "./daily-rows-types";

const personCache = new Map<number, string>();

function personLabel(id: number): string | null {
  return personCache.get(id) ?? null;
}

function topPeople(affinity: Affinity, n: number): number[] {
  const merged: Record<number, number> = { ...affinity.directors };
  for (const [id, w] of Object.entries(affinity.creators)) {
    merged[Number(id)] = (merged[Number(id)] ?? 0) + (w as number);
  }
  return topEntries(merged, n)
    .filter(([, w]) => w > 0)
    .map(([id]) => Number(id));
}

export const PEOPLE_TEMPLATES: CatalogEntry[] = [
  {
    id: "person_director",
    dimension: "person",
    eligible: (affinity) => topPeople(affinity, 1).length > 0,
    expand: (affinity) =>
      topPeople(affinity, 2).map((id): ExpandedRow => {
        const name = personLabel(id);
        const floorPrimary: Record<string, string> = {
          with_people: String(id),
          "vote_average.gte": "6.5",
          "vote_count.gte": "200",
          sort_by: "vote_average.desc",
        };
        return {
          key: `person_director:${id}`,
          title: name ? `More from ${name}` : "More from a Favorite Director",
          kicker: "A name you keep watching",
          mediaType: "movie",
          endpoint: "discover",
          floorPrimary,
          floorRelaxed: relax(floorPrimary),
        };
      }),
  },
  {
    id: "person_cast",
    dimension: "person",
    eligible: (affinity) => topEntries(affinity.cast, 1).filter(([, w]) => w > 0).length > 0,
    expand: (affinity) =>
      topEntries(affinity.cast, 2)
        .filter(([, w]) => w > 0)
        .map(([raw]): ExpandedRow => {
          const id = Number(raw);
          const name = personLabel(id);
          const floorPrimary: Record<string, string> = {
            with_cast: String(id),
            "vote_average.gte": "6.5",
            "vote_count.gte": "250",
            sort_by: "popularity.desc",
          };
          return {
            key: `person_cast:${id}`,
            title: name ? `Starring ${name}` : "Starring a Favorite",
            kicker: "An actor you keep watching",
            mediaType: "movie",
            endpoint: "discover",
            floorPrimary,
            floorRelaxed: relax(floorPrimary),
          };
        }),
  },
  {
    id: "keyword",
    dimension: "keyword",
    eligible: (affinity) => topEntries(affinity.keywords, 1).filter(([, w]) => w > 0).length > 0,
    expand: (affinity) =>
      topEntries(affinity.keywords, 2)
        .filter(([, w]) => w > 0)
        .map(([id]): ExpandedRow => {
          const floorPrimary: Record<string, string> = {
            with_keywords: String(id),
            "with_runtime.gte": "70",
            "vote_average.gte": "6.6",
            "vote_count.gte": "200",
            sort_by: "vote_average.desc",
          };
          return {
            key: `keyword:${id}`,
            title: "More stories like these",
            kicker: "Themes you keep returning to",
            mediaType: "movie",
            endpoint: "discover",
            floorPrimary,
            floorRelaxed: relax(floorPrimary),
          };
        }),
  },
];

export function setPersonLabels(labels: Map<number, string>): void {
  for (const [id, name] of labels) personCache.set(id, name);
}
