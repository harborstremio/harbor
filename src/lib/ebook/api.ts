import { anilistRequest } from "@/lib/anilist/client";
import { animeRelations } from "@/lib/anilist/relations";
import { getUiLanguage } from "@/lib/i18n";
import { safeFetch } from "@/lib/safe-fetch";
import { setItemWithRecovery } from "@/lib/storage-recovery";

export type EBook = {
  id: string;
  source: "anilist" | "googlebooks" | "openlibrary" | "wikidata" | "source";
  providerId?: string;
  sourceItemId?: string;
  providerName?: string;
  anilistId?: number;
  googleBooksId?: string;
  openLibraryId?: string;
  wikidataId?: string;
  isbn?: string;
  seriesTitle?: string;
  /** Alternative titles explicitly supplied by the installed source. */
  sourceAliases?: string[];
  /** Titles obtained from a metadata result that passed Harbor's verification checks. */
  verifiedAliases?: string[];
  /** Stable identifiers explicitly supplied by the installed source. */
  sourceIdentity?: {
    anilistId?: number;
    googleBooksId?: string;
    openLibraryId?: string;
    wikidataId?: string;
    isbn?: string;
  };
  books?: EBook[];
  title: string;
  altTitle?: string;
  authors: string[];
  cover?: string;
  internalCover?: string;
  banner?: string;
  description: string;
  year?: number;
  publishedAt?: string;
  status?: string;
  originalLanguage?: string;
  genres: string[];
  chapters?: number;
  volumes?: number;
  score?: number;
  trendingScore?: number;
  siteUrl?: string;
};

export const EBOOK_CATEGORIES = {
  Fiction: [
    "Novel",
    "Novella",
    "Short story",
    "Fantasy",
    "Science fiction",
    "Romance",
    "Mystery / Detective",
    "Thriller / Suspense",
    "Horror",
    "Historical fiction",
    "Adventure",
    "Literary fiction",
    "Young Adult (YA)",
  ],
  "Non-fiction": [
    "Self-help / Personal development",
    "Psychology",
    "Philosophy",
    "Biography / Autobiography / Memoir",
    "History",
    "Business & Finance",
    "Science",
    "Technology",
    "Health & Fitness",
    "Politics & Society",
    "True crime",
    "Travel",
    "Education / Textbooks",
    "Reference / Guides",
    "Essays",
    "Religion & Spirituality",
    "Cookbooks",
  ],
} as const;

export type EBookCategoryGroup = keyof typeof EBOOK_CATEGORIES;

export type EBookAdaptationKind = "manga" | "anime" | "liveAction";

export type EBookAdaptation = {
  id: string;
  kind: EBookAdaptationKind;
  title: string;
  altTitles?: string[];
  source: "anilist" | "wikidata" | "mangadex" | "metadata";
  anilistId?: number;
  wikidataId?: string;
  poster?: string;
  year?: number;
  format?: string;
  relation?: string;
  description?: string;
  siteUrl?: string;
  seasons?: number;
};

export type EBookAdaptations = {
  manga: EBookAdaptation[];
  anime: EBookAdaptation[];
  liveAction: EBookAdaptation[];
};

export type RawEBook = {
  id: number;
  title: { english: string | null; romaji: string | null; native: string | null };
  coverImage: { extraLarge: string | null; large: string | null } | null;
  bannerImage: string | null;
  description: string | null;
  startDate: { year: number | null; month?: number | null; day?: number | null } | null;
  status: string | null;
  genres: string[];
  chapters: number | null;
  volumes: number | null;
  averageScore: number | null;
  countryOfOrigin?: string | null;
  siteUrl: string | null;
  synonyms?: string[];
  staff?: { edges: Array<{ role: string; node: { name: { full: string } } }> };
};

const FIELDS = `
  id
  title { english romaji native }
  coverImage { extraLarge large }
  bannerImage
  description(asHtml: false)
  startDate { year month day }
  status
  genres
  chapters
  volumes
  averageScore
  countryOfOrigin
  siteUrl
  synonyms
  staff(perPage: 10, sort: RELEVANCE) { edges { role node { name { full } } } }
`;

const BROWSE = `query ($page: Int, $sort: [MediaSort], $search: String) {
  Page(page: $page, perPage: 24) {
    media(type: MANGA, format: NOVEL, sort: $sort, search: $search, isAdult: false) { ${FIELDS} }
  }
}`;

const DETAIL = `query ($id: Int) { Media(id: $id, type: MANGA, format: NOVEL) { ${FIELDS} } }`;
const NEW_RELEASES = `query ($before: FuzzyDateInt) {
  Page(page: 1, perPage: 24) {
    media(type: MANGA, format: NOVEL, sort: START_DATE_DESC, startDate_lesser: $before, isAdult: false) { ${FIELDS} }
  }
}`;
const anilistMetadata = new Map<string, EBook | null>();
const anilistIds = new Map<string, EBook | null>();

function titleKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function identityTitleKey(value: string): string {
  return titleKey(value)
    .replace(/\b(?:a|an|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataKey(value: string): string {
  return `${getUiLanguage()}:${titleKey(value)}`;
}

function lookupTitle(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, "-")
    .trim();
}

function metadataLookups(ebooks: EBook[]): Array<{ query: string; owner: string }> {
  return ebooks.flatMap((ebook) => {
    const owner = ebook.seriesTitle || ebook.title;
    let slug = "";
    try {
      slug =
        decodeURIComponent(ebook.sourceItemId ?? "")
          .split("/")
          .filter(Boolean)
          .at(-1)
          ?.replace(/[-_]+/g, " ") ?? "";
    } catch {}
    return [...new Set([owner, ...(ebook.altTitle?.split("|") ?? []), slug])]
      .map((query) => query && lookupTitle(query))
      .filter((query): query is string => !!query)
      .map((query) => ({ query, owner }));
  });
}

function metadataCandidates(ebook: EBook): string[] {
  const candidates = metadataLookups([ebook]).map(({ query }) => query);
  return [
    ...new Set([
      ...candidates,
      ...candidates.map((title) =>
        title
          .replace(/\b(?:a|an|the)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim(),
      ),
    ]),
  ].filter(Boolean);
}

function authorListsMatch(left: string[], right: string[]): boolean {
  return left.some((a) =>
    right.some((b) => {
      const x = titleKey(a);
      const y = titleKey(b);
      const tokenKey = (value: string) => value.split(" ").filter(Boolean).sort().join(" ");
      return (
        x === y ||
        tokenKey(x) === tokenKey(y) ||
        (x.length > 4 && y.length > 4 && (x.includes(y) || y.includes(x)))
      );
    }),
  );
}

function explicitMetadataMatch(source: EBook, metadata: EBook): boolean {
  return !!(
    (source.anilistId && source.anilistId === metadata.anilistId) ||
    (source.googleBooksId && source.googleBooksId === metadata.googleBooksId) ||
    (source.openLibraryId && source.openLibraryId === metadata.openLibraryId) ||
    (source.wikidataId && source.wikidataId === metadata.wikidataId) ||
    (source.isbn && source.isbn === metadata.isbn)
  );
}

function verifiedMetadataMatch(source: EBook, metadata: EBook): boolean {
  if (explicitMetadataMatch(source, metadata)) return true;
  const sourceTitles = new Set(metadataCandidates(source).map(identityTitleKey));
  const metadataTitles = [metadata.title, ...(metadata.altTitle?.split("|") ?? [])].map(
    identityTitleKey,
  );
  if (!metadataTitles.some((title) => sourceTitles.has(title))) return false;
  if (metadata.source === "anilist")
    return (
      source.authors.length > 0 &&
      metadata.authors.length > 0 &&
      authorListsMatch(source.authors, metadata.authors)
    );
  if (metadata.source === "wikidata") {
    if (
      !/\b(?:(?:web|light)\s+)?novel\b|\b(?:book|novel) series\b|\bliterary work\b/i.test(
        metadata.description,
      )
    )
      return false;
    return (
      !source.authors.length ||
      !metadata.authors.length ||
      authorListsMatch(source.authors, metadata.authors)
    );
  }
  if (!source.authors.length || !metadata.authors.length) {
    if (source.year && metadata.year && Math.abs(source.year - metadata.year) > 1) return false;
    return true;
  }
  return authorListsMatch(source.authors, metadata.authors);
}

function metadataRequestKey(ebook: EBook): string {
  const owner = ebook.seriesTitle || ebook.title;
  return [
    metadataKey(owner),
    ebook.anilistId,
    ebook.googleBooksId,
    ebook.openLibraryId,
    ebook.wikidataId,
    ebook.isbn,
    ebook.source === "source" ? ebook.providerId : undefined,
    ebook.source === "source" ? ebook.sourceItemId : undefined,
    ...ebook.authors.map(titleKey).sort(),
    ...metadataCandidates(ebook).map(titleKey),
  ].join(":");
}

type EBookMetadataCacheRecord = { at: number; metadata: EBook[] };

const EBOOK_METADATA_CACHE_KEY = "harbor.ebook.metadata.v1";
const EBOOK_METADATA_FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const EBOOK_METADATA_NEGATIVE_MS = 30 * 60 * 1000;
const EBOOK_METADATA_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const EBOOK_METADATA_CACHE_LIMIT = 160;
const metadataCache = new Map<string, EBookMetadataCacheRecord>();
const metadataInflight = new Map<string, Promise<EBook[]>>();
let metadataCacheLoaded = false;
let metadataCacheFlushTimer: ReturnType<typeof setTimeout> | null = null;

function loadMetadataCache(): void {
  if (metadataCacheLoaded) return;
  metadataCacheLoaded = true;
  try {
    const stored = JSON.parse(localStorage.getItem(EBOOK_METADATA_CACHE_KEY) ?? "{}") as Record<
      string,
      EBookMetadataCacheRecord
    >;
    const now = Date.now();
    for (const [key, record] of Object.entries(stored)) {
      if (
        record &&
        typeof record.at === "number" &&
        Array.isArray(record.metadata) &&
        now - record.at < EBOOK_METADATA_STALE_MS
      )
        metadataCache.set(key, record);
    }
  } catch {}
}

function flushMetadataCache(): void {
  metadataCacheFlushTimer = null;
  const entries = [...metadataCache.entries()]
    .filter(([, record]) => Date.now() - record.at < EBOOK_METADATA_STALE_MS)
    .sort((left, right) => right[1].at - left[1].at)
    .slice(0, EBOOK_METADATA_CACHE_LIMIT);
  metadataCache.clear();
  for (const [key, record] of entries) metadataCache.set(key, record);
  try {
    setItemWithRecovery(EBOOK_METADATA_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {}
}

function scheduleMetadataCacheFlush(): void {
  if (metadataCacheFlushTimer != null) return;
  metadataCacheFlushTimer = setTimeout(flushMetadataCache, 500);
}

function clearMetadataCache(): void {
  metadataCache.clear();
  metadataCacheLoaded = true;
  if (metadataCacheFlushTimer != null) clearTimeout(metadataCacheFlushTimer);
  metadataCacheFlushTimer = null;
  try {
    localStorage.removeItem(EBOOK_METADATA_CACHE_KEY);
  } catch {}
}

function cachedMetadataRecord(ebook: EBook): EBookMetadataCacheRecord | null {
  loadMetadataCache();
  const key = metadataRequestKey(ebook);
  const record = metadataCache.get(key);
  if (!record || Date.now() - record.at >= EBOOK_METADATA_STALE_MS) {
    if (record) metadataCache.delete(key);
    return null;
  }
  const metadata = record.metadata.filter((candidate) => verifiedMetadataMatch(ebook, candidate));
  return metadata.length === record.metadata.length ? record : { ...record, metadata };
}

function hasFreshMetadata(ebook: EBook): boolean {
  const record = cachedMetadataRecord(ebook);
  if (!record) return false;
  const ttl = record.metadata.length ? EBOOK_METADATA_FRESH_MS : EBOOK_METADATA_NEGATIVE_MS;
  return Date.now() - record.at < ttl;
}

function cachedMetadata(ebooks: EBook[]): EBook[] {
  return combineMetadata(
    ebooks.flatMap((ebook) => cachedMetadataRecord(ebook)?.metadata ?? []),
  );
}

function combineMetadata(...groups: EBook[][]): EBook[] {
  const unique = new Map<string, EBook>();
  for (const ebook of groups.flat()) {
    const key = [
      ebook.source,
      ebook.anilistId,
      ebook.googleBooksId,
      ebook.openLibraryId,
      ebook.wikidataId,
      ebook.isbn,
      titleKey(ebook.seriesTitle || ebook.title),
    ].join(":");
    unique.set(key, ebook);
  }
  return [...unique.values()];
}

function cacheMetadataForSources(sources: EBook[], metadata: EBook[], complete = false): void {
  loadMetadataCache();
  for (const source of sources) {
    const key = metadataRequestKey(source);
    const matches = metadata.filter((candidate) => verifiedMetadataMatch(source, candidate));
    if (!matches.length && !complete) continue;
    const previous = complete ? [] : (metadataCache.get(key)?.metadata ?? []);
    metadataCache.delete(key);
    metadataCache.set(key, {
      at: Date.now(),
      metadata: combineMetadata(previous, matches),
    });
  }
  scheduleMetadataCacheFlush();
}

function clean(text: string | null): string {
  return (text ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function fuzzyDate(value: RawEBook["startDate"]): string | undefined {
  if (!value?.year) return undefined;
  if (!value.month) return String(value.year);
  if (!value.day) return `${value.year}-${String(value.month).padStart(2, "0")}`;
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

export function mapEBook(n: RawEBook): EBook {
  const language = getUiLanguage();
  const localized =
    language === "ar"
      ? n.synonyms?.find((title) => /\p{Script=Arabic}/u.test(title))
      : language === "ru"
        ? n.synonyms?.find((title) => /\p{Script=Cyrillic}/u.test(title))
        : undefined;
  return {
    id: `anilist:${n.id}`,
    source: "anilist",
    anilistId: n.id,
    title:
      localized?.trim() ||
      n.title.english?.trim() ||
      n.title.romaji?.trim() ||
      n.title.native?.trim() ||
      "Untitled",
    altTitle: n.title.romaji ?? n.title.native ?? undefined,
    authors:
      n.staff?.edges
        .filter((edge) => /story|original creator|writer|author/i.test(edge.role))
        .map((edge) => edge.node.name.full) ?? [],
    cover: n.coverImage?.extraLarge ?? n.coverImage?.large ?? undefined,
    banner: n.bannerImage ?? undefined,
    description: clean(n.description),
    year: n.startDate?.year ?? undefined,
    publishedAt: fuzzyDate(n.startDate),
    status: n.status?.replaceAll("_", " ").toLowerCase(),
    originalLanguage: n.countryOfOrigin ?? undefined,
    genres: n.genres ?? [],
    chapters: n.chapters ?? undefined,
    volumes: n.volumes ?? undefined,
    score: n.averageScore ?? undefined,
    siteUrl: n.siteUrl ?? undefined,
  };
}

export async function browseEBooks(sort: string, page = 1, search?: string): Promise<EBook[]> {
  const data = await anilistRequest<{ Page: { media: RawEBook[] } | null }>(
    BROWSE,
    { page, sort: [sort], search: search?.trim() || undefined },
    undefined,
    true,
  );
  return (data.Page?.media ?? []).map(mapEBook);
}

export async function browseNewReleases(): Promise<EBook[]> {
  const before = Number(new Date().toISOString().slice(0, 10).replaceAll("-", "")) + 1;
  const data = await anilistRequest<{ Page: { media: RawEBook[] } | null }>(
    NEW_RELEASES,
    { before },
    undefined,
    true,
  );
  return (data.Page?.media ?? []).map(mapEBook);
}

export async function recommendedEBooks(ebook: EBook): Promise<EBook[]> {
  if (!ebook.genres.length) {
    const metadata = await fetchEBookMetadata([ebook]).catch(() => []);
    ebook = mergeEBookMetadata([ebook], metadata)[0] ?? ebook;
  }
  const normalizeGenre = (genre: string) =>
    genre
      .normalize("NFKD")
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const categoryGenres = [
    ...Object.keys(EBOOK_CATEGORIES),
    ...Object.values(EBOOK_CATEGORIES).flat(),
  ];
  const recommendationGenres = [
    ...new Set([
      ...ebook.genres,
      ...categoryGenres.filter((category) => {
        const normalizedCategory = normalizeGenre(category);
        return ebook.genres.some((genre) => {
          const normalizedGenre = normalizeGenre(genre);
          if (!normalizedGenre) return false;
          return (
            normalizedGenre === normalizedCategory ||
            normalizedGenre.includes(normalizedCategory) ||
            normalizedCategory.includes(normalizedGenre)
          );
        });
      }),
    ]),
  ];
  const currentGenres = recommendationGenres.map(normalizeGenre).filter(Boolean);
  const genreOverlap = (candidate: EBook) => {
    const candidateGenres = candidate.genres.map(normalizeGenre).filter(Boolean);
    return currentGenres.reduce(
      (score, wanted) =>
        score +
        (candidateGenres.some(
          (genre) => genre === wanted || genre.includes(wanted) || wanted.includes(genre),
        )
          ? 1
          : 0),
      0,
    );
  };
  const rankByGenre = (items: EBook[]) =>
    items
      .filter((item) => item.id !== ebook.id && item.title !== ebook.title)
      .map((item) => ({ item, overlap: genreOverlap(item) }))
      .filter(({ overlap }) => overlap > 0)
      .sort(
        (left, right) =>
          right.overlap - left.overlap || (right.item.score ?? 0) - (left.item.score ?? 0),
      )
      .map(({ item }) => item);
  const uniqueRecommendations = (items: EBook[]) => [
    ...new Map(
      items
        .filter((item) => item.id !== ebook.id && titleKey(item.title) !== titleKey(ebook.title))
        .map((item) => [titleKey(item.seriesTitle || item.title), item]),
    ).values(),
  ];

  if (!currentGenres.length) {
    const metadataQuery = ebook.authors[0] || ebook.seriesTitle || ebook.title;
    const metadataMatches = await searchEBooks(metadataQuery).catch(() => []);
    const relatedMetadata = uniqueRecommendations(metadataMatches).slice(0, 18);
    if (relatedMetadata.length) return relatedMetadata;
    return uniqueRecommendations(await browsePopularEBooks().catch(() => [])).slice(0, 18);
  }

  const genreCandidates: Array<Promise<EBook[]>> = [];
  if (ebook.anilistId) {
    genreCandidates.push(
      anilistRequest<{
        Media: {
          recommendations: {
            nodes: Array<{ mediaRecommendation: (RawEBook & { format?: string }) | null }>;
          };
        } | null;
      }>(
        `query ($id: Int) {
          Media(id: $id, type: MANGA, format: NOVEL) {
            recommendations(perPage: 18, sort: RATING_DESC) {
              nodes { mediaRecommendation { ${FIELDS} format } }
            }
          }
        }`,
        { id: ebook.anilistId },
        undefined,
        true,
      )
        .then((data) =>
          rankByGenre(
            (data.Media?.recommendations.nodes ?? [])
              .map((node) => node.mediaRecommendation)
              .filter(
                (item): item is RawEBook & { format?: string } => !!item && item.format === "NOVEL",
              )
              .map(mapEBook),
          ),
        )
        .catch(() => []),
    );
  }
  const genres = recommendationGenres.slice(0, 3);
  genreCandidates.push(
    anilistRequest<{ Page: { media: RawEBook[] } | null }>(
      genres.length
        ? `query ($genres: [String]) {
          Page(page: 1, perPage: 18) {
            media(type: MANGA, format: NOVEL, genre_in: $genres, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} }
          }
        }`
        : `query {
          Page(page: 1, perPage: 18) {
            media(type: MANGA, format: NOVEL, sort: POPULARITY_DESC, isAdult: false) { ${FIELDS} }
          }
        }`,
      genres.length ? { genres } : undefined,
      undefined,
      true,
    )
      .then((data) => rankByGenre((data.Page?.media ?? []).map(mapEBook)))
      .catch(() => []),
  );

  genreCandidates.push(
    ...recommendationGenres.slice(0, 5).map((genre) =>
      browseEBookCategory(genre)
        .then((items) => {
          const books = uniqueRecommendations(items);
          const ranked = rankByGenre(books);
          return ranked.length ? ranked : books;
        })
        .catch(() => []),
    ),
  );

  // Start the general metadata fallback now, but only use it if every
  // genre-specific provider returns no books. This removes the request waterfall.
  const popularMetadataPromise = browsePopularEBooks()
    .then(uniqueRecommendations)
    .catch(() => []);
  try {
    return await Promise.any(
      genreCandidates.map(async (request) => {
        const items = await request;
        if (!items.length) throw new Error("Empty recommendation result");
        return items.slice(0, 18);
      }),
    );
  } catch {}

  const popularMetadata = await popularMetadataPromise;
  const rankedPopularMetadata = rankByGenre(popularMetadata);
  if (rankedPopularMetadata.length) return rankedPopularMetadata;
  if (popularMetadata.length) return popularMetadata.slice(0, 18);
  throw new Error("Recommendation providers are temporarily unavailable");
}

export async function fetchAniListEBookMetadata(ebooks: EBook[]): Promise<EBook[]> {
  const direct = [
    ...new Map(
      ebooks.filter((ebook) => ebook.anilistId).map((ebook) => [ebook.anilistId!, ebook]),
    ).values(),
  ];
  const missingIds = direct.filter(
    (ebook) => !anilistIds.has(`${getUiLanguage()}:${ebook.anilistId}`),
  );
  for (let start = 0; start < missingIds.length; start += 12) {
    const batch = missingIds.slice(start, start + 12);
    const variables = Object.fromEntries(
      batch.map((ebook, index) => [`id${index}`, ebook.anilistId]),
    );
    const query = `query (${batch.map((_, index) => `$id${index}: Int`).join(", ")}) {
      ${batch.map((_, index) => `m${index}: Media(id: $id${index}, type: MANGA, format: NOVEL) { ${FIELDS} }`).join("\n")}
    }`;
    const data = await anilistRequest<Record<string, RawEBook | null>>(
      query,
      variables,
      undefined,
      true,
    ).catch((): Record<string, RawEBook | null> => ({}));
    batch.forEach((ebook, index) => {
      const field = `m${index}`;
      if (Object.hasOwn(data, field)) {
        const raw = data[field];
        anilistIds.set(`${getUiLanguage()}:${ebook.anilistId}`, raw ? mapEBook(raw) : null);
      }
    });
  }
  const lookups = metadataLookups(ebooks);
  const titles = [...new Set(lookups.map(({ query }) => query))];
  const missing = titles.filter((title) => !anilistMetadata.has(metadataKey(title)));
  for (let start = 0; start < missing.length; start += 6) {
    const batch = missing.slice(start, start + 6);
    const variables = Object.fromEntries(batch.map((title, index) => [`q${index}`, title]));
    const query = `query (${batch.map((_, index) => `$q${index}: String`).join(", ")}) {
      ${batch
        .map(
          (_, index) =>
            `m${index}: Page(page: 1, perPage: 3) { media(search: $q${index}, type: MANGA, format: NOVEL, isAdult: false) { ${FIELDS} } }`,
        )
        .join("\n")}
    }`;
    const data = await anilistRequest<Record<string, { media: RawEBook[] } | null>>(
      query,
      variables,
      undefined,
      true,
    ).catch((): Record<string, { media: RawEBook[] } | null> => ({}));
    if (!Object.keys(data).length) continue;
    batch.forEach((title, index) => {
      const key = titleKey(title);
      const raw = data[`m${index}`]?.media.find((item) =>
        [item.title.english, item.title.romaji, item.title.native, ...(item.synonyms ?? [])].some(
          (candidate) => candidate && titleKey(candidate) === key,
        ),
      );
      anilistMetadata.set(metadataKey(title), raw ? mapEBook(raw) : null);
    });
  }
  const matches = new Map<string, EBook>();
  for (const ebook of direct) {
    const match = anilistIds.get(`${getUiLanguage()}:${ebook.anilistId}`);
    if (match)
      matches.set(titleKey(ebook.seriesTitle || ebook.title), {
        ...match,
        seriesTitle: ebook.seriesTitle || ebook.title,
      });
  }
  for (const { query, owner } of lookups) {
    const match = anilistMetadata.get(metadataKey(query));
    if (match && !matches.has(titleKey(owner)))
      matches.set(titleKey(owner), { ...match, seriesTitle: owner });
  }
  return [...matches.values()];
}

type OpenLibraryDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_publish_year?: number;
  isbn?: string[];
  series?: string[];
  subject?: string[];
  alternative_title?: string | string[];
  first_sentence?: string | string[];
};

const OPEN_LIBRARY_FIELDS =
  "key,title,alternative_title,author_name,cover_i,first_publish_year,isbn,series,subject,first_sentence";
const OPEN_LIBRARY_CACHE_MS = 7 * 24 * 60 * 60 * 1000;
const OPEN_LIBRARY_STALE_MS = 30 * 24 * 60 * 60 * 1000;
const openLibraryMetadata = new Map<string, EBook | null>();
const openLibraryAliases = new Map<string, string[]>();
const jsonInflight = new Map<string, Promise<unknown>>();

type CachedJsonValue<T> = { at: number; value: T };

async function cachedJson<T>(url: string, timeoutMs = 8_000): Promise<T> {
  const cacheUrl = new URL(url);
  const authenticated = cacheUrl.searchParams.has("key");
  cacheUrl.searchParams.delete("key");
  const key = `harbor.ebook.openlibrary.v1.${authenticated ? "authenticated" : "anonymous"}.${cacheUrl}`;
  let cached: CachedJsonValue<T> | null = null;
  try {
    cached = JSON.parse(localStorage.getItem(key) ?? "null") as CachedJsonValue<T> | null;
    if (cached && Date.now() - cached.at < OPEN_LIBRARY_CACHE_MS) return cached.value;
  } catch {}
  const existing = jsonInflight.get(key) as Promise<T> | undefined;
  const request =
    existing ??
    (async () => {
      const response = await safeFetch(url, {
        signal: AbortSignal.timeout(timeoutMs),
        headers:
          cacheUrl.hostname === "query.wikidata.org"
            ? {
                Accept: "application/sparql-results+json",
                "User-Agent": "Harbor (eBook metadata)",
              }
            : undefined,
      });
      if (!response.ok) throw new Error(`eBook metadata HTTP ${response.status}`);
      const value = (await response.json()) as T;
      try {
        setItemWithRecovery(key, JSON.stringify({ at: Date.now(), value }));
      } catch {}
      return value;
    })().finally(() => jsonInflight.delete(key));
  if (!existing) jsonInflight.set(key, request);
  if (cached && Date.now() - cached.at < OPEN_LIBRARY_STALE_MS) {
    void request.catch(() => undefined);
    return cached.value;
  }
  try {
    return await request;
  } catch (error) {
    if (cached) return cached.value;
    throw error;
  }
}

type GoogleBook = {
  id: string;
  volumeInfo: {
    title: string;
    subtitle?: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
    categories?: string[];
    averageRating?: number;
    imageLinks?: Record<string, string>;
    infoLink?: string;
    seriesInfo?: {
      bookDisplayNumber?: string;
      volumeSeries?: Array<{ seriesId?: string; orderNumber?: number }>;
    };
  };
};

const googleMetadata = new Map<string, EBook | null>();
const googleSeriesIds = new Map<string, string>();
const GOOGLE_BOOKS_KEY = "harbor.ebook.google-books-key";
let googleUnavailableUntil = 0;
let googleQueue = Promise.resolve();

export function googleBooksApiKey(): string {
  return localStorage.getItem(GOOGLE_BOOKS_KEY)?.trim() ?? "";
}

export function setGoogleBooksApiKey(value: string): void {
  const trimmed = value.trim();
  if (trimmed) localStorage.setItem(GOOGLE_BOOKS_KEY, trimmed);
  else localStorage.removeItem(GOOGLE_BOOKS_KEY);
  googleMetadata.clear();
  googleSeriesIds.clear();
  clearMetadataCache();
  googleUnavailableUntil = 0;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("harbor.ebook.openlibrary.v1.") && key.includes("www.googleapis.com"))
      localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event("harbor:ebook-metadata"));
}

export async function validateGoogleBooksApiKey(value: string): Promise<void> {
  const key = value.trim();
  if (!key) return;
  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  url.searchParams.set("q", "intitle:Harbor");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("key", key);
  const response = await safeFetch(url.toString(), { signal: AbortSignal.timeout(10_000) });
  if (response.ok) return;
  let message = "Google Books rejected this API key.";
  try {
    const data = (await response.json()) as { error?: { message?: string } };
    if (data.error?.message) message = data.error.message;
  } catch {}
  throw new Error(message);
}

function mapGoogleBook(book: GoogleBook): EBook {
  const info = book.volumeInfo;
  const isbn =
    info.industryIdentifiers?.find(({ type }) => type === "ISBN_13")?.identifier ??
    info.industryIdentifiers?.find(({ type }) => type === "ISBN_10")?.identifier;
  const cover =
    info.imageLinks?.extraLarge ??
    info.imageLinks?.large ??
    info.imageLinks?.medium ??
    info.imageLinks?.thumbnail ??
    info.imageLinks?.smallThumbnail;
  return {
    id: `googlebooks:${book.id}`,
    source: "googlebooks",
    googleBooksId: book.id,
    isbn,
    title: info.title,
    altTitle: info.subtitle,
    authors: info.authors ?? [],
    cover: cover?.replace(/^http:/, "https:"),
    description: clean(info.description ?? null),
    year: Number(info.publishedDate?.match(/\d{4}/)?.[0]) || undefined,
    publishedAt: info.publishedDate,
    genres: info.categories ?? [],
    score: info.averageRating ? info.averageRating * 20 : undefined,
    siteUrl: info.infoLink,
  };
}

async function fetchGoogleMetadata(
  ebooks: EBook[],
  onPartial?: (metadata: EBook[]) => void,
): Promise<EBook[]> {
  const apiKey = googleBooksApiKey();
  if (!apiKey && Date.now() < googleUnavailableUntil) return [];
  const current = () =>
    ebooks.flatMap((ebook) => {
      const match = googleMetadata.get(metadataRequestKey(ebook));
      return match ? [match] : [];
    });
  const resolve = async (ebook: EBook) => {
    const owner = ebook.seriesTitle || ebook.title;
    const key = metadataRequestKey(ebook);
    if (googleMetadata.has(key)) return;
    const candidates = metadataCandidates(ebook);
    let exact: GoogleBook | undefined;
    let failed = false;
    for (const candidate of candidates) {
      const url = new URL(
        ebook.googleBooksId
          ? `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(ebook.googleBooksId)}`
          : "https://www.googleapis.com/books/v1/volumes",
      );
      if (!ebook.googleBooksId)
        url.searchParams.set(
          "q",
          ebook.isbn ? `isbn:${ebook.isbn}` : `intitle:"${lookupTitle(candidate)}"`,
        );
      if (!ebook.googleBooksId) url.searchParams.set("maxResults", "5");
      if (!ebook.googleBooksId) url.searchParams.set("langRestrict", getUiLanguage());
      if (apiKey) url.searchParams.set("key", apiKey);
      const data = await cachedJson<GoogleBook | { items?: GoogleBook[] }>(url.toString()).catch(
        (error) => {
          failed = true;
          if (!apiKey && String(error).includes("HTTP 429"))
            googleUnavailableUntil = Date.now() + 10 * 60_000;
          return null;
        },
      );
      if (!data) break;
      const books = "volumeInfo" in data ? [data] : (data.items ?? []);
      exact =
        books.find((book) => book.id === ebook.googleBooksId) ??
        books.find((book) =>
          book.volumeInfo.industryIdentifiers?.some(
            ({ identifier }) => identifier.replace(/[^0-9X]/gi, "") === ebook.isbn,
          ),
        ) ??
        books.find(
          (book) =>
            [
              book.volumeInfo.title,
              `${book.volumeInfo.title}: ${book.volumeInfo.subtitle ?? ""}`,
            ].some((title) => titleKey(title) === titleKey(candidate)) &&
            (!ebook.authors.length ||
              !book.volumeInfo.authors?.length ||
              authorListsMatch(ebook.authors, book.volumeInfo.authors)),
        );
      if (exact && apiKey && !exact.volumeInfo.seriesInfo) {
        const detailUrl = new URL(
          `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(exact.id)}`,
        );
        detailUrl.searchParams.set("includeNonComicsSeries", "true");
        detailUrl.searchParams.set("key", apiKey);
        exact =
          (await cachedJson<GoogleBook>(detailUrl.toString()).catch(() => null)) ?? exact;
      }
      if (exact || ebook.googleBooksId || ebook.isbn) break;
    }
    const seriesId = exact?.volumeInfo.seriesInfo?.volumeSeries?.[0]?.seriesId;
    if (seriesId) googleSeriesIds.set(key, seriesId);
    if (!failed)
      googleMetadata.set(key, exact ? { ...mapGoogleBook(exact), seriesTitle: owner } : null);
    onPartial?.(current());
  };
  if (apiKey) await Promise.all(ebooks.map(resolve));
  else {
    const queued = googleQueue.then(async () => {
      for (const ebook of ebooks) {
        if (Date.now() < googleUnavailableUntil) break;
        await resolve(ebook);
      }
    });
    googleQueue = queued.catch(() => {});
    await queued;
  }
  return current();
}

type WikidataEntity = {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  aliases?: Record<string, Array<{ value: string }>>;
  claims?: Record<string, Array<{ mainsnak?: { datavalue?: { value?: unknown } } }>>;
  sitelinks?: Record<string, { title: string }>;
};

type WikipediaSummary = {
  extract?: string;
  thumbnail?: { source?: string };
  originalimage?: { source?: string };
};

const wikidataMetadata = new Map<string, EBook | null>();

type WikidataBinding = {
  item: { value: string };
  matched: { value: string };
  itemDescription?: { value: string };
};

function wikidataLanguage(value: string): string {
  if (/\p{Script=Arabic}/u.test(value)) return "ar";
  if (/\p{Script=Cyrillic}/u.test(value)) return "ru";
  if (/\p{Script=Han}/u.test(value)) return "zh";
  return "en";
}

function sparqlString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, " ");
}

function claim(entity: WikidataEntity, property: string): unknown {
  return entity.claims?.[property]?.[0]?.mainsnak?.datavalue?.value;
}

function commonsImage(value: unknown): string | undefined {
  return typeof value === "string" && value
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(value)}?width=800`
    : undefined;
}

function creditedAuthors(description: string): string[] {
  const match = description.match(
    /\b(?:novel|series|work)\s+(?:written\s+)?by\s+(.+?)(?:\s+and\s+(?:illustrated|published|created)\s+by|[.;]|$)/i,
  );
  return match?.[1]
    ? match[1]
        .split(/\s*[/,]\s*|\s+and\s+/i)
        .map((author) => author.trim())
        .filter(Boolean)
    : [];
}

async function wikipediaSummary(entity: WikidataEntity): Promise<WikipediaSummary | null> {
  const language = getUiLanguage();
  const site = entity.sitelinks?.[`${language}wiki`] ? `${language}wiki` : "enwiki";
  const title = entity.sitelinks?.[site]?.title;
  if (!title) return null;
  return cachedJson<WikipediaSummary>(
    `https://${site.slice(0, -4)}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}`,
  ).catch(() => null);
}

function mapWikidata(entity: WikidataEntity, summary?: WikipediaSummary | null): EBook {
  const language = getUiLanguage();
  const labels = entity.labels ?? {};
  const aliases = Object.values(entity.aliases ?? {}).flatMap((values) =>
    values.map(({ value }) => value),
  );
  const date = claim(entity, "P577") as { time?: string } | undefined;
  const cover = claim(entity, "P18");
  const description =
    summary?.extract ??
    entity.descriptions?.[language]?.value ??
    entity.descriptions?.en?.value ??
    entity.descriptions?.ar?.value ??
    "";
  return {
    id: `wikidata:${entity.id}`,
    source: "wikidata",
    wikidataId: entity.id,
    googleBooksId: String(claim(entity, "P675") ?? "") || undefined,
    openLibraryId: String(claim(entity, "P648") ?? "") || undefined,
    isbn: String(claim(entity, "P212") ?? claim(entity, "P957") ?? "") || undefined,
    title:
      labels[language]?.value ??
      labels.en?.value ??
      labels.ar?.value ??
      labels.ja?.value ??
      entity.id,
    altTitle: aliases.length ? [...new Set(aliases)].join("|") : undefined,
    authors: creditedAuthors(description),
    cover: summary?.originalimage?.source ?? summary?.thumbnail?.source ?? commonsImage(cover),
    description,
    year: Number(date?.time?.match(/[+-](\d{4})/)?.[1]) || undefined,
    publishedAt: date?.time?.match(/[+-](\d{4}-\d{2}-\d{2})/)?.[1],
    genres: [],
    siteUrl: `https://www.wikidata.org/wiki/${entity.id}`,
  };
}

async function fetchWikidataMetadata(
  ebooks: EBook[],
  onPartial?: (metadata: EBook[]) => void,
): Promise<EBook[]> {
  const current = () =>
    ebooks.flatMap((ebook) => {
      const match = wikidataMetadata.get(metadataRequestKey(ebook));
      return match ? [match] : [];
    });
  const pending = ebooks.filter((ebook) => !wikidataMetadata.has(metadataRequestKey(ebook)));
  if (pending.length) {
    const owners = new Map<string, Set<string>>();
    for (const ebook of pending) {
      for (const candidate of metadataCandidates(ebook)) {
        const key = `${wikidataLanguage(candidate)}:${titleKey(candidate)}`;
        const values = owners.get(key) ?? new Set<string>();
        values.add(ebook.id);
        owners.set(key, values);
      }
    }
    const terms = [...owners.keys()];
    const ids = new Map<string, Set<string>>(
      pending.map((ebook) => [ebook.id, new Set(ebook.wikidataId ? [ebook.wikidataId] : [])]),
    );
    let complete = true;
    for (let start = 0; start < terms.length; start += 30) {
      const batch = terms.slice(start, start + 30);
      const values = batch
        .map((term) => {
          const split = term.indexOf(":");
          const language = term.slice(0, split);
          const title = metadataCandidates(
            pending.find((ebook) => owners.get(term)?.has(ebook.id))!,
          ).find((candidate) => titleKey(candidate) === term.slice(split + 1))!;
          return `"${sparqlString(title)}"@${language}`;
        })
        .join(" ");
      const query = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
SELECT DISTINCT ?matched ?item ?itemDescription WHERE {
  VALUES ?matched { ${values} }
  VALUES ?kind { wd:Q571 wd:Q8261 wd:Q277759 wd:Q1667921 wd:Q7725634 wd:Q47461344 }
  ?item (rdfs:label|skos:altLabel) ?matched.
  ?item wdt:P31 ?kind.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${getUiLanguage()},en,ar". }
}`;
      const url = new URL("https://query.wikidata.org/sparql");
      url.searchParams.set("query", query);
      url.searchParams.set("format", "json");
      const data = await cachedJson<{ results?: { bindings?: WikidataBinding[] } }>(
        url.toString(),
        30_000,
      ).catch(() => null);
      if (!data) {
        complete = false;
        continue;
      }
      for (const binding of data.results?.bindings ?? []) {
        if (
          !/\b(?:(?:web|light)\s+)?novel\b|\b(?:book|novel) series\b|\bliterary work\b/i.test(
            binding.itemDescription?.value ?? "",
          )
        )
          continue;
        const term = `${wikidataLanguage(binding.matched.value)}:${titleKey(binding.matched.value)}`;
        const id = binding.item.value.match(/Q\d+$/)?.[0];
        if (!id) continue;
        for (const owner of owners.get(term) ?? []) ids.get(owner)?.add(id);
      }
    }
    const entityIds = [...new Set([...ids.values()].flatMap((values) => [...values]))];
    const entities: Record<string, WikidataEntity> = {};
    for (let start = 0; start < entityIds.length; start += 50) {
      const url = new URL("https://www.wikidata.org/w/api.php");
      url.search = new URLSearchParams({
        action: "wbgetentities",
        ids: entityIds.slice(start, start + 50).join("|"),
        props: "labels|descriptions|aliases|claims|sitelinks",
        languages: [...new Set([getUiLanguage(), "en", "ar", "pt", "ru", "ja"])].join("|"),
        sitefilter: [...new Set([`${getUiLanguage()}wiki`, "enwiki", "arwiki"])].join("|"),
        format: "json",
        origin: "*",
        maxlag: "5",
      }).toString();
      const data = await cachedJson<{ entities?: Record<string, WikidataEntity> }>(
        url.toString(),
      ).catch(() => null);
      if (!data) complete = false;
      else Object.assign(entities, data.entities);
    }
    await Promise.all(
      pending.map(async (ebook) => {
        const owner = ebook.seriesTitle || ebook.title;
        const entity = [...(ids.get(ebook.id) ?? [])]
          .map((id) => entities[id])
          .find((candidate) => candidate && verifiedMetadataMatch(ebook, mapWikidata(candidate)));
        if (entity) {
          const summary = await wikipediaSummary(entity);
          wikidataMetadata.set(metadataRequestKey(ebook), {
            ...mapWikidata(entity, summary),
            seriesTitle: owner,
          });
        } else if (complete) wikidataMetadata.set(metadataRequestKey(ebook), null);
        onPartial?.(current());
      }),
    );
  }
  return current();
}

function mapOpenLibrary(n: OpenLibraryDoc): EBook {
  const key = n.key.replace(/^\/works\//, "");
  return {
    id: `openlibrary:${key}`,
    source: "openlibrary",
    openLibraryId: key,
    isbn: n.isbn?.[0],
    seriesTitle: n.series?.[0],
    title: n.title,
    authors: n.author_name ?? [],
    cover: n.cover_i ? `https://covers.openlibrary.org/b/id/${n.cover_i}-L.jpg` : undefined,
    description: Array.isArray(n.first_sentence)
      ? (n.first_sentence[0] ?? "")
      : (n.first_sentence ?? ""),
    year: n.first_publish_year,
    publishedAt: n.first_publish_year ? String(n.first_publish_year) : undefined,
    genres: n.subject?.slice(0, 8) ?? [],
    siteUrl: `https://openlibrary.org/works/${key}`,
  };
}

export type EBookCollection = {
  name: string;
  books: EBook[];
  kind?: "series" | "award";
};

async function googleBookCollections(
  ebooks: EBook[],
): Promise<Array<{ book: EBook; collection: EBookCollection }>> {
  const apiKey = googleBooksApiKey();
  if (!apiKey) return [];
  await fetchGoogleMetadata(ebooks).catch(() => []);
  const grouped = new Map<string, EBook[]>();
  for (const book of ebooks) {
    const seriesId = googleSeriesIds.get(metadataRequestKey(book));
    if (!seriesId) continue;
    const books = grouped.get(seriesId) ?? [];
    books.push(book);
    grouped.set(seriesId, books);
  }
  const results: Array<{ book: EBook; collection: EBookCollection }> = [];
  for (const [seriesId, owners] of grouped) {
    const seriesUrl = new URL("https://www.googleapis.com/books/v1/series/get");
    seriesUrl.searchParams.append("series_id", seriesId);
    seriesUrl.searchParams.set("key", apiKey);
    const membershipUrl = new URL(
      "https://www.googleapis.com/books/v1/series/membership/get",
    );
    membershipUrl.searchParams.set("series_id", seriesId);
    membershipUrl.searchParams.set("page_size", "50");
    membershipUrl.searchParams.set("key", apiKey);
    const [series, membership] = await Promise.all([
      cachedJson<{ series?: Array<{ title?: string }> }>(seriesUrl.toString()).catch(() => null),
      cachedJson<{ member?: GoogleBook[] }>(membershipUrl.toString()).catch(() => null),
    ]);
    const members = (membership?.member ?? []).map(mapGoogleBook);
    if (members.length < 2) continue;
    const name = series?.series?.[0]?.title ?? `${owners[0].title} Collection`;
    for (const owner of owners) {
      const books = members.filter(
        (member) =>
          member.googleBooksId !== owner.googleBooksId &&
          titleKey(member.title) !== titleKey(owner.title),
      );
      if (books.length) results.push({ book: owner, collection: { name, books, kind: "series" } });
    }
  }
  return results;
}

async function wikidataBookCollections(
  ebooks: EBook[],
): Promise<Array<{ book: EBook; collection: EBookCollection }>> {
  await fetchWikidataMetadata(ebooks).catch(() => []);
  const matched = ebooks.flatMap((book) => {
    const metadata = wikidataMetadata.get(metadataRequestKey(book));
    return metadata?.wikidataId ? [{ book, metadata }] : [];
  });
  if (!matched.length) return [];

  const seeds = [...new Set(matched.map(({ metadata }) => metadata.wikidataId!))];
  const query = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT DISTINCT ?seed ?item ?series ?seriesLabel ?ordinal ?kind WHERE {
  VALUES ?seed { ${seeds.map((id) => `wd:${id}`).join(" ")} }
  {
    ?seed wdt:P179 ?series.
    ?item wdt:P179 ?series.
    OPTIONAL { ?item p:P179 ?statement. ?statement ps:P179 ?series. ?statement pq:P1545 ?ordinal. }
    BIND("series" AS ?kind)
  }
  UNION
  {
    { ?seed (wdt:P155|wdt:P156) ?item. }
    UNION
    { ?item (wdt:P155|wdt:P156) ?seed. }
    BIND(?seed AS ?series)
    BIND("sequence" AS ?kind)
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,ar". }
}`;
  const url = new URL("https://query.wikidata.org/sparql");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  const data = await cachedJson<{
    results?: {
      bindings?: Array<{
        seed: { value: string };
        item: { value: string };
        series: { value: string };
        seriesLabel?: { value: string };
        ordinal?: { value: string };
        kind?: { value: string };
      }>;
    };
  }>(url.toString(), 30_000).catch(() => null);
  const bindings = data?.results?.bindings ?? [];
  if (!bindings.length) return [];

  const entityIds = [
    ...new Set(
      bindings.flatMap((binding) => [binding.item.value, binding.series.value]).flatMap((value) => {
        const id = value.match(/Q\d+$/)?.[0];
        return id ? [id] : [];
      }),
    ),
  ];
  const entities: Record<string, WikidataEntity> = {};
  for (let start = 0; start < entityIds.length; start += 50) {
    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.search = new URLSearchParams({
      action: "wbgetentities",
      ids: entityIds.slice(start, start + 50).join("|"),
      props: "labels|descriptions|aliases|claims|sitelinks",
      languages: [...new Set([getUiLanguage(), "en", "ar", "pt", "ru", "ja"])].join("|"),
      format: "json",
      origin: "*",
      maxlag: "5",
    }).toString();
    const page = await cachedJson<{ entities?: Record<string, WikidataEntity> }>(
      entityUrl.toString(),
    ).catch(() => null);
    Object.assign(entities, page?.entities ?? {});
  }

  return matched.flatMap(({ book, metadata }) => {
    const rows = bindings.filter(
      (binding) => binding.seed.value.match(/Q\d+$/)?.[0] === metadata.wikidataId,
    );
    if (!rows.length) return [];
    const ordinal = new Map(
      rows.map((row) => [
        row.item.value.match(/Q\d+$/)?.[0] ?? "",
        Number.parseFloat(row.ordinal?.value ?? "") || Number.MAX_SAFE_INTEGER,
      ]),
    );
    const unique = new Map<string, EBook>();
    for (const row of rows) {
      const id = row.item.value.match(/Q\d+$/)?.[0];
      if (!id || id === metadata.wikidataId || !entities[id]) continue;
      const member = mapWikidata(entities[id]);
      const key = titleKey(member.title);
      if (!key || key === titleKey(book.title)) continue;
      const previous = unique.get(key);
      if (!previous || (!previous.cover && member.cover)) unique.set(key, member);
    }
    const books = [...unique.values()].sort(
      (left, right) =>
        (ordinal.get(left.wikidataId ?? "") ?? Number.MAX_SAFE_INTEGER) -
          (ordinal.get(right.wikidataId ?? "") ?? Number.MAX_SAFE_INTEGER) ||
        (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER),
    );
    if (!books.length) return [];
    const seriesRow = rows.find((row) => row.kind?.value === "series");
    const sequence = !seriesRow;
    const primaryRow = seriesRow ?? rows[0];
    const seriesId = primaryRow.series.value.match(/Q\d+$/)?.[0];
    const labels = seriesId ? entities[seriesId]?.labels : undefined;
    const firstBook = [book, ...books].sort(
      (left, right) =>
        (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER),
    )[0];
    const name = sequence
      ? `${firstBook.title} Collection`
      : (labels?.en?.value ?? labels?.ar?.value ?? primaryRow.seriesLabel?.value ?? "Book");
    return [{ book, collection: { name, books, kind: "series" } }];
  });
}

async function wikidataAwardCollections(
  ebooks: EBook[],
): Promise<Array<{ book: EBook; collection: EBookCollection }>> {
  await fetchWikidataMetadata(ebooks).catch(() => []);
  const matched = ebooks.flatMap((book) => {
    const metadata = wikidataMetadata.get(metadataRequestKey(book));
    return metadata?.wikidataId ? [{ book, metadata }] : [];
  });
  if (!matched.length) return [];

  const seeds = [...new Set(matched.map(({ metadata }) => metadata.wikidataId!))];
  const awardQuery = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT DISTINCT ?seed ?award WHERE {
  VALUES ?seed { ${seeds.map((id) => `wd:${id}`).join(" ")} }
  { ?seed wdt:P166 ?award. }
  UNION
  { ?recipient p:P166 ?statement. ?statement ps:P166 ?award; pq:P1686 ?seed. }
}`;
  const awardUrl = new URL("https://query.wikidata.org/sparql");
  awardUrl.searchParams.set("query", awardQuery);
  awardUrl.searchParams.set("format", "json");
  const awardsData = await cachedJson<{
    results?: { bindings?: Array<{ seed: { value: string }; award: { value: string } }> };
  }>(awardUrl.toString(), 30_000).catch(() => null);
  const awardRows = awardsData?.results?.bindings ?? [];
  const awardIds = [
    ...new Set(
      awardRows.flatMap((row) => row.award.value.match(/Q\d+$/)?.[0] ?? []),
    ),
  ];
  if (!awardIds.length) return [];

  const memberQuery = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT DISTINCT ?award ?item WHERE {
  VALUES ?award { ${awardIds.map((id) => `wd:${id}`).join(" ")} }
  {
    ?item wdt:P166 ?award.
  }
  UNION
  {
    ?recipient p:P166 ?statement.
    ?statement ps:P166 ?award; pq:P1686 ?item.
  }
}
LIMIT 240`;
  const memberUrl = new URL("https://query.wikidata.org/sparql");
  memberUrl.searchParams.set("query", memberQuery);
  memberUrl.searchParams.set("format", "json");
  const memberData = await cachedJson<{
    results?: { bindings?: Array<{ award: { value: string }; item: { value: string } }> };
  }>(memberUrl.toString(), 30_000).catch(() => null);
  const memberRows = memberData?.results?.bindings ?? [];
  if (!memberRows.length) return [];

  const entityIds = [
    ...new Set(
      [...awardIds, ...memberRows.flatMap((row) => row.item.value.match(/Q\d+$/)?.[0] ?? [])],
    ),
  ];
  const entities: Record<string, WikidataEntity> = {};
  for (let start = 0; start < entityIds.length; start += 50) {
    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.search = new URLSearchParams({
      action: "wbgetentities",
      ids: entityIds.slice(start, start + 50).join("|"),
      props: "labels|descriptions|aliases|claims|sitelinks",
      languages: [...new Set([getUiLanguage(), "en", "ar", "pt", "ru", "ja"])].join("|"),
      format: "json",
      origin: "*",
      maxlag: "5",
    }).toString();
    const page = await cachedJson<{ entities?: Record<string, WikidataEntity> }>(
      entityUrl.toString(),
    ).catch(() => null);
    Object.assign(entities, page?.entities ?? {});
  }

  const ownersByAward = new Map<string, EBook[]>();
  for (const row of awardRows) {
    const seedId = row.seed.value.match(/Q\d+$/)?.[0];
    const awardId = row.award.value.match(/Q\d+$/)?.[0];
    const owner = matched.find(({ metadata }) => metadata.wikidataId === seedId)?.book;
    if (!awardId || !owner) continue;
    const owners = ownersByAward.get(awardId) ?? [];
    if (!owners.some((book) => book.id === owner.id)) owners.push(owner);
    ownersByAward.set(awardId, owners);
  }

  const literaryKinds = new Set([
    "Q571",
    "Q8261",
    "Q277759",
    "Q1667921",
    "Q7725634",
    "Q47461344",
  ]);
  const isLiteraryWork = (entity: WikidataEntity) => {
    const kinds = (entity.claims?.P31 ?? []).flatMap((statement) => {
      const value = statement.mainsnak?.datavalue?.value;
      return value && typeof value === "object" && "id" in value
        ? [String((value as { id: unknown }).id)]
        : [];
    });
    if (kinds.some((kind) => literaryKinds.has(kind))) return true;
    const description = entity.descriptions?.en?.value ?? entity.descriptions?.ar?.value ?? "";
    return /\b(?:book|novel|novella|literary work|short stor(?:y|ies))\b/i.test(description);
  };
  const literaryMetadata = new Map<string, EBook>();
  const literaryBooks = new Map<string, EBook>();
  for (const row of memberRows) {
    const itemId = row.item.value.match(/Q\d+$/)?.[0];
    const entity = itemId ? entities[itemId] : undefined;
    if (!itemId || !entity || !isLiteraryWork(entity)) continue;
    literaryBooks.set(itemId, mapWikidata(entity));
  }
  const rawLiteraryBooks = [...literaryBooks.values()];
  for (let start = 0; start < rawLiteraryBooks.length; start += 12) {
    const batch = rawLiteraryBooks.slice(start, start + 12);
    const openLibrary = await fetchOpenLibraryMetadata(batch).catch(() => []);
    for (const book of mergeEBookMetadata(batch, openLibrary)) {
      if (book.wikidataId) literaryMetadata.set(book.wikidataId, book);
    }
  }

  const results: Array<{ book: EBook; collection: EBookCollection }> = [];
  for (const [awardId, owners] of ownersByAward) {
    const members = new Map<string, EBook>();
    for (const row of memberRows) {
      if (row.award.value.match(/Q\d+$/)?.[0] !== awardId) continue;
      const itemId = row.item.value.match(/Q\d+$/)?.[0];
      const entity = itemId ? entities[itemId] : undefined;
      if (!entity || !isLiteraryWork(entity)) continue;
      const member = (itemId ? literaryMetadata.get(itemId) : undefined) ?? mapWikidata(entity);
      if (!member.cover) continue;
      const key = titleKey(member.title);
      if (key) members.set(key, member);
    }
    const award = entities[awardId];
    const name =
      award?.labels?.en?.value ??
      award?.labels?.[getUiLanguage()]?.value ??
      award?.labels?.ar?.value;
    if (!name || members.size < 2) continue;
    for (const owner of owners) {
      const books = [...members.values()].filter(
        (member) => titleKey(member.title) !== titleKey(owner.title),
      );
      if (books.length) results.push({ book: owner, collection: { name, books, kind: "award" } });
    }
  }
  return results;
}

export async function ebookCollections(
  ebooks: EBook[],
  onPartial?: (matches: Array<{ book: EBook; collection: EBookCollection }>) => void,
): Promise<Array<{ book: EBook; collection: EBookCollection }>> {
  const results: Array<{ book: EBook; collection: EBookCollection }> = [];
  const append = (matches: Array<{ book: EBook; collection: EBookCollection }>) => {
    for (const match of matches) {
      const duplicate = results.some(
        (existing) =>
          existing.book.id === match.book.id &&
          titleKey(existing.collection.name) === titleKey(match.collection.name),
      );
      if (!duplicate) results.push(match);
    }
    if (matches.length) onPartial?.([...results]);
  };

  // Wikidata is the primary collection source. Publish it immediately instead of
  // withholding valid results while the optional providers finish their requests.
  append(await wikidataBookCollections(ebooks).catch(() => []));
  append(await wikidataAwardCollections(ebooks).catch(() => []));
  append(await googleBookCollections(ebooks).catch(() => []));
  const covered = new Set(results.map(({ book }) => book.id));
  const unresolved = ebooks.filter((book) => !covered.has(book.id));
  for (let start = 0; start < unresolved.length; start += 4) {
    const batch = unresolved.slice(start, start + 4);
    const collections = await Promise.all(
      batch.map(async (book) => ({
        book,
        collection: await ebookCollection(book, false).catch(() => null),
      })),
    );
    const matches: Array<{ book: EBook; collection: EBookCollection }> = [];
    for (const match of collections) {
      if (match.collection?.books.length) matches.push({ book: match.book, collection: match.collection });
    }
    append(matches);
  }
  return results;
}

export async function ebookCollection(
  ebook: EBook,
  includeWikidata = true,
): Promise<EBookCollection | null> {
  if (ebook.seriesTitle && ebook.books && ebook.books.length > 1) {
    const books = ebook.books.filter(
      (book) => book.id !== ebook.id && titleKey(book.title) !== titleKey(ebook.title),
    );
    if (books.length) return { name: ebook.seriesTitle, books };
  }
  if (includeWikidata && !ebook.wikidataId) {
    const wikidata = (await fetchWikidataMetadata([ebook]).catch(() => []))[0];
    if (wikidata?.wikidataId) {
      return ebookCollection({
        ...ebook,
        ...wikidata,
        id: ebook.id,
      });
    }
  }
  if (includeWikidata && ebook.wikidataId && /^Q\d+$/.test(ebook.wikidataId)) {
    const query = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX p: <http://www.wikidata.org/prop/>
PREFIX ps: <http://www.wikidata.org/prop/statement/>
PREFIX pq: <http://www.wikidata.org/prop/qualifier/>
SELECT DISTINCT ?item ?series ?seriesLabel ?ordinal WHERE {
  wd:${ebook.wikidataId} wdt:P179 ?series.
  ?item wdt:P179 ?series.
  OPTIONAL { ?item p:P179 ?statement. ?statement ps:P179 ?series. ?statement pq:P1545 ?ordinal. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${getUiLanguage()},en,ar". }
}`;
    const url = new URL("https://query.wikidata.org/sparql");
    url.searchParams.set("query", query);
    url.searchParams.set("format", "json");
    const data = await cachedJson<{
      results?: {
        bindings?: Array<{
          item: { value: string };
          series: { value: string };
          seriesLabel?: { value: string };
          ordinal?: { value: string };
        }>;
      };
    }>(url.toString(), 30_000).catch(() => null);
    const bindings = data?.results?.bindings ?? [];
    const ids = [
      ...new Set(
        bindings
          .map((binding) => binding.item.value.match(/Q\d+$/)?.[0])
          .filter((id): id is string => !!id),
      ),
    ];
    const seriesId = bindings[0]?.series.value.match(/Q\d+$/)?.[0];
    if (ids.length > 1) {
      const entities: Record<string, WikidataEntity> = {};
      const entityIds = [...new Set([...ids, ...(seriesId ? [seriesId] : [])])];
      for (let start = 0; start < entityIds.length; start += 50) {
        const entityUrl = new URL("https://www.wikidata.org/w/api.php");
        entityUrl.search = new URLSearchParams({
          action: "wbgetentities",
          ids: entityIds.slice(start, start + 50).join("|"),
          props: "labels|descriptions|aliases|claims|sitelinks",
          languages: [...new Set([getUiLanguage(), "en", "ar", "pt", "ru", "ja"])].join("|"),
          format: "json",
          origin: "*",
        }).toString();
        const page = await cachedJson<{ entities?: Record<string, WikidataEntity> }>(
          entityUrl.toString(),
        ).catch(() => null);
        Object.assign(entities, page?.entities ?? {});
      }
      const ordinal = new Map(
        bindings.map((binding) => [
          binding.item.value.match(/Q\d+$/)?.[0] ?? "",
          Number.parseFloat(binding.ordinal?.value ?? "") || Number.MAX_SAFE_INTEGER,
        ]),
      );
      const unique = new Map<string, EBook>();
      for (const id of ids.filter((id) => id !== ebook.wikidataId)) {
        const entity = entities[id];
        if (!entity) continue;
        const book = mapWikidata(entity);
        const key = titleKey(book.title);
        if (!key || key === titleKey(ebook.title)) continue;
        const previous = unique.get(key);
        if (!previous || (!previous.cover && book.cover)) unique.set(key, book);
      }
      const books = [...unique.values()].sort(
        (left, right) =>
          (ordinal.get(left.wikidataId ?? "") ?? Number.MAX_SAFE_INTEGER) -
            (ordinal.get(right.wikidataId ?? "") ?? Number.MAX_SAFE_INTEGER) ||
          (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER),
      );
      if (books.length) {
        const seriesLabels = seriesId ? entities[seriesId]?.labels : undefined;
        const name =
          seriesLabels?.en?.value ??
          seriesLabels?.ar?.value ??
          bindings.find(
            (binding) => binding.seriesLabel?.value && !/^Q\d+$/.test(binding.seriesLabel.value),
          )?.seriesLabel?.value ??
          "Book";
        return {
          name,
          books,
        };
      }
    }
  }

  const knownSeries =
    ebook.seriesTitle && titleKey(ebook.seriesTitle) !== titleKey(ebook.title)
      ? ebook.seriesTitle
      : undefined;
  let series = knownSeries;

  if (!series) {
    const lookup = new URL("https://openlibrary.org/search.json");
    lookup.searchParams.set("title", ebook.title);
    if (ebook.authors[0]) lookup.searchParams.set("author", ebook.authors[0]);
    lookup.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
    lookup.searchParams.set("limit", "12");
    const data = await cachedJson<{ docs?: OpenLibraryDoc[] }>(lookup.toString()).catch(() => null);
    const candidates = data?.docs ?? [];
    const exact = candidates.find((doc) => {
      if (titleKey(doc.title) !== titleKey(ebook.title)) return false;
      return (
        !ebook.authors.length ||
        !doc.author_name?.length ||
        authorListsMatch(ebook.authors, doc.author_name)
      );
    });
    series = exact?.series?.find(Boolean);
  }

  if (!series) return null;
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", `series:\"${series.replaceAll('"', "")}\"`);
  url.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
  url.searchParams.set("limit", "50");
  const data = await cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString()).catch(() => null);
  const seriesKeyValue = titleKey(series);
  const unique = new Map<string, EBook>();
  for (const doc of data?.docs ?? []) {
    if (!(doc.series ?? []).some((value) => titleKey(value) === seriesKeyValue)) continue;
    if (
      ebook.authors.length &&
      doc.author_name?.length &&
      !authorListsMatch(ebook.authors, doc.author_name)
    )
      continue;
    const book = mapOpenLibrary(doc);
    if (book.id === ebook.id || titleKey(book.title) === titleKey(ebook.title)) continue;
    const key = titleKey(book.title);
    const previous = unique.get(key);
    if (!previous || (!previous.cover && book.cover)) unique.set(key, book);
  }
  const books = [...unique.values()].sort(
    (left, right) =>
      (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER) ||
      left.title.localeCompare(right.title, undefined, { numeric: true, sensitivity: "base" }),
  );
  return books.length ? { name: series, books } : null;
}

function alternativeTitles(doc: OpenLibraryDoc): string[] {
  return Array.isArray(doc.alternative_title)
    ? doc.alternative_title
    : doc.alternative_title
      ? [doc.alternative_title]
      : [];
}

async function fetchOpenLibraryMetadata(ebooks: EBook[]): Promise<EBook[]> {
  const pending = ebooks.filter((ebook) => !openLibraryMetadata.has(metadataRequestKey(ebook)));
  const docs: OpenLibraryDoc[] = [];
  let complete = true;
  const direct = pending.filter((ebook) => ebook.openLibraryId || ebook.isbn);
  await Promise.all(
    direct.map(async (source) => {
      const url = new URL("https://openlibrary.org/search.json");
      if (source.openLibraryId) url.searchParams.set("q", `key:/works/${source.openLibraryId}`);
      else url.searchParams.set("isbn", source.isbn!);
      url.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
      url.searchParams.set("limit", "5");
      const response = await cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString()).catch(
        () => null,
      );
      if (!response) return void (complete = false);
      docs.push(...(response.docs ?? []));
    }),
  );
  const titles = [
    ...new Set(
      pending.filter((ebook) => !ebook.openLibraryId && !ebook.isbn).flatMap(metadataCandidates),
    ),
  ];
  for (let start = 0; start < titles.length; start += 12) {
    const url = new URL("https://openlibrary.org/search.json");
    url.searchParams.set(
      "q",
      titles
        .slice(start, start + 12)
        .map((title) => `title:"${title.replace(/[\\"]+/g, " ")}"`)
        .join(" OR "),
    );
    url.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
    url.searchParams.set("limit", "100");
    url.searchParams.set("lang", getUiLanguage());
    const response = await cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString()).catch(
      () => null,
    );
    if (!response) complete = false;
    else docs.push(...(response.docs ?? []));
  }
  for (const source of pending) {
    const keys = new Set(metadataCandidates(source).map(titleKey));
    const exact =
      docs.find((doc) => doc.key.replace(/^\/works\//, "") === source.openLibraryId) ??
      docs.find((doc) => source.isbn && doc.isbn?.includes(source.isbn)) ??
      docs.find(
        (doc) =>
          [doc.title, ...alternativeTitles(doc)].some((value) => keys.has(titleKey(value))) &&
          (!source.authors.length ||
            !doc.author_name?.length ||
            authorListsMatch(source.authors, doc.author_name)),
      );
    if (!exact && !complete) continue;
    const cacheKey = metadataRequestKey(source);
    openLibraryMetadata.set(
      cacheKey,
      exact ? { ...mapOpenLibrary(exact), seriesTitle: source.seriesTitle || source.title } : null,
    );
    openLibraryAliases.set(cacheKey, exact ? alternativeTitles(exact) : []);
  }
  return ebooks.flatMap((ebook) => {
    const match = openLibraryMetadata.get(metadataRequestKey(ebook));
    return match ? [match] : [];
  });
}

async function fetchEBookMetadataNetwork(
  ebooks: EBook[],
  onPartial?: (metadata: EBook[]) => void,
): Promise<EBook[]> {
  let resolved: EBook[] = [];
  const publish = (metadata: EBook[]) => {
    if (!metadata.length) return;
    resolved = combineMetadata(resolved, metadata);
    cacheMetadataForSources(ebooks, resolved);
    onPartial?.(resolved);
  };
  const google = fetchGoogleMetadata(ebooks, publish).then((metadata) => {
    publish(metadata);
    return metadata;
  });
  const wikidata = fetchWikidataMetadata(ebooks, publish).then((metadata) => {
    publish(metadata);
    return metadata;
  });
  await Promise.allSettled([google, wikidata]);
  const primary = resolved;
  const unresolved = ebooks.filter(
    (source) => !primary.some((metadata) => verifiedMetadataMatch(source, metadata)),
  );
  const anilist = fetchAniListEBookMetadata(unresolved).then((metadata) => {
    publish(metadata);
    return metadata;
  });
  const openLibrary = fetchOpenLibraryMetadata(unresolved).then((metadata) => {
    publish(metadata);
    return metadata;
  });
  await Promise.allSettled([anilist, openLibrary]);
  const aliasOwners = new Map<string, { alias: string; owner: string }>();
  for (const ebook of unresolved) {
    const owner = ebook.seriesTitle || ebook.title;
    for (const alias of openLibraryAliases.get(metadataRequestKey(ebook)) ?? []) {
      if (titleKey(alias) !== titleKey(owner)) aliasOwners.set(titleKey(alias), { alias, owner });
    }
  }
  const aliasMatches = aliasOwners.size
    ? await fetchAniListEBookMetadata(
        [...aliasOwners.values()].map(({ alias }) => ({
          id: alias,
          source: "source",
          title: alias,
          authors: [],
          description: "",
          genres: [],
        })),
      )
    : [];
  const crosswalk = aliasMatches.flatMap((ebook) => {
    const owner = aliasOwners.get(titleKey(ebook.seriesTitle || ebook.title))?.owner;
    return owner ? [{ ...ebook, seriesTitle: owner }] : [];
  });
  publish(crosswalk);
  cacheMetadataForSources(ebooks, resolved, true);
  return resolved;
}

export async function fetchEBookMetadata(
  ebooks: EBook[],
  onPartial?: (metadata: EBook[]) => void,
): Promise<EBook[]> {
  const unique = [
    ...new Map(ebooks.map((ebook) => [metadataRequestKey(ebook), ebook])).values(),
  ];
  const cached = cachedMetadata(unique);
  if (cached.length) onPartial?.(cached);
  const pending = unique.filter((ebook) => !hasFreshMetadata(ebook));
  if (!pending.length) return cached;

  const joined = new Set<Promise<EBook[]>>();
  const owned: EBook[] = [];
  for (const ebook of pending) {
    const running = metadataInflight.get(metadataRequestKey(ebook));
    if (running) joined.add(running);
    else owned.push(ebook);
  }
  let ownedRequest: Promise<EBook[]> | null = null;
  if (owned.length) {
    ownedRequest = Promise.resolve().then(() =>
      fetchEBookMetadataNetwork(owned, () => {
        onPartial?.(cachedMetadata(unique));
      }),
    );
    for (const ebook of owned) metadataInflight.set(metadataRequestKey(ebook), ownedRequest);
    joined.add(ownedRequest);
  }
  await Promise.allSettled([...joined]);
  if (ownedRequest) {
    for (const ebook of owned) {
      const key = metadataRequestKey(ebook);
      if (metadataInflight.get(key) === ownedRequest) metadataInflight.delete(key);
    }
  }
  const final = cachedMetadata(unique);
  onPartial?.(final);
  return final;
}

const SUBJECT_QUERY: Record<string, string> = {
  Fiction: "fiction",
  "Non-fiction": "nonfiction",
  Novel: "novels",
  Novella: "novellas",
  "Short story": "short stories",
  Fantasy: "fantasy",
  "Science fiction": "science fiction",
  Romance: "romance",
  "Mystery / Detective": "mystery and detective stories",
  "Thriller / Suspense": "thrillers",
  Horror: "horror",
  "Historical fiction": "historical fiction",
  Adventure: "adventure stories",
  "Literary fiction": "literary fiction",
  "Young Adult (YA)": "young adult fiction",
  "Self-help / Personal development": "self-help",
  Psychology: "psychology",
  Philosophy: "philosophy",
  "Biography / Autobiography / Memoir": "biography and autobiography",
  History: "history",
  "Business & Finance": "business and economics",
  Science: "science",
  Technology: "technology",
  "Health & Fitness": "health and fitness",
  "Politics & Society": "politics and government",
  "True crime": "true crime",
  Travel: "travel",
  "Education / Textbooks": "education",
  "Reference / Guides": "reference",
  Essays: "essays",
  "Religion & Spirituality": "religion and spirituality",
  Cookbooks: "cookbooks",
};

export async function browseEBookCategory(category: string): Promise<EBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("subject", SUBJECT_QUERY[category] ?? category);
  url.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
  url.searchParams.set("limit", "24");
  return groupEBookSeries(
    (await cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString())).docs?.map(mapOpenLibrary) ?? [],
  );
}

