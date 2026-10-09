import {
  COMMON_TITLE_WORDS,
  CURATED_SHOWS,
  FILM_GENRE_NAMES,
  FILM_NAME_STEMS,
  SEQUEL_MARKERS,
} from "./allowlist";

export type RawEpisode = {
  trackId?: number;
  trackName?: string;
  collectionId?: number;
  collectionName?: string;
  trackViewUrl?: string;
  episodeUrl?: string;
  episodeGuid?: string;
  episodeContentType?: string;
  trackTimeMillis?: number;
  releaseDate?: string;
  description?: string;
  shortDescription?: string;
  artworkUrl600?: string;
  artworkUrl160?: string;
  artworkUrl60?: string;
  genres?: Array<{ name?: string }>;
};

export type CriticismEpisode = {
  id: string;
  title: string;
  show: string;
  audioUrl: string;
  pageUrl: string;
  artwork: string;
  minutes: number;
  durationSeconds: number;
  year: number | null;
};

const MIN_MILLIS = 600_000;
const LONG_MILLIS = 1_200_000;
const PER_SHOW = 2;
const KEEP = 6;

const CURATED = CURATED_SHOWS.map(normalize);
const FILM_GENRES = new Set(FILM_GENRE_NAMES);
const STEMS = FILM_NAME_STEMS.map(normalize);
const SEQUELS = new Set(SEQUEL_MARKERS);
const COMMON = new Set(COMMON_TITLE_WORDS);

