import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useHideAnimeRows } from "@/lib/anime-hide";
import { AWARD_CATALOG, type AwardMeta } from "@/lib/awards-catalog";
import {
  bundledAwardsVersion,
  readAwardHistory,
  subscribeBundledAwards,
  type CategoryHistory,
} from "@/lib/awards-history";
import { peekRankSnapshot } from "@/lib/harbor-rank";
import type { Meta } from "@/lib/cinemeta";
import { getStore } from "@/lib/discover/store";
import { fetchGenreSample, selectDailyRows } from "@/lib/feed";
import { fetchRankList, type HarborRankExplanation } from "@/lib/harbor-rank";
import { CATALOG_REQUEST_TIMEOUT_MS, withTimeout } from "@/lib/progressive-rows";
import type { AwardType } from "@/lib/providers/wikidata";
import { useSettings } from "@/lib/settings";
import { claimUniqueArt, releaseUniqueArt } from "@/lib/unique-art";
import { bpAwardTint } from "./bp-award-mark";

export type BpAwardSummary = {
  type: AwardType;
  title: string;
  shorthand: string;
  tint: string;
  wins: number;
  span: string;
};

export type BpAwardDetail = {
  meta: AwardMeta;
  groups: CategoryHistory[];
  decades: number[];
  wins: number;
  span: string;
};

function spanOf(years: number[]): string {
  if (years.length === 0) return "";
  const lo = Math.min(...years);
  const hi = Math.max(...years);
  return lo === hi ? String(lo) : `${lo} - ${hi}`;
}

// Both memos are keyed on the award table's version, not just on the award
// type. On television the table arrives after the intro, so Discover can render
// while readAwardHistory still answers with nothing. Without the key that empty
// answer was memoised permanently: every summary had wins 0, the filter dropped
// all of them, bpAwardSummaries returned [] for the rest of the session, and
// the Awards band sat empty under a header promising content while `bands`
// still counted it as a row.
const detailMemo = new Map<string, BpAwardDetail>();

export function bpAwardDetail(type: AwardType): BpAwardDetail {
  const memoKey = `${bundledAwardsVersion()}:${type}`;
  const hit = detailMemo.get(memoKey);
  if (hit) return hit;
  const meta = AWARD_CATALOG[type];
  const groups = readAwardHistory(type, meta.categories);
  const years = groups.flatMap((g) => g.entries.map((e) => e.year));
  const decades = [...new Set(years.map((y) => Math.floor(y / 10) * 10))].sort((a, b) => b - a);
  const built: BpAwardDetail = {
    meta,
    groups,
    decades,
    wins: groups.reduce((n, g) => n + g.entries.length, 0),
    span: spanOf(years),
  };
  detailMemo.set(memoKey, built);
  return built;
}

const ORDER: AwardType[] = [
  "oscar",
  "golden_globe",
  "bafta",
  "emmy",
  "sag",
  "critics_choice",
  "bafta_tv",
  "annie",
  "spirit",
  "saturn",
  "cannes",
  "venice",
  "berlin",
  "cesar",
  "goya",
  "blue_dragon",
  "baeksang",
  "bifa",
];

let summaryMemo: BpAwardSummary[] | null = null;
let summaryMemoVersion = -1;

export function bpAwardSummaries(): BpAwardSummary[] {
  const v = bundledAwardsVersion();
  if (summaryMemo && summaryMemoVersion === v) return summaryMemo;
  summaryMemoVersion = v;
  summaryMemo = ORDER.map((type) => {
    const d = bpAwardDetail(type);
    return {
      type,
      title: d.meta.title,
      shorthand: d.meta.shorthand,
      tint: bpAwardTint(type),
      wins: d.wins,
      span: d.span,
    };
  }).filter((s) => s.wins > 0);
  return summaryMemo;
}

export type BpAwardsOverview = { bodies: number; wins: number; span: string };

let overviewMemo: BpAwardsOverview | null = null;
let overviewMemoVersion = -1;

export function bpAwardsOverview(): BpAwardsOverview {
  const v = bundledAwardsVersion();
  if (overviewMemo && overviewMemoVersion === v) return overviewMemo;
  let bodies = 0;
  let wins = 0;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const summary of bpAwardSummaries()) {
    const d = bpAwardDetail(summary.type);
    bodies += 1;
    wins += d.wins;
    for (const group of d.groups) {
      for (const entry of group.entries) {
        if (entry.year < lo) lo = entry.year;
        if (entry.year > hi) hi = entry.year;
      }
    }
  }
  overviewMemoVersion = v;
  overviewMemo = {
    bodies,
    wins,
    span: hi < lo ? "" : lo === hi ? String(lo) : `${lo} - ${hi}`,
  };
  return overviewMemo;
}

export function useBpAwardsOverview(): BpAwardsOverview {
  useSyncExternalStore(subscribeBundledAwards, bundledAwardsVersion, bundledAwardsVersion);
  return bpAwardsOverview();
}

