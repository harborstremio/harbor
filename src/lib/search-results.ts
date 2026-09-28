import type { Meta } from "./cinemeta";
import type { AddonResultGroup } from "./search-addons";
import type { SearchResults } from "./search";
import { metaIdentityKeys } from "./meta-identity.ts";
import { normalizeSearchQuery } from "./search-query.ts";

type CatalogResults = { movies: Meta[]; series: Meta[] };

function uniqueMetas(metas: Meta[], cap = 20): Meta[] {
  const seen = new Set<string>();
  return metas
    .filter((meta) => {
      const keys = metaIdentityKeys(meta);
      const duplicate = keys.some((key) => seen.has(key));
      for (const key of keys) seen.add(key);
      return !!meta.id && !duplicate;
    })
    .slice(0, cap);
}

function fromCinemeta(meta: Meta): boolean {
  const origin = meta.addonOrigin;
  return /cinemeta/i.test(origin?.id ?? "") || /cinemeta/i.test(origin?.base ?? "");
}

export function combineSearchResults(
  base: SearchResults,
  addon: CatalogResults,
  cinemeta: CatalogResults,
  groups: AddonResultGroup[],
): SearchResults {
  const query = normalizeSearchQuery(base.query);
  const nonLatin = Array.from(query).some(
    (letter) => /\p{L}/u.test(letter) && !/\p{Script=Latin}/u.test(letter),
  );
  const native = uniqueMetas(
    [...addon.series, ...groups.flatMap((group) => group.metas)].filter(
      (meta) => meta.type === "series" && meta.addonOrigin?.id === "org.cnative.tv",
    ),
  );
  const topKeys = new Set(base.topMatch ? metaIdentityKeys(base.topMatch.meta) : []);
  const otherSeries =
    !nonLatin && !base.topMatch
      ? [
          ...base.series,
          ...addon.series,
          ...cinemeta.series,
          ...groups.flatMap((group) => group.metas),
        ].filter((meta) => meta.type === "series" && meta.addonOrigin?.id !== "org.cnative.tv")
      : [];
  const preferred = query
    ? (native.find((meta) => normalizeSearchQuery(meta.name) === query) ??
      (nonLatin
        ? (native.find((meta) => metaIdentityKeys(meta).some((key) => topKeys.has(key))) ??
          native.find((meta) => normalizeSearchQuery(meta.name).includes(query)))
        : undefined) ??
      (!base.topMatch
        ? (otherSeries.find((meta) => normalizeSearchQuery(meta.name) === query) ??
          otherSeries.find((meta) => normalizeSearchQuery(meta.name).includes(query)) ??
          native[0])
        : undefined))
    : undefined;

  // Cinemeta may return a popular feed for unsupported native-language searches.
  // Keep a result only when its title matches or another search provider confirms it.
  const confirmed = new Set(
    [
      ...base.movies,
      ...base.series,
      ...(base.topMatch ? [base.topMatch.meta] : []),
      ...addon.movies,
      ...addon.series,
      ...groups.flatMap((group) => group.metas),
    ]
      .filter((meta) => !fromCinemeta(meta))
      .flatMap(metaIdentityKeys),
  );
  const relevantCinemeta = (meta: Meta) =>
    !nonLatin ||
    normalizeSearchQuery(meta.name).includes(query) ||
    metaIdentityKeys(meta).some((key) => confirmed.has(key));
  const relevantAddon = (meta: Meta) => !fromCinemeta(meta) || relevantCinemeta(meta);
  const movies = uniqueMetas([
    ...base.movies,
    ...addon.movies.filter(relevantAddon),
    ...cinemeta.movies.filter(relevantCinemeta),
  ]);
  const series = uniqueMetas([
    ...(preferred ? [preferred] : []),
    ...(nonLatin ? [...native, ...base.series] : [...base.series, ...native]),
    ...addon.series.filter(relevantAddon),
    ...cinemeta.series.filter(relevantCinemeta),
  ]);
  const shown = new Set([...movies, ...series].flatMap(metaIdentityKeys));
  return {
    ...base,
    topMatch: preferred
      ? {
          kind: "series",
          meta: preferred,
          popularity: 0,
          backdrop: preferred.background,
          overview: preferred.description,
        }
      : base.topMatch,
    movies,
    series,
    addonGroups: groups
      .map((group) => ({
        ...group,
        metas: group.metas.filter(
          (meta) => relevantAddon(meta) && !metaIdentityKeys(meta).some((key) => shown.has(key)),
        ),
      }))
      .filter((group) => group.metas.length > 0),
  };
}