const OPENERS = "\"'‘“«";
const CLOSERS = "\"'’”»";
const BEFORE_OK = /[\p{Ps}\p{Pi}\p{Pf}\p{Pe}\p{Pd}"'|:,.#/]\s*$/u;
const AFTER_OK = /^[\p{Pe}\p{Pf}\p{Pi}\p{Ps}\p{Pd}"'|,.!?;/&+]/u;
const WORD = /[\p{L}\p{N}]+/gu;

export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function words(value: string): string[] {
  const flat = normalize(value);
  return flat.length === 0 ? [] : flat.split(" ");
}

export function riskyTitle(title: string): boolean {
  const flat = normalize(title);
  if (flat.length === 0) return true;
  if (flat.replace(/ /g, "").length <= 4) return true;
  const parts = flat.split(" ");
  return parts.length <= 2 && parts.every((part) => COMMON.has(part));
}

function curatedShow(name: string): boolean {
  const flat = normalize(name);
  return CURATED.some((entry) => flat === entry || flat.startsWith(`${entry} `));
}

function filmishName(name: string): boolean {
  return words(name).some((word) => STEMS.some((stem) => word.startsWith(stem)));
}

function filmishGenre(genres: RawEpisode["genres"]): boolean {
  return (genres ?? []).some((genre) => FILM_GENRES.has((genre.name ?? "").toLowerCase()));
}

function flatten(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

type Site = { before: string; after: string; colon: boolean; next: string[]; quoted: boolean };

function sites(track: string, title: string): Site[] {
  const needle = words(title);
  if (needle.length === 0) return [];
  const text = flatten(track);
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${needle.map(escape).join("[^\\p{L}\\p{N}]+")}(?![\\p{L}\\p{N}])`,
    "gu",
  );
  const found: Site[] = [];
  for (const hit of text.matchAll(pattern)) {
    const start = hit.index ?? 0;
    const end = start + hit[0].length;
    const before = start > 0 ? text[start - 1]! : "";
    const after = end < text.length ? text[end]! : "";
    const tail = text.slice(end);
    const trimmed = tail.replace(/^\s+/, "");
    const colon = trimmed.startsWith(":");
    const rest = colon ? trimmed.slice(1) : tail;
    found.push({
      before,
      after,
      colon,
      next: (rest.match(WORD) ?? []).slice(0, 3),
      quoted: OPENERS.includes(before) && before !== "" && CLOSERS.includes(after) && after !== "",
    });
  }
  return found;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function releaseYear(episode: RawEpisode): number | null {
  const parsed = Number((episode.releaseDate ?? "").slice(0, 4));
  return Number.isFinite(parsed) && parsed > 1900 ? parsed : null;
}

function minutesOf(millis: number): number {
  return Math.round(millis / 60_000);
}

export function durationLabelOf(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = Math.floor(seconds % 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

function surnamesOf(directors: string[]): string[] {
  const out = new Set<string>();
  for (const director of directors) {
    for (const word of words(director)) if (word.length >= 4) out.add(word);
  }
  return [...out];
}

type Scored = { score: number; sort: string; episode: CriticismEpisode; showKey: string };

export function rankEpisodes(
  raw: RawEpisode[],
  titles: string[],
  year: number | null,
  directors: string[],
): CriticismEpisode[] {
  const needles = titles.map((value) => value.trim()).filter((value) => value.length > 0);
  if (needles.length === 0) return [];
  const surnames = surnamesOf(directors);
  const yearText = year != null ? String(year) : null;
  const scored: Scored[] = [];

  for (const episode of raw) {
    const audioUrl = (episode.episodeUrl ?? "").trim();
    const millis = episode.trackTimeMillis ?? 0;
    const track = episode.trackName ?? "";
    const show = episode.collectionName ?? "";
    if (audioUrl.length === 0 || track.length === 0 || show.length === 0) continue;
    if ((episode.episodeContentType ?? "audio") !== "audio") continue;
    if (millis < MIN_MILLIS) continue;

    const curated = curatedShow(show);
    const byGenre = filmishGenre(episode.genres);
    const byName = filmishName(show);
    if (!curated && !byGenre && !byName) continue;

    const blob = new Set(
      words(`${track} ${episode.description ?? ""} ${episode.shortDescription ?? ""}`),
    );
    const trackWords = new Set(words(track));
    const surnameInTrack = surnames.some((surname) => trackWords.has(surname));
    const surnameAnywhere = surnameInTrack || surnames.some((surname) => blob.has(surname));
    const yearAnywhere = yearText != null && blob.has(yearText);

    let accepted = false;
    let quoted = false;
    for (const needle of needles) {
      const risky = riskyTitle(needle);
      for (const site of sites(track, needle)) {
        if (site.quoted) quoted = true;
        const adjacent = site.after === "" || site.after === " ";
        const next = site.next[0];
        if (adjacent && next !== undefined && SEQUELS.has(next)) continue;
        if (
          adjacent &&
          next !== undefined &&
          /^(19|20)\d\d$/.test(next) &&
          next !== (yearText ?? "")
        )
          continue;
        if (site.colon) {
          if (risky) continue;
          if (next !== undefined && SEQUELS.has(next)) continue;
          if (!surnameAnywhere && !yearAnywhere) continue;
          accepted = true;
          break;
        }
        if (!risky) {
          accepted = true;
          break;
        }
        if (site.quoted) {
          accepted = true;
          break;
        }
        if (yearText != null && next === yearText) {
          accepted = true;
          break;
        }
        const beforeOk = site.before === "" || BEFORE_OK.test(site.before);
        const afterOk = site.after === "" || AFTER_OK.test(site.after);
        if (beforeOk && afterOk) {
          accepted = true;
          break;
        }
        if (beforeOk && site.next.some((word) => surnames.includes(word))) {
          accepted = true;
          break;
        }
      }
      if (accepted) break;
    }
    if (!accepted) continue;

    let score = 0;
    if (curated) score += 8;
    if (byGenre) score += 2;
    if (byName) score += 2;
    if (surnameInTrack) score += 3;
    else if (surnameAnywhere) score += 1;
    if (yearAnywhere) score += 1;
    if (quoted) score += 2;
    if (millis >= LONG_MILLIS) score += 1;

    const seconds = Math.round(millis / 1000);
    scored.push({
      score,
      sort: episode.releaseDate ?? "",
      showKey: normalize(show),
      episode: {
        id: `podcast:${episode.trackId ?? episode.episodeGuid ?? audioUrl}`,
        title: track,
        show,
        audioUrl,
        pageUrl: episode.trackViewUrl ?? "",
        artwork: episode.artworkUrl600 ?? episode.artworkUrl160 ?? episode.artworkUrl60 ?? "",
        minutes: minutesOf(millis),
        durationSeconds: seconds,
        year: releaseYear(episode),
      },
    });
  }

  scored.sort((a, b) => b.score - a.score || b.sort.localeCompare(a.sort));
  const seen = new Set<string>();
  const perShow = new Map<string, number>();
  const kept: CriticismEpisode[] = [];
  for (const entry of scored) {
    const key = `${entry.showKey}|${normalize(entry.episode.title)}`;
    if (seen.has(key) || seen.has(entry.episode.audioUrl)) continue;
    seen.add(key);
    seen.add(entry.episode.audioUrl);
    const used = perShow.get(entry.showKey) ?? 0;
    if (used >= PER_SHOW) continue;
    perShow.set(entry.showKey, used + 1);
    kept.push(entry.episode);
    if (kept.length >= KEEP) break;
  }
  return kept;
}