export const BP_GENRES: string[] = [
  "Action",
  "Adventure",
  "Thriller",
  "Crime",
  "Drama",
  "Romance",
  "Mystery",
  "Sci-Fi",
  "Fantasy",
  "Horror",
  "Comedy",
  "Family",
  "Animation",
  "Western",
  "War",
  "History",
  "Documentary",
  "Music",
];

export function useBpGenreArt(genre: string, enabled: boolean): Meta[] {
  const { settings } = useSettings();
  const [art, setArt] = useState<Meta[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let dead = false;
    const key = `bp-genre:${genre}`;
    fetchGenreSample(settings.tmdbKey, genre)
      .then((list) => {
        if (dead) return;
        setArt(
          claimUniqueArt(
            key,
            list.filter((m) => m.background),
            (m) => m.id,
            3,
          ),
        );
      })
      .catch(() => {});
    return () => {
      dead = true;
      releaseUniqueArt(key);
    };
  }, [genre, enabled, settings.tmdbKey]);

  return art;
}

export type BpDiscoverRail = { key: string; name: string; kicker?: string; metas: Meta[] };

const MIN_RAIL = 10;

// The daily shelves overlap heavily, so without a page-wide claim the same
// title fills three rails, which on a ten foot row reads as broken data rather
// than a preference.
function claimRail(batch: Meta[], seen: Set<string>): Meta[] {
  const taken: Meta[] = [];
  const takenIds = new Set<string>();
  for (const m of batch) {
    if (!m.poster || seen.has(m.id) || takenIds.has(m.id)) continue;
    takenIds.add(m.id);
    taken.push(m);
  }
  // A rail stripped to a handful of tiles is worse than a repeat, so a thin one
  // borrows back titles an earlier rail already claimed.
  if (taken.length < MIN_RAIL) {
    for (const m of batch) {
      if (taken.length >= MIN_RAIL) break;
      if (!m.poster || takenIds.has(m.id)) continue;
      takenIds.add(m.id);
      taken.push(m);
    }
  }
  for (const id of takenIds) seen.add(id);
  return taken;
}

export function useBpDiscoverRails(count: number): BpDiscoverRail[] {
  const { settings } = useSettings();
  const [rails, setRails] = useState<BpDiscoverRail[]>([]);

  const defs = useMemo(
    () => selectDailyRows(settings.tmdbKey, getStore().affinity, settings, count),
    [
      settings.tmdbKey,
      settings.region,
      settings.streaming,
      settings.preferredLanguages,
      settings.tmdbLanguage,
      settings.feedLocaleBias,
      settings.uiLanguage,
      count,
    ],
  );

  useEffect(() => {
    let dead = false;
    setRails([]);
    // Fetched together, claimed in order. The old loop awaited each rail before
    // starting the next, so eight rails were eight serial round trips and the
    // last one could not begin until the other seven had come back, on a device
    // where every one of them is a trip over home wifi. The scheduler in
    // tmdb-client already caps concurrency at six, so firing them together
    // hands it the queue it was built to drain rather than starving it.
    //
    // claimRail must still run in defs order or the dedupe is not deterministic
    // and the same title can land in a different rail between runs.
    void (async () => {
      const batches = await Promise.all(
        defs.map((d) =>
          withTimeout(d.fetch(1), CATALOG_REQUEST_TIMEOUT_MS).catch(() => [] as Meta[]),
        ),
      );
      if (dead) return;
      const out: BpDiscoverRail[] = [];
      const seen = new Set<string>();
      for (let i = 0; i < defs.length; i += 1) {
        const metas = claimRail(batches[i], seen);
        if (metas.length === 0) continue;
        const def = defs[i];
        out.push({ key: def.id, name: def.shelf.title, kicker: def.shelf.kicker, metas });
      }
      setRails(out);
    })();
    return () => {
      dead = true;
    };
  }, [defs]);

  return useHideAnimeRows(rails);
}

export function useBpTopPeople(limit: number): HarborRankExplanation[] {
  // Seeded from the snapshot fetchRankList already writes, so the row paints on
  // the first frame instead of after a harbor.site round trip. Desktop has done
  // this since top-people-cta; Big Picture wrote the snapshot and never read it,
  // so a television opened Discover to an empty People row every single time.
  const [people, setPeople] = useState<HarborRankExplanation[]>(() => {
    const snap = peekRankSnapshot("harbor", "Acting", null);
    return snap && snap.source === "harbor" ? snap.list.slice(0, limit) : [];
  });

  useEffect(() => {
    let dead = false;
    fetchRankList("harbor", "Acting", null)
      .then((res) => {
        if (dead || !res || res.source !== "harbor") return;
        setPeople(res.list.slice(0, limit));
      })
      .catch(() => {});
    return () => {
      dead = true;
    };
  }, [limit]);

  return people;
}
