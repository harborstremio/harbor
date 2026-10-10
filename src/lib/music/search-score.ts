import {
  hasCyrillic,
  normalizeName,
  normalizeTitle,
  tokenize,
  transliterateCyrillic,
} from "./search-normalize";

/** Names are short, so the bound only guards a pathological input, never a real one. */
const EDIT_DISTANCE_LIMIT = 64;

const WINKLER_SCALE = 0.1;
const WINKLER_MAX_PREFIX = 4;
/** Standard Jaro-Winkler gate: boost a shared prefix only once the names already look alike. */
const WINKLER_THRESHOLD = 0.7;

/** Character level, so a typo inside one word still scores. */
const SIMILARITY_WEIGHT = 0.5;
/** Word level, so an extra or missing word still scores. */
const TOKEN_WEIGHT = 0.5;
/** Below this two words are different words, not one word typed badly. */
const TOKEN_MATCH_FLOOR = 0.84;
/** Covering what the user actually typed matters more than... */
const QUERY_COVERAGE_WEIGHT = 0.7;
/** ...covering the rest of a long candidate name. */
const CANDIDATE_COVERAGE_WEIGHT = 0.3;
/** The right words in the wrong order is strong evidence, but never as strong as exact. */
const UNORDERED_CEILING = 0.95;
/** Typing the opening words of a longer name is a deliberate match, not a coincidence. */
const PREFIX_FLOOR = 0.8;
/** A romanised hit is real but weaker than the same name typed in its own script. */
const TRANSLITERATION_PENALTY = 0.97;

/** What the user typed is the primary evidence and must dominate every other signal. */
const NAME_WEIGHT = 0.62;
/** Large enough that two names equally close to the query are separated decisively. */
const POPULARITY_WEIGHT = 0.3;
/** A prior over result types; breaks near ties only. */
const KIND_WEIGHT = 0.05;
/** Last tie-break so ordering is stable across runs; never a ranking force. */
const SOURCE_WEIGHT = 0.03;
/** Popularity cannot rescue a name the user did not type; it only separates close names. */
const POPULARITY_GATE_FLOOR = 0.5;
/** Unknown popularity is not evidence of being unpopular, so it sits at the midpoint. */
const DEFAULT_POPULARITY = 0.5;
/** Fan counts and monthly listeners are long tailed, so compress them against this ceiling. */
const POPULARITY_COUNT_CEILING = 10000000;

const KIND_PRIOR: Record<string, number> = {
  track: 1,
  artist: 0.96,
  album: 0.92,
  playlist: 0.7,
  station: 0.6,
};
const UNKNOWN_KIND_PRIOR = 0.8;

/** Below this the candidate is not the thing the user typed, whatever its popularity. */
export const RELEVANT_NAME_SCORE = 0.55;

export type MusicSearchCandidate = {
  query: string;
  name: string;
  /** Normalised 0..1. Use popularityFromCount or popularityFromPercent for raw source values. */
  popularity?: number;
  kind: string;
  /** Position of the source in the merge order, 0 best. Only ever a tie-break. */
  sourceRank?: number;
};

export type MusicSearchScoreParts = {
  name: number;
  popularity: number;
  kind: number;
  source: number;
  total: number;
};

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * Levenshtein distance over code points, banded to maxDistance.
 * A true distance greater than the bound is reported as maxDistance + 1, not the real value.
 */
export function editDistance(a: string, b: string, maxDistance = EDIT_DISTANCE_LIMIT): number {
  const left = Array.from(a);
  const right = Array.from(b);
  const limit = Math.min(Math.max(0, Math.trunc(maxDistance)), Math.max(left.length, right.length));
  const over = limit + 1;
  if (Math.abs(left.length - right.length) > limit) return over;
  let previous = Array.from({ length: right.length + 1 }, (_, index) =>
    index <= limit ? index : over,
  );
  let current = Array.from({ length: right.length + 1 }, () => over);
  for (let row = 1; row <= left.length; row += 1) {
    current.fill(over);
    if (row <= limit) current[0] = row;
    const from = Math.max(1, row - limit);
    const to = Math.min(right.length, row + limit);
    let rowMin = current[0];
    for (let column = from; column <= to; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      const value = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + cost,
        over,
      );
      current[column] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return over;
    const swap = previous;
    previous = current;
    current = swap;
  }
  return Math.min(previous[right.length], over);
}

function jaro(a: string, b: string): number {
  const left = Array.from(a);
  const right = Array.from(b);
  if (!left.length || !right.length) return 0;
  const window = Math.max(0, Math.floor(Math.max(left.length, right.length) / 2) - 1);
  const leftMatched = Array.from({ length: left.length }, () => false);
  const rightMatched = Array.from({ length: right.length }, () => false);
  let matches = 0;
  for (let index = 0; index < left.length; index += 1) {
    const from = Math.max(0, index - window);
    const to = Math.min(right.length - 1, index + window);
    for (let other = from; other <= to; other += 1) {
      if (rightMatched[other] || left[index] !== right[other]) continue;
      leftMatched[index] = true;
      rightMatched[other] = true;
      matches += 1;
      break;
    }
  }
  if (!matches) return 0;
  let cursor = 0;
  let transpositions = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (!leftMatched[index]) continue;
    while (!rightMatched[cursor]) cursor += 1;
    if (left[index] !== right[cursor]) transpositions += 1;
    cursor += 1;
  }
  const halved = transpositions / 2;
  return (matches / left.length + matches / right.length + (matches - halved) / matches) / 3;
}

