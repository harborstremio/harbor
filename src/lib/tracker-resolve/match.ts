import type { EpisodeCandidate, EpisodeIdentity, SeasonListing } from "./types";

const DIACRITICS = /[\u0300-\u036f]/g;
const GENERIC_TITLES = [
  /^episode\s*\d+$/,
  /^part\s*\d+$/,
  /^chapter\s*\d+$/,
  /^special\b/,
];

export const DATE_WINDOW_DAYS = 3;

export function normalizeTitle(value?: string | null): string {
  if (!value) return "";
  const folded = value.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
  const stripped = folded.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  return stripped.startsWith("the ") ? stripped.slice(4) : stripped;
}

export function isDistinctiveTitle(value?: string | null): boolean {
  const normalized = normalizeTitle(value);
  if (normalized.length < 4) return false;
  return !GENERIC_TITLES.some((pattern) => pattern.test(normalized));
}

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const normalized = value.length === 10 ? `${value}T00:00:00Z` : value;
  const time = Date.parse(normalized);
  return Number.isFinite(time) ? time : null;
}

export function daysBetween(a?: string | null, b?: string | null): number | null {
  const left = parseTime(a);
  const right = parseTime(b);
  if (left == null || right == null) return null;
  return Math.abs(left - right) / 86_400_000;
}

// An episode's own external id is the tracker's identifier for that exact episode,
// so it outranks every heuristic: Cinemeta ships the same tvdb/imdb episode id the
// tracker does for the shows whose season numbering disagrees.
function sameEpisodeId(identity: EpisodeIdentity, candidate: EpisodeCandidate): boolean {
  if (identity.episodeTvdbId != null && candidate.tvdbId != null) {
    return identity.episodeTvdbId === candidate.tvdbId;
  }
  if (identity.episodeImdbId && candidate.imdbId) {
    return identity.episodeImdbId === candidate.imdbId;
  }
  return false;
}

export function hasComparableSignal(
  identity: EpisodeIdentity,
  candidate: EpisodeCandidate,
): boolean {
  if (sameEpisodeId(identity, candidate)) return true;
  if (daysBetween(identity.airDate, candidate.airDate) != null) return true;
  return isDistinctiveTitle(identity.name) && isDistinctiveTitle(candidate.title);
}

// Both sides carry an id for the same scheme and they disagree: this is a different
// episode, so no date or title heuristic may rescue it.
function conflictingEpisodeId(identity: EpisodeIdentity, candidate: EpisodeCandidate): boolean {
  if (identity.episodeTvdbId != null && candidate.tvdbId != null) {
    return identity.episodeTvdbId !== candidate.tvdbId;
  }
  if (identity.episodeImdbId && candidate.imdbId) {
    return identity.episodeImdbId !== candidate.imdbId;
  }
  return false;
}

export function episodeMatches(identity: EpisodeIdentity, candidate: EpisodeCandidate): boolean {
  if (sameEpisodeId(identity, candidate)) return true;
  if (conflictingEpisodeId(identity, candidate)) return false;
  const delta = daysBetween(identity.airDate, candidate.airDate);
  if (delta != null) return delta <= DATE_WINDOW_DAYS;
  if (!isDistinctiveTitle(identity.name) || !isDistinctiveTitle(candidate.title)) return false;
  return normalizeTitle(identity.name) === normalizeTitle(candidate.title);
}

export function yearFromDate(value?: string | null): number | null {
  const time = parseTime(value);
  if (time == null) return null;
  return new Date(time).getUTCFullYear();
}

// Specials are often catalogued as movies whose title contains the episode title, so
// containment plus a year gate is the rule here rather than title equality.
export function movieMatches(
  identity: EpisodeIdentity,
  candidate: { title?: string | null; year?: number | null },
): boolean {
  if (!isDistinctiveTitle(identity.name)) return false;
  const episodeName = normalizeTitle(identity.name);
  const movieTitle = normalizeTitle(candidate.title);
  if (!movieTitle) return false;
  if (movieTitle !== episodeName && !movieTitle.includes(episodeName)) return false;
  const airYear = yearFromDate(identity.airDate);
  if (airYear == null) return true;
  // Undated candidates cannot be confirmed; title alone would let a documentary win.
  if (candidate.year == null) return false;
  return Math.abs(airYear - candidate.year) <= 1;
}

export function seasonSearchOrder(target: number): number[] {
  const order: number[] = [];
  const push = (value: number) => {
    if (value >= 0 && !order.includes(value)) order.push(value);
  };
  push(target);
  push(1);
  push(0);
  for (let distance = 1; distance <= 5; distance += 1) {
    push(target - distance);
    push(target + distance);
  }
  return order;
}

function orderedCandidates(
  identity: EpisodeIdentity,
  seasons: SeasonListing[],
): Array<{ season: number; candidate: EpisodeCandidate }> {
  const byNumber = new Map(seasons.map((season) => [season.number, season]));
  const ordered: Array<{ season: number; candidate: EpisodeCandidate }> = [];
  for (const seasonNumber of seasonSearchOrder(identity.season)) {
    const season = byNumber.get(seasonNumber);
    if (!season) continue;
    for (const candidate of season.episodes) ordered.push({ season: seasonNumber, candidate });
  }
  return ordered;
}

// The episode's own external id is the tracker's identifier for that exact episode, so it
// wins wherever it sits in the search order - and for the caller, wherever it sits in the
// candidate set: a nearer show's date-window guess must not pre-empt it.
export function findExactEpisodeInSeasons(
  identity: EpisodeIdentity,
  seasons: SeasonListing[],
): { season: number; number: number } | null {
  for (const { season, candidate } of orderedCandidates(identity, seasons)) {
    if (sameEpisodeId(identity, candidate)) return { season, number: candidate.number };
  }
  return null;
}

export function findEpisodeInSeasons(
  identity: EpisodeIdentity,
  seasons: SeasonListing[],
): { season: number; number: number } | null {
  const ordered = orderedCandidates(identity, seasons);

  for (const { season, candidate } of ordered) {
    if (sameEpisodeId(identity, candidate)) return { season, number: candidate.number };
  }

  // Same-day batches are normal here - a 2026 Grand Tour entry can hold several episodes
  // all dated the same day - so a tie is not ambiguity to be refused. First match in
  // season order stays the fallback, exactly as before ids were given priority.
  for (const { season, candidate } of ordered) {
    if (episodeMatches(identity, candidate)) return { season, number: candidate.number };
  }
  return null;
}

export function hasAnyComparableSignal(
  identity: EpisodeIdentity,
  seasons: SeasonListing[],
): boolean {
  for (const season of seasons) {
    for (const candidate of season.episodes) {
      if (hasComparableSignal(identity, candidate)) return true;
    }
  }
  return false;
}
