import type { LibraryItem } from "@/lib/stremio";
import { decideNextEpisode } from "./decide";
import { canonicalAnimeKey, firstEpisode, stremioCandidates } from "./normalize";
import type { EpisodeCatalog } from "./normalize";
import { candidateToLibraryItem } from "./to-cw";
import type {
  AnimeProgressSkipReason,
  NextEpisodeCandidate,
  NormalizedAnimeProgress,
} from "./types";

/* ------------------------------------------------------------------ */
/* Pure pipeline stages (exported for tests), no network.             */
/* ------------------------------------------------------------------ */

export type MergedGroup = {
  key: string;
  title: string;
  entries: NormalizedAnimeProgress[];
};

export function groupProgress(normalized: NormalizedAnimeProgress[]): MergedGroup[] {
  const map = new Map<string, MergedGroup>();
  for (const p of normalized) {
    const key = canonicalAnimeKey(p.ids, p.titles, p.year);
    const held = map.get(key);
    if (held) {
      held.entries.push(p);
      continue;
    }
    map.set(key, { key, title: p.titles[0] ?? p.key, entries: [p] });
  }
  return [...map.values()];
}

export type GroupDecision =
  | { kind: "entry"; item: LibraryItem; note?: string }
  | { kind: "conflict"; detail: string }
  | { kind: "skip"; reason: AnimeProgressSkipReason };

function pickSkip(outcomes: Array<{ skip: AnimeProgressSkipReason }>): AnimeProgressSkipReason {
  const reasons = new Set(outcomes.map((o) => o.skip));
  if (reasons.has("not-watching")) return "not-watching";
  if (reasons.has("no-mapping")) return "no-mapping";
  if (reasons.has("no-metadata")) return "no-metadata";
  if (reasons.has("unreleased")) return "unreleased";
  if (reasons.has("completed")) return "completed";
  return "no-progress";
}

export function planGroup(
  group: MergedGroup,
  catalog: EpisodeCatalog | null,
  opts: { metaId?: string | null; includeSpecials?: boolean; poster?: string | null } = {},
): GroupDecision {
  if (catalog == null) {
    // No playable metadata could be resolved for any candidate id: skip instead
    // of guessing (Continue Watching rule 6).
    return { kind: "skip", reason: "no-metadata" };
  }
  const outcomes = group.entries.map((p) => ({
    p,
    d: decideNextEpisode({ progress: p, catalog, includeSpecials: opts.includeSpecials }),
  }));
  const nexts = outcomes.filter(
    (o): o is (typeof outcomes)[number] & { d: NextEpisodeCandidate } => !("skip" in o.d),
  );
  if (nexts.length === 0) {
    const reasons = outcomes.map((o) => (o.d as { skip: AnimeProgressSkipReason }).skip);
    // Watching with no episode watched yet: there is no next episode to play,
    // so the entry points at the first episode instead of dropping the show.
    // Finished and unaired shows stay out of Continue Watching, and not-watching,
    // unmapped, or unresolved groups do not belong there at all.
    if (reasons.every((r) => r === "no-progress")) {
      const first = firstEpisode(catalog, { includeSpecials: opts.includeSpecials });
      const metaId = opts.metaId ?? stremioCandidates(group.entries[0].ids)[0] ?? null;
      if (first && metaId) {
        const sources = new Set(group.entries.map((e) => e.source));
        let updatedAt: string | null = null;
        for (const e of group.entries) {
          if (e.updatedAt && (updatedAt == null || Date.parse(e.updatedAt) > Date.parse(updatedAt))) {
            updatedAt = e.updatedAt;
          }
        }
        const item = candidateToLibraryItem({
          season: first.season,
          episode: first.episode,
          kind: "inferred",
          source: sources.size > 1 ? "merged" : group.entries[0].source,
          metaId,
          title: group.title,
          poster: opts.poster,
          updatedAt,
        });
        return {
          kind: "entry",
          item,
          note: "not started (no progress); showing the first episode",
        };
      }
    }
    return {
      kind: "skip",
      reason: pickSkip(outcomes.map((o) => o.d as { skip: AnimeProgressSkipReason })),
    };
  }
  // Providers can disagree about where the user is (MAL and AniList counts drift
  // apart easily, and one can consider a show finished while the other does not).
  // Resolve any disagreement by continuing at the earliest proposed episode:
  // rewatching an episode is recoverable, while a conflict dropped the show from
  // Continue Watching entirely. Skips from individual providers never win while
  // another provider still proposes an episode, and an unaired proposal sorts
  // after an earlier aired one, so it cannot win either.
  const ordered = [...nexts].sort((a, b) => a.d.season - b.d.season || a.d.episode - b.d.episode);
  const cand = ordered[0].d as NextEpisodeCandidate;
  const proposals = new Set(ordered.map((o) => `${o.d.season}:${o.d.episode}`));
  const note =
    proposals.size > 1
      ? `providers disagreed (${ordered
          .map((o) => `S${o.d.season}E${o.d.episode}`)
          .join(", ")}); took the earliest`
      : undefined;
  const sources = new Set(nexts.map((o) => o.p.source));
  const kinds = new Set(nexts.map((o) => o.d.kind));
  const metaId = opts.metaId ?? cand.candidates[0] ?? null;
  if (!metaId) return { kind: "skip", reason: "no-mapping" };
  const item = candidateToLibraryItem({
    season: cand.season,
    episode: cand.episode,
    kind: kinds.has("exact") ? "exact" : "inferred",
    source: sources.size > 1 ? "merged" : cand.source,
    metaId,
    title: cand.title,
    poster: opts.poster,
    updatedAt: cand.updatedAt,
  });
  return { kind: "entry", item, ...(note ? { note } : {}) };
}