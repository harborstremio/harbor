import type { Meta } from "./cinemeta";
import type { SearchResults } from "./search";
import type { AddonResultGroup } from "./search-addons";
import { metaIdentityKeys } from "./meta-identity";
import { isNativeSearchQuery, normalizeSearchQuery } from "./search-query";

type CatalogResults = { movies: Meta[]; series: Meta[] };

function fromCinemeta(meta: Meta): boolean {
  return (
    /cinemeta/i.test(meta.addonOrigin?.id ?? "") || /cinemeta/i.test(meta.addonOrigin?.base ?? "")
  );
}

// Resolve all aliases before choosing a card: a later addon can link a TMDB
// preview to an IMDb preview that appeared earlier in the same response.
function identityResolver(metas: Meta[]): (meta: Meta) => string {
  const parents = new Map<string, string>();
  const find = (key: string): string => {
    const parent = parents.get(key);
    if (!parent || parent === key) return key;
    const root = find(parent);
    parents.set(key, root);
    return root;
  };
  for (const meta of metas) {
    const keys = metaIdentityKeys(meta);
    const root = find(keys[0]);
    for (const key of keys.slice(1)) parents.set(find(key), root);
  }
  return (meta) => find(metaIdentityKeys(meta)[0]);
}

export function canPublishSearchResults(
  query: string,
  addonsReady: boolean,
  topMatch: SearchResults["topMatch"],
): boolean {
  return (
    !isNativeSearchQuery(query) ||
    addonsReady ||
    (!!topMatch?.meta.addonOrigin &&
      normalizeSearchQuery(topMatch.meta.name) === normalizeSearchQuery(query))
  );
}

export function combineSearchResults(
  base: SearchResults,
  addon: CatalogResults,
  cinemeta: CatalogResults,
  groups: AddonResultGroup[],
): SearchResults {
  const query = normalizeSearchQuery(base.query);
  const nativeQuery = isNativeSearchQuery(query);
  const groupMetas = groups.flatMap((group) => group.metas);
  const all = [
    ...base.movies,
    ...base.series,
    ...(base.topMatch ? [base.topMatch.meta] : []),
    ...addon.movies,
    ...addon.series,
    ...cinemeta.movies,
    ...cinemeta.series,
    ...groupMetas,
  ];
  const identity = identityResolver(all);
  const confirmed = new Set(
    [
      ...base.movies,
      ...base.series,
      ...(base.topMatch ? [base.topMatch.meta] : []),
      ...addon.movies,
      ...addon.series,
      ...groupMetas,
    ]
      .filter((meta) => !fromCinemeta(meta))
      .map(identity),
  );
  const titleScore = (meta: Meta): number => {
    if (!query) return 0;
    const title = normalizeSearchQuery(meta.name);
    return title === query ? 2 : title.includes(query) ? 1 : 0;
  };
  const relevantCinemeta = (meta: Meta) =>
    !nativeQuery || titleScore(meta) > 0 || confirmed.has(identity(meta));
  const relevantAddon = (meta: Meta) => !fromCinemeta(meta) || relevantCinemeta(meta);
  const candidates = [
    ...addon.movies,
    ...addon.series,
    ...groupMetas,
    ...(!base.topMatch ? [...cinemeta.movies, ...cinemeta.series].filter(relevantCinemeta) : []),
  ]
    .filter(
      (meta) =>
        (meta.type === "movie" || meta.type === "series") &&
        !meta.isCollection &&
        relevantAddon(meta),
    )
    .sort((a, b) => titleScore(b) - titleScore(a));
  // English title searches retain the ordinary English match. Native title
  // searches prefer an installed addon's matching metadata, regardless of brand.
  const candidate = candidates.find((meta) => titleScore(meta) > 0);
  const baseScore = base.topMatch ? titleScore(base.topMatch.meta) : 0;
  const preferred =
    candidate &&
    (!base.topMatch ||
      titleScore(candidate) > baseScore ||
      (nativeQuery && titleScore(candidate) === baseScore))
      ? candidate
      : undefined;
  const topMatch = preferred
    ? {
        kind: preferred.type as "movie" | "series",
        meta: preferred,
        popularity: 0,
        backdrop: preferred.background,
        overview: preferred.description,
      }
    : base.topMatch;
  const unique = (metas: Meta[]): Meta[] => {
    const seen = new Set<string>();
    return metas
      .filter((meta) => {
        const key = identity(meta);
        if (!meta.id || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 20);
  };
  const rows = (type: "movie" | "series", primary: Meta[], extra: Meta[], cine: Meta[]) => {
    const ranked = [
      ...primary,
      ...extra.filter(relevantAddon),
      ...cine.filter(relevantCinemeta),
    ].sort((a, b) => titleScore(b) - titleScore(a));
    return unique([...(topMatch?.kind === type ? [topMatch.meta] : []), ...ranked]);
  };
  const movies = rows("movie", base.movies, addon.movies, cinemeta.movies);
  const series = rows("series", base.series, addon.series, cinemeta.series);
  const shown = new Set([...movies, ...series].map(identity));
  return {
    ...base,
    topMatch,
    movies,
    series,
    addonGroups: groups
      .map((group) => ({
        ...group,
        metas: group.metas.filter((meta) => relevantAddon(meta) && !shown.has(identity(meta))),
      }))
      .filter((group) => group.metas.length > 0),
  };
}
