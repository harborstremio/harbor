import { useEffect, useMemo, useState } from "react";
import { findLocalSeriesEpisodes, useLocalLibrary, type LocalEntry } from "@/lib/local-library";
import { localTitleKey } from "@/lib/local-library/group-key";
import { listLocalCw, subscribeLocalCw } from "@/lib/local-cw";
import { localToLibraryItem } from "@/lib/continue-watching";
import { cwSortKey, episodeFromVideoId, isCwMember, type LibraryItem } from "@/lib/stremio";
import { isCwDismissed } from "@/lib/cw-dismiss";

/** Matches local-cw's own finished threshold. */
const FINISHED_RATIO = 0.92;
const MAX_CARDS = 20;

export type LocalCwCard = {
  /** Shaped for ContinueCard, exactly as the Home row builds them. */
  item: LibraryItem;
  /** The file on disk this card should play. */
  entry: LocalEntry;
};

/**
 * Every id a local play can be saved under. localPlayerSrc uses
 * `imdbId ?? local:<hash>`, but a play started from a detail page carries that
 * page's meta id instead, which may be a tmdb one.
 */
function playIdsFor(entry: LocalEntry): string[] {
  const out: string[] = [`local:${entry.id}`];
  if (entry.imdbId) out.push(entry.imdbId);
  if (entry.tmdbId != null)
    out.push(`tmdb:${entry.type === "show" ? "tv" : "movie"}:${entry.tmdbId}`);
  return out;
}

function episodeOf(item: LibraryItem): { season: number; episode: number } | null {
  const season = item.state?.season;
  const episode = item.state?.episode;
  if (season != null && episode != null) return { season, episode };
  return episodeFromVideoId(item.state?.video_id);
}

function isFinished(item: LibraryItem): boolean {
  const duration = item.state?.duration ?? 0;
  const offset = item.state?.timeOffset ?? 0;
  return duration > 0 && offset / duration >= FINISHED_RATIO;
}

/**
 * Continue Watching restricted to titles backed by a file on disk. Uses the same
 * store, item shape and membership predicates as the Home row; the only local
 * additions are the on-disk filter and next-episode lookup.
 */
export function useLocalContinueWatching(): LocalCwCard[] {
  const library = useLocalLibrary();
  const [cwVersion, setCwVersion] = useState(0);
  useEffect(() => subscribeLocalCw(() => setCwVersion((v) => v + 1)), []);

  return useMemo(() => {
    void cwVersion;
    const byPlayId = new Map<string, LocalEntry[]>();
    for (const entry of library) {
      for (const id of playIdsFor(entry)) {
        const arr = byPlayId.get(id);
        if (arr) arr.push(entry);
        else byPlayId.set(id, [entry]);
      }
    }
    if (byPlayId.size === 0) return [];

    const eligible = listLocalCw()
      .map(localToLibraryItem)
      .filter(
        (i) =>
          (i.type as string) !== "other" &&
          !i._id.startsWith("iptv:") &&
          byPlayId.has(i._id) &&
          !isCwDismissed(i) &&
          isCwMember(i),
      )
      .map((i) => ({ i, k: cwSortKey(i) }))
      .sort((a, b) => b.k - a.k)
      .map((e) => e.i);

    // One card per title: a series is stored per-episode, so keep only the most
    // recently watched episode of each show (the list is already sorted).
    const seenTitle = new Set<string>();
    const out: LocalCwCard[] = [];
    for (const item of eligible) {
      const candidates = byPlayId.get(item._id) ?? [];
      const ep = item.type === "movie" ? null : episodeOf(item);
      let entry =
        ep == null
          ? candidates[0]
          : (candidates.find((c) => c.season === ep.season && c.episode === ep.episode) ??
            candidates[0]);
      if (!entry) continue;

      const titleKey = localTitleKey(entry);
      if (seenTitle.has(titleKey)) continue;

      let card = item;
      if (entry.type === "show" && isFinished(item)) {
        // Advance to the next episode that actually exists on disk. Deliberately
        // not useCwAdvance, which resolves episode lists over TMDB and cannot
        // handle a `local:` id.
        const next = nextLocalEpisode(entry);
        if (!next) continue;
        entry = next;
        card = {
          ...item,
          state: {
            ...item.state,
            duration: item.state?.duration ?? 0,
            timeOffset: 0,
            season: next.season ?? undefined,
            episode: next.episode ?? undefined,
            video_id: `${item._id}:${next.season ?? 0}:${next.episode ?? 0}`,
            flaggedWatched: 0,
          },
          upNext: true,
        };
      }

      seenTitle.add(titleKey);
      out.push({ item: card, entry });
      if (out.length >= MAX_CARDS) break;
    }
    return out;
  }, [library, cwVersion]);
}

function nextLocalEpisode(current: LocalEntry): LocalEntry | null {
  const episodes = findLocalSeriesEpisodes(current.tmdbId, current.imdbId);
  if (episodes.length === 0) return null;
  const season = current.season ?? 0;
  const episode = current.episode ?? 0;
  return (
    episodes.find(
      (e) => (e.season ?? 0) > season || ((e.season ?? 0) === season && (e.episode ?? 0) > episode),
    ) ?? null
  );
}
