import type { ReactNode } from "react";
import { MOVIE_GENRES, TV_GENRES } from "@/lib/feed/tags";
import { COUNTRIES, type CustomCalendar } from "./constants";

export type Translate = (key: string, vars?: Record<string, string | number>) => string;

export type ChipItem = {
  key: string;
  label: string;
  selected: boolean;
  onToggle: () => void;
  leading?: ReactNode;
};

export type GroupSummaries = {
  genres: string;
  watchProviders: string;
  originCountries: string;
  trackedPeople: string;
};

export function buildActiveCount(value: CustomCalendar): number {
  return (
    value.genres.length +
    value.watchProviders.length +
    value.originCountries.length +
    value.trackedPeople.length +
    (value.includeTraktAnticipated ? 1 : 0) +
    (value.includeTraktWatchlist ? 1 : 0)
  );
}

export function buildSummary(value: CustomCalendar, t: Translate): string {
  const bits: string[] = [];
  if (value.trackedPeople.length) bits.push(t("{n} people", { n: value.trackedPeople.length }));
  if (value.genres.length)
    bits.push(
      value.genres.length === 1
        ? t("{n} genre", { n: value.genres.length })
        : t("{n} genres", { n: value.genres.length }),
    );
  if (value.watchProviders.length)
    bits.push(
      value.watchProviders.length === 1
        ? t("{n} provider", { n: value.watchProviders.length })
        : t("{n} providers", { n: value.watchProviders.length }),
    );
  if (value.originCountries.length)
    bits.push(
      value.originCountries.length === 1
        ? t("{n} country", { n: value.originCountries.length })
        : t("{n} countries", { n: value.originCountries.length }),
    );
  if (value.includeTraktAnticipated) bits.push(t("Anticipated"));
  if (value.includeTraktWatchlist) bits.push(t("Watchlist"));
  if (bits.length === 0) return t("No filters yet");
  return bits.join(" · ");
}

export function buildGroupSummaries(value: CustomCalendar, t: Translate): GroupSummaries {
  const countryName = (code: string) => COUNTRIES.find((c) => c.code === code)?.name ?? code;
  return {
    genres: value.genres.map((g) => t(g.name)).join(", "),
    watchProviders: value.watchProviders.map((p) => p.name).join(", "),
    originCountries: value.originCountries.map((code) => t(countryName(code))).join(", "),
    trackedPeople: value.trackedPeople.map((p) => p.name).join(", "),
  };
}

export function buildGenreOptions(
  value: CustomCalendar,
  t: Translate,
  onToggleGenre: (g: { id: number; name: string; mediaType: "movie" | "tv" }) => void,
): ChipItem[] {
  return [
    ...Object.entries(MOVIE_GENRES).map(([name, id]) => ({
      key: `movie:${id}`,
      label: t(name),
      selected: value.genres.some((g) => g.id === id && g.mediaType === "movie"),
      onToggle: () => onToggleGenre({ id, name, mediaType: "movie" as const }),
    })),
    ...Object.entries(TV_GENRES)
      .filter(([name]) => !(name in MOVIE_GENRES))
      .map(([name, id]) => ({
        key: `tv:${id}`,
        label: t("{name} (TV)", { name: t(name) }),
        selected: value.genres.some((g) => g.id === id && g.mediaType === "tv"),
        onToggle: () => onToggleGenre({ id, name, mediaType: "tv" as const }),
      })),
  ];
}