export async function browsePopularEBooks(): Promise<EBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", "language:eng");
  url.searchParams.set("sort", "readinglog");
  url.searchParams.set(
    "fields",
    "key,title,author_name,cover_i,first_publish_year,subject,series,isbn",
  );
  url.searchParams.set("limit", "60");
  const data = await cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString(), 30_000);
  return groupEBookSeries((data.docs ?? []).map(mapOpenLibrary));
}

export async function searchEBooks(search: string, category?: string): Promise<EBook[]> {
  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", search.trim());
  if (category) url.searchParams.set("subject", SUBJECT_QUERY[category] ?? category);
  url.searchParams.set("fields", OPEN_LIBRARY_FIELDS);
  url.searchParams.set("limit", "16");
  const [primary, data] = await Promise.all([
    category ? Promise.resolve([]) : browseEBooks("SEARCH_MATCH", 1, search).catch(() => []),
    cachedJson<{ docs?: OpenLibraryDoc[] }>(url.toString()).catch(() => null),
  ]);
  return groupEBookSeries([...primary, ...(data?.docs ?? []).map(mapOpenLibrary)]);
}

function seriesKey(ebook: EBook): string {
  return (ebook.seriesTitle || ebook.title)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function groupEBookSeries(ebooks: EBook[]): EBook[] {
  const groups = new Map<string, EBook[]>();
  for (const ebook of ebooks) {
    const key = seriesKey(ebook);
    const books = groups.get(key) ?? [];
    if (!books.some((book) => book.id === ebook.id)) books.push(ebook);
    groups.set(key, books);
  }
  return Array.from(groups.values()).map((books) => {
    if (books.length === 1) return books[0];
    const primary =
      books.find((book) => book.source === "source") ??
      books.find((book) => book.source === "anilist") ??
      books[0];
    return {
      ...primary,
      title: primary.seriesTitle || primary.title,
      books: books.flatMap((book) => book.books ?? [book]),
    };
  });
}

function identityAliases(ebook: EBook): Set<string> {
  return new Set(
    [
      ebook.title,
      ...(ebook.sourceAliases ??
        (ebook.source === "source" ? (ebook.altTitle?.split("|") ?? []) : [])),
      ...(ebook.verifiedAliases ?? []),
    ]
      .filter((title): title is string => Boolean(title?.trim()))
      .map(identityTitleKey)
      .filter(Boolean),
  );
}

function explicitSourceIdentityMatch(left: EBook, right: EBook): boolean {
  const a = left.sourceIdentity;
  const b = right.sourceIdentity;
  if (!a || !b) return false;
  return Boolean(
    (a.anilistId && a.anilistId === b.anilistId) ||
      (a.googleBooksId && a.googleBooksId === b.googleBooksId) ||
      (a.openLibraryId && a.openLibraryId === b.openLibraryId) ||
      (a.wikidataId && a.wikidataId === b.wikidataId) ||
      (a.isbn && a.isbn === b.isbn),
  );
}

/** True when two catalog entries represent the same readable work, not merely the same series. */
export function eBooksMatch(left: EBook, right: EBook): boolean {
  if (left.id === right.id) return true;
  if (explicitSourceIdentityMatch(left, right)) return true;
  const leftAliases = identityAliases(left);
  const sharedAliases = [...identityAliases(right)].filter((alias) => leftAliases.has(alias));
  if (!sharedAliases.length) return false;
  const leftPrimary = identityTitleKey(left.title);
  const rightPrimary = identityTitleKey(right.title);
  const crossLanguage =
    /\p{Script=Arabic}/u.test(left.title) !== /\p{Script=Arabic}/u.test(right.title);
  const leftExplicitAliases = new Set((left.sourceAliases ?? []).map(identityTitleKey));
  const rightExplicitAliases = new Set((right.sourceAliases ?? []).map(identityTitleKey));
  const leftVerifiedAliases = new Set((left.verifiedAliases ?? []).map(identityTitleKey));
  const rightVerifiedAliases = new Set((right.verifiedAliases ?? []).map(identityTitleKey));
  const leftTrustedAliases = new Set([...leftExplicitAliases, ...leftVerifiedAliases]);
  const rightTrustedAliases = new Set([...rightExplicitAliases, ...rightVerifiedAliases]);
  const crossLanguageAlias =
    crossLanguage &&
    sharedAliases.some(
      (alias) =>
        (leftTrustedAliases.has(alias) && alias === rightPrimary) ||
        (rightTrustedAliases.has(alias) && alias === leftPrimary) ||
        (leftTrustedAliases.has(alias) && rightTrustedAliases.has(alias)),
    );
  if (crossLanguageAlias) return true;
  if (left.authors.length && right.authors.length)
    return authorListsMatch(left.authors, right.authors);
  return true;
}

/** Collapses duplicate works while retaining every source route in `books`. */
export function dedupeEBooks(ebooks: EBook[]): EBook[] {
  const unique = new Map<string, EBook>();
  for (const ebook of ebooks.flatMap((item) => item.books ?? [item])) unique.set(ebook.id, ebook);
  const groups: EBook[][] = [];
  for (const ebook of unique.values()) {
    const group = groups.find((items) => items.some((item) => eBooksMatch(item, ebook)));
    if (group) group.push(ebook);
    else groups.push([ebook]);
  }
  return groups.map((items) => {
    const primary =
      items.find(
        (item) =>
          /\p{Script=Latin}/u.test(item.title) && !/\p{Script=Arabic}/u.test(item.title),
      ) ?? items[0];
    const ordered = [primary, ...items.filter((item) => item.id !== primary.id)];
    return {
      ...primary,
      books: ordered.length > 1 ? ordered : undefined,
    };
  });
}

function sourceFallback(ebook: EBook): EBook {
  if (ebook.source !== "source") return { ...ebook };
  if (/\p{Script=Arabic}/u.test(ebook.title)) return { ...ebook };
  const language = getUiLanguage();
  let slug = "";
  try {
    slug =
      decodeURIComponent(ebook.sourceItemId ?? "")
        .split("/")
        .filter(Boolean)
        .at(-1)
        ?.replace(/[-_]+/g, " ") ?? "";
  } catch {}
  const alternatives = [...(ebook.altTitle?.split("|") ?? []), slug].filter(Boolean);
  const localized = alternatives.find((title) =>
    language === "ar"
      ? /\p{Script=Arabic}/u.test(title)
      : language === "ru"
        ? /\p{Script=Cyrillic}/u.test(title)
        : /\p{Script=Latin}/u.test(title),
  );
  return {
    ...ebook,
    title: localized || ebook.title || alternatives[0],
  };
}

export function mergeEBookMetadata(sources: EBook[], metadata: EBook[]): EBook[] {
  const priority = ["googlebooks", "wikidata", "anilist", "openlibrary"] as const;
  const matches = new Map<string, EBook[]>();
  for (const ebook of metadata) {
    const key = seriesKey(ebook);
    matches.set(key, [...(matches.get(key) ?? []), ebook]);
  }
  return groupEBookSeries(sources).map((ebook) => {
    const keepArabicSource = ebook.source === "source" && /\p{Script=Arabic}/u.test(ebook.title);
    const candidates = (matches.get(seriesKey(ebook)) ?? [])
      .filter((candidate) => verifiedMetadataMatch(ebook, candidate))
      .sort(
        (left, right) =>
          priority.indexOf(left.source as (typeof priority)[number]) -
          priority.indexOf(right.source as (typeof priority)[number]),
      );
    const source = sourceFallback(ebook);
    if (!candidates.length) return source;
    const meta = candidates[0];
    const mergedAlternativeTitles = [
      ...(source.altTitle?.split("|") ?? []),
      meta.title,
      ...(meta.altTitle?.split("|") ?? []),
    ]
      .map((title) => title?.trim())
      .filter((title): title is string => Boolean(title) && title !== source.title);
    const embeddedSourceCover = /^data:image\//i.test(source.cover ?? "");
    const metadataGenres = candidates.find((candidate) => candidate.genres.length)?.genres ?? [];
    return {
      ...source,
      anilistId: meta.anilistId ?? source.anilistId,
      googleBooksId: meta.googleBooksId ?? source.googleBooksId,
      openLibraryId: meta.openLibraryId ?? source.openLibraryId,
      wikidataId: meta.wikidataId ?? source.wikidataId,
      isbn: meta.isbn ?? source.isbn,
      title: keepArabicSource ? source.title : meta.title || source.title,
      altTitle: mergedAlternativeTitles.length
        ? [...new Set(mergedAlternativeTitles)].join("|")
        : undefined,
      verifiedAliases: [meta.title, ...(meta.altTitle?.split("|") ?? [])]
        .map((title) => title.trim())
        .filter(Boolean),
      authors: meta.authors.length ? meta.authors : source.authors,
      internalCover:
        source.internalCover ??
        candidates.find((candidate) => candidate.cover && candidate.cover !== meta.cover)?.cover ??
        source.cover ??
        meta.cover,
      cover:
        keepArabicSource || embeddedSourceCover
          ? source.cover || meta.cover
          : meta.cover || source.cover,
      banner: meta.banner ?? source.banner,
      description: keepArabicSource
        ? source.description || meta.description
        : meta.description || source.description,
      genres:
        keepArabicSource && source.genres.length
          ? source.genres
          : metadataGenres.length
            ? metadataGenres
            : ebook.genres,
      year: meta.year ?? source.year,
      publishedAt: meta.publishedAt ?? source.publishedAt,
      status: meta.status ?? source.status,
      originalLanguage: meta.originalLanguage ?? source.originalLanguage,
      chapters: source.chapters,
      volumes: source.volumes,
      score: meta.score ?? source.score,
      trendingScore: meta.trendingScore ?? source.trendingScore,
      siteUrl: meta.siteUrl ?? source.siteUrl,
    };
  });
}

export function attachEBookCollectionSources(metadata: EBook[], sources: EBook[]): EBook[] {
  const sourceBooks = sources.flatMap((ebook) => ebook.books ?? [ebook]);
  return metadata.map((book) => {
    const matches = sourceBooks.filter((source) => verifiedMetadataMatch(source, book));
    if (!matches.length) return book;
    const merged = mergeEBookMetadata(matches, [book]);
    if (!merged.length) return book;
    const primary = merged[0];
    const readable = merged.flatMap((ebook) => ebook.books ?? [ebook]);
    return {
      ...primary,
      books: readable.length > 1 ? readable : undefined,
    };
  });
}

export async function ebookDetail(id: string): Promise<EBook | null> {
  if (id.startsWith("openlibrary:")) {
    const key = id.slice(12);
    const data = await cachedJson<{
      title: string;
      description?: string | { value?: string };
      covers?: number[];
      first_publish_date?: string;
      subjects?: string[];
    }>(`https://openlibrary.org/works/${encodeURIComponent(key)}.json`).catch(() => null);
    if (!data) return null;
    const description = clean(
      typeof data.description === "string" ? data.description : (data.description?.value ?? ""),
    );
    return {
      id,
      source: "openlibrary",
      openLibraryId: key,
      title: data.title,
      authors: [],
      cover: data.covers?.[0]
        ? `https://covers.openlibrary.org/b/id/${data.covers[0]}-L.jpg`
        : undefined,
      description,
      year: Number(data.first_publish_date?.match(/\d{4}/)?.[0]) || undefined,
      publishedAt: data.first_publish_date,
      genres: data.subjects?.slice(0, 8) ?? [],
      siteUrl: `https://openlibrary.org/works/${key}`,
    };
  }
  const anilistId = Number(id.replace(/^anilist:/, ""));
  if (!anilistId) return null;
  const data = await anilistRequest<{ Media: RawEBook | null }>(
    DETAIL,
    { id: anilistId },
    undefined,
    true,
  );
  return data.Media ? mapEBook(data.Media) : null;
}

const ebookAdaptationCache = new Map<string, Promise<EBookAdaptations>>();

export function ebookAdaptations(ebook: EBook): Promise<EBookAdaptations> {
  const cacheKey = `${ebook.anilistId ?? ""}:${ebook.wikidataId ?? ""}:${identityTitleKey(
    ebook.seriesTitle || ebook.title,
  )}`;
  const cached = ebookAdaptationCache.get(cacheKey);
  if (cached) return cached;

  const request = (async () => {
    const result: EBookAdaptations = { manga: [], anime: [], liveAction: [] };
    const add = (
      kind: EBookAdaptationKind,
      value: string | Omit<EBookAdaptation, "kind"> | null | undefined,
    ) => {
      if (!value) return;
      const title = (typeof value === "string" ? value : value.title).trim();
      if (!title) return;
      const item: EBookAdaptation =
        typeof value === "string"
          ? {
              id: `metadata:${kind}:${identityTitleKey(title)}`,
              kind,
              title,
              source: "metadata",
            }
          : { ...value, kind, title };
      const duplicate = result[kind].some(
        (existing) =>
          existing.id === item.id ||
          identityTitleKey(existing.title) === identityTitleKey(item.title),
      );
      if (!duplicate) result[kind].push(item);
    };
    const matchedMetadata = await fetchEBookMetadata([ebook]).catch(() => []);
    const adaptationAnilistId =
      ebook.anilistId ?? matchedMetadata.find((metadata) => metadata.anilistId)?.anilistId;
    const adaptationWikidataId =
      ebook.wikidataId ?? matchedMetadata.find((metadata) => metadata.wikidataId)?.wikidataId;

    const englishTitle = [
      ebook.title,
      ...(ebook.altTitle?.split("|") ?? []),
      ebook.seriesTitle,
      ...(ebook.books ?? []).flatMap((book) => [book.title, ...(book.altTitle?.split("|") ?? [])]),
    ].find((title): title is string => !!title && /\p{Script=Latin}/u.test(title));
    const mangaDex = englishTitle
      ? (() => {
          const url = new URL("https://api.mangadex.org/manga");
          url.searchParams.set("title", englishTitle);
          url.searchParams.set("limit", "10");
          url.searchParams.set("includes[]", "author");
          url.searchParams.append("includes[]", "cover_art");
          url.searchParams.set("order[relevance]", "desc");
          return cachedJson<{
            data?: Array<{
              id?: string;
              attributes?: {
                title?: Record<string, string>;
                altTitles?: Array<Record<string, string>>;
              };
              relationships?: Array<{
                type?: string;
                attributes?: { name?: string; fileName?: string };
              }>;
            }>;
          }>(url.toString()).catch(() => null);
        })()
      : Promise.resolve(null);

    const aniList = adaptationAnilistId
      ? anilistRequest<{
          Media: {
            relations: {
              edges: Array<{
                relationType: string | null;
                node: {
                  id: number;
                  type: "ANIME" | "MANGA";
                  format: string | null;
                  seasonYear: number | null;
                  coverImage: { large: string | null } | null;
                  title: { english: string | null; romaji: string | null; native: string | null };
                } | null;
              }>;
            } | null;
          } | null;
        }>(
          `query ($id: Int) {
            Media(id: $id, type: MANGA, format: NOVEL) {
              relations {
                edges {
                  relationType
                  node { id type format seasonYear coverImage { large } title { english romaji native } }
                }
              }
            }
          }`,
          { id: adaptationAnilistId },
          undefined,
          true,
        ).catch(() => null)
      : Promise.resolve(null);

    const wikidata = adaptationWikidataId
      ? (() => {
          const query = `PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX schema: <http://schema.org/>
SELECT DISTINCT ?adaptation ?label ?description ?image WHERE {
  ?adaptation wdt:P144 wd:${adaptationWikidataId}; rdfs:label ?label.
  FILTER(LANG(?label) = "en")
  OPTIONAL { ?adaptation schema:description ?description. FILTER(LANG(?description) = "en") }
  OPTIONAL { ?adaptation wdt:P18 ?image. }
} LIMIT 30`;
          const url = new URL("https://query.wikidata.org/sparql");
          url.searchParams.set("query", query);
          url.searchParams.set("format", "json");
          return cachedJson<{
            results?: {
              bindings?: Array<{
                adaptation?: { value?: string };
                label?: { value?: string };
                description?: { value?: string };
                image?: { value?: string };
              }>;
            };
          }>(url.toString()).catch(() => null);
        })()
      : Promise.resolve(null);

    const [mangaDexData, aniListData, wikidataData] = await Promise.all([
      mangaDex,
      aniList,
      wikidata,
    ]);
    const knownAuthors = [
      ...new Set([
        ...ebook.authors,
        ...(ebook.books ?? []).flatMap((book) => book.authors),
        ...matchedMetadata.flatMap((metadata) => metadata.authors),
      ]),
    ].filter(Boolean);
    let mangaDexHighConfidence = false;
    if (englishTitle) {
      const wanted = identityTitleKey(englishTitle);
      const wantedTokens = new Set(wanted.split(" ").filter(Boolean));
      const scored = (mangaDexData?.data ?? [])
        .flatMap((item) => {
          const titles = [
            ...Object.values(item.attributes?.title ?? {}),
            ...(item.attributes?.altTitles ?? []).flatMap((title) => Object.values(title)),
          ];
          const authors = (item.relationships ?? [])
            .filter((relationship) => relationship.type === "author")
            .map((relationship) => relationship.attributes?.name?.trim() ?? "")
            .filter(Boolean);
          const coverFile = (item.relationships ?? []).find(
            (relationship) => relationship.type === "cover_art",
          )?.attributes?.fileName;
          const poster =
            item.id && coverFile
              ? `https://uploads.mangadex.org/covers/${item.id}/${coverFile}.256.jpg`
              : undefined;
          return titles.map((title) => {
            const candidate = identityTitleKey(title);
            const candidateTokens = new Set(candidate.split(" ").filter(Boolean));
            const intersection = [...wantedTokens].filter((token) =>
              candidateTokens.has(token),
            ).length;
            const union = new Set([...wantedTokens, ...candidateTokens]).size;
            const confidence =
              candidate === wanted
                ? 1
                : wantedTokens.size >= 2 &&
                    candidateTokens.size >= 2 &&
                    (candidate.includes(wanted) || wanted.includes(candidate))
                  ? 0.9
                  : union
                    ? intersection / union
                    : 0;
            return {
              id: item.id,
              title,
              altTitles: titles.filter((value) => value !== title),
              confidence,
              authors,
              poster,
            };
          });
        })
        .sort((left, right) => right.confidence - left.confidence);
      const verified = scored.find(
        (candidate) =>
          candidate.confidence >= 0.86 &&
          knownAuthors.length > 0 &&
          authorListsMatch(knownAuthors, candidate.authors),
      );
      if (verified) {
        add("manga", {
          id: verified.id
            ? `mangadex:${verified.id}`
            : `metadata:manga:${identityTitleKey(verified.title)}`,
          title: verified.title,
          altTitles: verified.altTitles,
          source: "mangadex",
          poster: verified.poster,
          siteUrl: verified.id ? `https://mangadex.org/title/${verified.id}` : undefined,
        });
        mangaDexHighConfidence = true;
      }
    }
    const relationEdges = aniListData?.Media?.relations?.edges ?? [];
    const animeEdges = relationEdges.filter(
      (edge) => edge.relationType === "ADAPTATION" && edge.node?.type === "ANIME",
    );
    const seasonMetadata = await Promise.all(
      animeEdges.map(async (edge) => {
        const node = edge.node!;
        const relations = await animeRelations(node.id).catch(() => []);
        const seasonFormats = new Set(["TV", "TV_SHORT", "ONA"]);
        const seasons = [
          ...(seasonFormats.has(node.format ?? "")
            ? [
                {
                  id: node.id,
                  name: node.title.english || node.title.romaji || node.title.native || "",
                  year: node.seasonYear ?? undefined,
                  format: node.format ?? undefined,
                  poster: node.coverImage?.large ?? undefined,
                },
              ]
            : []),
          ...relations.filter((relation) => seasonFormats.has(relation.format ?? "")),
        ];
        const uniqueSeasons = [...new Map(seasons.map((season) => [season.id, season])).values()];
        const root = [...uniqueSeasons].sort(
          (left, right) =>
            (left.year ?? Number.MAX_SAFE_INTEGER) - (right.year ?? Number.MAX_SAFE_INTEGER),
        )[0];
        const title = root?.name || node.title.english || node.title.romaji || node.title.native;
        return title
          ? {
              id: `anilist:${root?.id ?? node.id}`,
              title,
              source: "anilist" as const,
              anilistId: root?.id ?? node.id,
              poster: root?.poster ?? node.coverImage?.large ?? undefined,
              year: root?.year ?? node.seasonYear ?? undefined,
              format: root?.format ?? node.format ?? undefined,
              relation: edge.relationType ?? undefined,
              seasons: uniqueSeasons.length > 1 ? uniqueSeasons.length : undefined,
              siteUrl: `https://anilist.co/anime/${root?.id ?? node.id}`,
            }
          : null;
      }),
    );
    seasonMetadata.forEach((item) => add("anime", item));

    for (const edge of relationEdges) {
      if (edge.relationType !== "ADAPTATION" || !edge.node) continue;
      const title = edge.node.title.english || edge.node.title.romaji || edge.node.title.native;
      if (!mangaDexHighConfidence && edge.node.type === "MANGA" && edge.node.format !== "NOVEL")
        add("manga", {
          id: `anilist:${edge.node.id}`,
          title: title ?? "",
          altTitles: [
            edge.node.title.english,
            edge.node.title.romaji,
            edge.node.title.native,
          ].filter((value): value is string => !!value && value !== title),
          source: "anilist",
          anilistId: edge.node.id,
          poster: edge.node.coverImage?.large ?? undefined,
          year: edge.node.seasonYear ?? undefined,
          format: edge.node.format ?? undefined,
          relation: edge.relationType ?? undefined,
          siteUrl: `https://anilist.co/manga/${edge.node.id}`,
        });
    }
    for (const binding of wikidataData?.results?.bindings ?? []) {
      const description = binding.description?.value?.toLocaleLowerCase() ?? "";
      const title = binding.label?.value;
      if (!title) continue;
      const wikidataId = binding.adaptation?.value?.match(/Q\d+$/)?.[0];
      const adaptation = {
        id: wikidataId
          ? `wikidata:${wikidataId}`
          : `metadata:adaptation:${identityTitleKey(title)}`,
        title,
        source: "wikidata" as const,
        wikidataId,
        description: binding.description?.value,
        poster: binding.image?.value?.replace(/^http:/, "https:"),
        siteUrl: wikidataId ? `https://www.wikidata.org/wiki/${wikidataId}` : undefined,
      };
      if (/\bmanga\b/.test(description)) add("manga", adaptation);
      else if (/\banime\b/.test(description)) add("anime", adaptation);
      else if (/live.action|television|tv series|film|movie/.test(description))
        add("liveAction", adaptation);
    }
    return result;
  })();

  ebookAdaptationCache.set(cacheKey, request);
  return request;
}
