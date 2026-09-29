import type { Meta } from "@/lib/cinemeta";
import { externalToKitsu } from "@/lib/providers/anime-mapping";
import { kitsuAnime, parseKitsuId } from "@/lib/providers/kitsu";
import type { PlayEpisode } from "@/lib/view";

const ANIME_ID_RX = /^(kitsu|mal|anilist|anidb):(\d+)/;
const IGNORE_TITLE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
]);

export type AnimeTitleEvidence = "match" | "unknown";

const titleCache = new Map<string, Promise<string[]>>();

function uniqueTitles(titles: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  return titles.flatMap((title) => {
    const value = title?.trim() ?? "";
    const key = value.toLocaleLowerCase();
    if (!value || seen.has(key)) return [];
    seen.add(key);
    return [value];
  });
}

async function loadTitles(
  meta: Meta,
  episode: PlayEpisode | undefined,
  streamIds: string[],
): Promise<string[]> {
  const exactEntryId = episode?.sourceMetaId ?? episode?.kitsuStreamId;
  const match = ANIME_ID_RX.exec(exactEntryId ?? meta.id);
  const resolvedKitsu = streamIds
    .map((id) => /^(?:kitsu|mal):(\d+)(?::\d+)?$/.exec(id))
    .find((value) => value != null);
  if (!match && !resolvedKitsu) return [];
  let kitsuId: number | null = null;
  if (resolvedKitsu) {
    if (resolvedKitsu[0].startsWith("kitsu:")) kitsuId = Number(resolvedKitsu[1]);
    else kitsuId = await externalToKitsu("myanimelist", Number(resolvedKitsu[1])).catch(() => null);
  } else if (match?.[1] === "kitsu") kitsuId = parseKitsuId(exactEntryId ?? meta.id);
  else if (match) kitsuId = await externalToKitsu(match[1], Number(match[2])).catch(() => null);
  if (kitsuId == null) return [];
  const detail = await kitsuAnime(kitsuId).catch(() => null);
  if (!detail) return [];
  return uniqueTitles([
    ...(exactEntryId && exactEntryId !== meta.id ? [] : [meta.name]),
    ...detail.altTitles,
  ]);
}

/** Known aliases for this exact anime entry. It intentionally does not add titles from sibling seasons or spin-offs. */
export function animeTitlesForMeta(
  meta: Meta,
  episode?: PlayEpisode,
  streamIds: string[] = [],
): Promise<string[]> {
  const canonicalEntry =
    episode?.sourceMetaId ??
    episode?.kitsuStreamId ??
    streamIds.find((id) => /^(?:kitsu|mal):\d+(?::\d+)?$/.test(id));
  const cacheKey = `${meta.id}|${canonicalEntry ?? ""}`;
  const cached = titleCache.get(cacheKey);
  if (cached) return cached;
  const pending = loadTitles(meta, episode, streamIds).catch(() => []);
  titleCache.set(cacheKey, pending);
  if (titleCache.size > 300) titleCache.clear();
  return pending;
}

function tokens(title: string): string[] {
  return (
    title
      .normalize("NFKD")
      .toLocaleLowerCase()
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).filter((token) => !IGNORE_TITLE_TOKENS.has(token));
}

function normalized(title: string): string {
  return tokens(title).join(" ");
}

/** Exact normalized alias match is required for unattended downloads. */
export function animeTitleEvidence(
  expectedTitles: readonly string[] | null | undefined,
  releaseTitle: string | null | undefined,
): AnimeTitleEvidence {
  const actual = releaseTitle?.trim();
  if (!actual || !expectedTitles || expectedTitles.length === 0) return "unknown";
  if (tokens(actual).length === 0) return "unknown";

  for (const expected of expectedTitles) {
    const expectedTokens = tokens(expected);
    if (expectedTokens.length === 0) continue;
    if (normalized(expected) === normalized(actual)) return "match";
  }

  return "unknown";
}

/** Safe unattended choices need an exact entry alias in both release and resolved file names. */
export function isSafeAnimeAutoDownload(
  expectedTitles: readonly string[] | null | undefined,
  candidateTitle: string | null | undefined,
  resolvedFilenameTitle?: string | null,
): boolean {
  if (animeTitleEvidence(expectedTitles, candidateTitle) !== "match") return false;
  return (
    resolvedFilenameTitle == null ||
    animeTitleEvidence(expectedTitles, resolvedFilenameTitle) === "match"
  );
}
