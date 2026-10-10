import { sourceDownloadTitle, uniqueSourceDownloadGame } from "./source-download-context";
import type { SourceRelease } from "./sources";
import type { GameSummary } from "./types";
import { sourceNeedsPlatformIdentity, sourcePlatformMatches } from "./source-platform";

export type SourceGameArtwork = { game: GameSummary; match: "exact" | "base" | "artwork" };

/** Editions may borrow a base game's cover, never its download/install identity. */
export function sourceArtworkTitles(title: string): string[] {
  return artworkLookups(title).map(item => item.title);
}

function artworkLookups(title: string, platform?: string): { title: string; match: SourceGameArtwork["match"] }[] {
  const exact = sourceDownloadTitle(title);
  // Tracker part annotations and translated aliases may help find a cover;
  // they must never establish a download/install identity.
  const annotated = exact !== title.trim() ? exact.replace(/\s+\[ч\.\s*\d+\]$/i, "") : exact;
  // Some tracker titles put the translation in parentheses instead of after '/'.
  // Only strip a clearly translated suffix on a packaged release, never editions.
  const translated = annotated !== title.trim() && /\p{Script=Latin}/u.test(annotated)
    ? /^(.*?)\s+\(([^()]*\p{Script=Cyrillic}[^()]*)\)$/u.exec(annotated) : null;
  const aliases = translated && !/\p{Script=Latin}/u.test(translated[2])
    ? [annotated, translated[1], translated[2]] : annotated.split(/\s+\/\s+/);
  const names = annotated !== title.trim() || aliases.some(name => /\p{Script=Cyrillic}/u.test(name)) && aliases.some(name => /\p{Script=Latin}/u.test(name)) ? aliases : [annotated];
  const lookups: { title: string; match: SourceGameArtwork["match"] }[] = [];
  for (const name of names) {
    lookups.push({ title: name, match: name === exact ? "exact" : "artwork" });
    const base = name
      .replace(/\s*[:–—-]\s*(?:collection|complete collection)\s*$/i, "")
      .replace(/(?:\s*[:–—-]\s*|\s+)(?:(?:digital\s+)?deluxe|gold|ultimate|collector['’]?s)\s+edition\s*$/i, "")
      .trim();
    if (base !== name) lookups.push({ title: base, match: "base" });
  }
  if (sourceNeedsPlatformIdentity(platform)) {
    const clean = exact.replace(/^\[(?:PS|PS[1-5]|PSP|NES|SNES|GBA|NDS)(?:-(?:PS|PS[1-5]|PSP))?\]\s*/i, "")
      .replace(/\s*\((?:USA|Europe|Japan|World|Asia|Australia|En(?:,[A-Za-z]{2})*|Rev\s+[^)]+|Disc\s+\d+|Pirate)\)/gi, "")
      .replace(/\s*\[(?:USA|EUR|JPN|RUS|ENG|FULLRUS|PSCD|PAL|NTSC)[^\]]*\]/gi, "").trim();
    if (clean !== exact) lookups.push({title:clean, match:"artwork"});
  }
  return lookups.filter((item, index) => item.title && lookups.findIndex(other => other.title === item.title) === index);
}

export function sourceArtworkCandidates(release: SourceRelease, title: string, candidates: readonly GameSummary[]): GameSummary[] {
  const lookup = { ...release, title, steamId: undefined, igdbId: undefined };
  return candidates.filter(game => !!uniqueSourceDownloadGame(lookup, [game]));
}

/** A dated full-game upload can borrow the only already-released cover, never its install identity. */
function releasedArtwork(release: SourceRelease, candidates: readonly GameSummary[], lookupTitle: string): GameSummary | undefined {
  const year = sourceArtworkYear(release.title);
  if (release.kind === "game" && year && candidates.every(game => game.releaseTimestamp)) {
    const sameYear = candidates.filter(game => new Date(game.releaseTimestamp! * 1000).getUTCFullYear() === year);
    if (sameYear.length === 1) return sameYear[0];
  }
  const uploaded = Date.parse(release.date || "");
  if (release.kind !== "game" || !Number.isFinite(uploaded) || uploaded > Date.now()) return;
  const released = candidates.filter(game => game.steamId && game.comingSoon === false && game.releaseTimestamp && game.releaseTimestamp * 1000 <= uploaded);
  const game = uniqueSourceDownloadGame({ ...release, title: lookupTitle }, released);
  if (!game || candidates.some(item => item.steamId !== game.steamId && item.comingSoon !== true)) return;
  return game;
}

/** Read a year only from release metadata, never a number in the game name. */
export function sourceArtworkYear(title: string): number | undefined {
  const value = /\((19\d{2}|20\d{2})(?:,\s*[^)]+\)|\)\s*(?:PC\b|\(v\.?\d))/i.exec(title)?.[1];
  return value ? Number(value) : undefined;
}