function jaroWinkler(a: string, b: string): number {
  const base = jaro(a, b);
  if (base < WINKLER_THRESHOLD) return base;
  const left = Array.from(a);
  const right = Array.from(b);
  let prefix = 0;
  while (
    prefix < WINKLER_MAX_PREFIX &&
    prefix < left.length &&
    prefix < right.length &&
    left[prefix] === right[prefix]
  ) {
    prefix += 1;
  }
  return clamp01(base + prefix * WINKLER_SCALE * (1 - base));
}

/** Jaro-Winkler over normalised text: case, accents, script marks and punctuation never count. */
export function similarity(a: string, b: string): number {
  return jaroWinkler(normalizeName(a), normalizeName(b));
}

function overlapOf(query: string[], candidate: string[]): number {
  if (!query.length || !candidate.length) return 0;
  const taken = Array.from({ length: candidate.length }, () => false);
  let matched = 0;
  for (const word of query) {
    let bestIndex = -1;
    let best = TOKEN_MATCH_FLOOR;
    for (let index = 0; index < candidate.length; index += 1) {
      if (taken[index]) continue;
      const score = jaroWinkler(word, candidate[index]);
      if (score >= best) {
        best = score;
        bestIndex = index;
      }
    }
    if (bestIndex < 0) continue;
    taken[bestIndex] = true;
    matched += best;
  }
  if (!matched) return 0;
  const queryCoverage = matched / query.length;
  const candidateCoverage = matched / candidate.length;
  return clamp01(
    QUERY_COVERAGE_WEIGHT * queryCoverage + CANDIDATE_COVERAGE_WEIGHT * candidateCoverage,
  );
}

/** Fuzzy word overlap, weighted towards covering the query rather than the candidate. */
export function tokenOverlap(query: string, candidate: string): number {
  return overlapOf(tokenize(query), tokenize(candidate));
}

function prefixScore(query: string, candidate: string): number {
  if (!query || query.length >= candidate.length) return 0;
  if (!candidate.startsWith(query) || candidate[query.length] !== " ") return 0;
  return PREFIX_FLOOR + (1 - PREFIX_FLOOR) * (query.length / candidate.length);
}

function pairScore(query: string, candidate: string): number {
  if (!query || !candidate) return 0;
  if (query === candidate) return 1;
  const overlap = overlapOf(query.split(" "), candidate.split(" "));
  const blended = SIMILARITY_WEIGHT * jaroWinkler(query, candidate) + TOKEN_WEIGHT * overlap;
  return Math.max(blended, overlap * UNORDERED_CEILING, prefixScore(query, candidate));
}

/** 0..1 agreement between what was typed and one candidate name, across scripts. */
export function nameScore(query: string, candidate: string): number {
  const queryName = normalizeName(query);
  const candidateName = normalizeName(candidate);
  if (!queryName || !candidateName) return 0;
  const pairs: Array<[string, string]> = [
    [queryName, candidateName],
    [queryName, normalizeTitle(candidate)],
    [normalizeTitle(query), normalizeTitle(candidate)],
  ];
  let best = 0;
  for (const [left, right] of pairs) {
    best = Math.max(best, pairScore(left, right));
    if (best >= 1) return 1;
  }
  if (hasCyrillic(queryName) !== hasCyrillic(candidateName)) {
    const romanised = pairScore(
      transliterateCyrillic(queryName),
      transliterateCyrillic(candidateName),
    );
    best = Math.max(best, romanised * TRANSLITERATION_PENALTY);
  }
  return clamp01(best);
}

export function popularityFromCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) return 0;
  return clamp01(Math.log10(1 + count) / Math.log10(1 + POPULARITY_COUNT_CEILING));
}

export function popularityFromPercent(percent: number): number {
  return Number.isFinite(percent) ? clamp01(percent / 100) : 0;
}

/**
 * Combined relevance, 0..1, as NAME_WEIGHT * name + POPULARITY_WEIGHT * popularity * gate
 * + KIND_WEIGHT * kind + SOURCE_WEIGHT * source, where gate rises from 0 at
 * POPULARITY_GATE_FLOOR to 1 at a perfect name. Two names equally close to the query are
 * therefore separated by popularity, while a famous name the user did not type stays buried.
 */
export function scoreCandidateParts(input: MusicSearchCandidate): MusicSearchScoreParts {
  const name = nameScore(input.query, input.name);
  const raw = input.popularity === undefined ? DEFAULT_POPULARITY : input.popularity;
  const popularity = clamp01(raw);
  const gate = clamp01((name - POPULARITY_GATE_FLOOR) / (1 - POPULARITY_GATE_FLOOR));
  const kind = input.kind in KIND_PRIOR ? KIND_PRIOR[input.kind] : UNKNOWN_KIND_PRIOR;
  const source = 1 / (1 + Math.max(0, Math.trunc(input.sourceRank ?? 0)));
  const total = clamp01(
    NAME_WEIGHT * name +
      POPULARITY_WEIGHT * popularity * gate +
      KIND_WEIGHT * kind +
      SOURCE_WEIGHT * source,
  );
  return { name, popularity, kind, source, total };
}

export function scoreCandidate(input: MusicSearchCandidate): number {
  return scoreCandidateParts(input).total;
}