type Providers = {
  search: (title: string, signal: AbortSignal) => Promise<GameSummary[]>;
  linkedSteamId: (signal: AbortSignal) => Promise<number | undefined>;
  linkedGame?: (id: number, signal: AbortSignal) => Promise<GameSummary | undefined>;
};

/** Only a published Steam link resolves duplicate-title identity. Release years/dates resolve artwork only. */
export async function matchSourceArtwork(release: SourceRelease, providers: Providers, signal: AbortSignal): Promise<{ art?: SourceGameArtwork; ambiguous: boolean }> {
  let link: Promise<number | undefined> | undefined;
  const linkedId = () => link ??= providers.linkedSteamId(signal);
  const publishedGame = async () => {
    if (!providers.linkedGame || release.kind !== "game") return;
    const id = await linkedId();
    if (!id) return;
    const game = await providers.linkedGame(id, signal);
    signal.throwIfAborted();
    return game?.steamId === id && sourcePlatformMatches(release.platform, game) ? game : undefined;
  };
  const lookups = artworkLookups(release.title, release.platform);
  const publishedArtwork = (game: GameSummary): SourceGameArtwork => ({
    game, match: lookups.find(lookup => sourceArtworkCandidates(release, lookup.title, [game]).length)?.match ?? "artwork",
  });
  for (const { title, match } of lookups) {
    signal.throwIfAborted();
    let candidates = sourceArtworkCandidates(release, title, await providers.search(title, signal));
    const unaccented = title.normalize("NFKD").replace(/\p{M}/gu, "");
    if (!candidates.length && unaccented !== title) candidates = sourceArtworkCandidates(release, title, await providers.search(unaccented, signal));
    signal.throwIfAborted();
    let game = uniqueSourceDownloadGame({ ...release, title }, candidates);
    if (!game && candidates.length) {
      const linked = await linkedId();
      signal.throwIfAborted();
      if (linked) game = candidates.find(item => item.steamId === linked);
      if (!game && !linked) {
        const cover = releasedArtwork(release, candidates, title);
        if (cover) return { art: { game: cover, match: match === "base" ? "base" : "artwork" }, ambiguous: false };
      }
      if (!game) {
        const published = await publishedGame();
        return published ? { art: publishedArtwork(published), ambiguous: false } : { ambiguous: true };
      }
    }
    if (game) return { art: { game, match }, ambiguous: false };
  }
  // Store search can omit region-restricted, delisted, adult or translated titles.
  // The release's own official app link can still provide their exact identity.
  const published = await publishedGame();
  return { art: published ? publishedArtwork(published) : undefined, ambiguous: false };
}

/** Only official app links count, not unrelated images, IDs in scripts or SteamDB links. */
export function uniqueLinkedSteamId(hrefs: readonly string[]): number | undefined {
  const ids = new Set<number>();
  for (const href of hrefs) {
    try {
      const url = new URL(href);
      if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "store.steampowered.com" || url.username || url.password) continue;
      const id = Number(url.pathname.match(/^\/app\/(\d+)(?:\/|$)/)?.[1]);
      if (Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff) ids.add(id);
    } catch { /* Invalid external links are not evidence. */ }
  }
  return ids.size === 1 ? [...ids][0] : undefined;
}
