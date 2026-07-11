import {
  animeSeedGenres,
  buildExclusion,
  dayIndex,
  finishedFranchises,
  pageFor,
  rankPicks,
  recordShownPicks,
  scorePick,
  type PickEntry,
  type PickSource,
} from "@/lib/anime-top-picks-utils";
import type { Meta } from "@/lib/cinemeta";
import { subscribe as subscribeTaste } from "@/lib/discover/store";
import { getDownvotedIds, getUpvotedIds, subscribePrefs } from "@/lib/feed/preferences";
import { recentlyPlayed, subscribePlayback, watchTitleKey } from "@/lib/playback-history";
import {
  animeFranchiseKey,
  jikanByGenre,
  jikanNewReleases,
  jikanTopAiring,
  jikanTopAnime,
  jikanTopPopular,
  stripFranchiseSuffix,
} from "@/lib/providers/jikan";
import { kitsuRelated, parseKitsuId } from "@/lib/providers/kitsu";
import type { LibraryItem } from "@/lib/stremio";
import { malIdForItem } from "@/lib/use-watch-history-recs";
import { useEffect, useRef, useState } from "react";

const CAP = 24;
const SEQUEL_ROLES = new Set(["sequel", "side_story", "parent_story", "spinoff", "spin_off"]);
const VISIT_KEY = "harbor.anime.toppicks.visit.v1";
const CACHE_KEY = "harbor.anime.toppicks.cache.v1";

function nextVisit(): number {
  try {
    const cur = Number(localStorage.getItem(VISIT_KEY) ?? "0");
    const next = (Number.isFinite(cur) ? cur : 0) + 1;
    localStorage.setItem(VISIT_KEY, String(next));
    return next;
  } catch {
    return Math.floor(Math.random() * 1000);
  }
}

function readCachedPicks(): Meta[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Meta[];
    if (!Array.isArray(arr)) return [];
    const watched = recentlyPlayed();
    const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
    return arr
      .filter((m) => m && typeof m.id === "string" && typeof m.name === "string")
      .filter((m) => !blocked.has(m.id))
      .filter((m) => !watched.ids.has(m.id) && !watched.titles.has(watchTitleKey(m.name)))
      .slice(0, CAP);
  } catch {
    return [];
  }
}

function writeCachedPicks(metas: Meta[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(metas.slice(0, CAP)));
  } catch {}
}

function cleanName(m: Meta): Meta {
  const name = stripFranchiseSuffix(m.name);
  return name === m.name ? m : { ...m, name };
}

async function sequelMetas(seeds: LibraryItem[]): Promise<Meta[]> {
  const lists = await Promise.all(
    seeds.slice(0, 6).map(async (item) => {
      try {
        const malId = await malIdForItem(item);
        if (!malId) return [] as Meta[];
        const kitsuId = parseKitsuId(item._id);
        if (kitsuId == null) return [] as Meta[];
        const related = await kitsuRelated(kitsuId);
        return related.filter((rel) => SEQUEL_ROLES.has(rel.role)).map((rel) => rel.meta);
      } catch {
        return [] as Meta[];
      }
    }),
  );
  return lists.flat();
}

export function useAnimeTopPicks(input: {
  libItems: LibraryItem[];
  continueWatching: LibraryItem[];
  heroMetas: Meta[];
  watchHistoryRecs: Meta[];
  favoriteGenres: number[];
}): Meta[] {
  const { libItems, continueWatching, heroMetas, watchHistoryRecs, favoriteGenres } = input;
  const [picks, setPicks] = useState<Meta[]>(() => readCachedPicks());
  const [version, setVersion] = useState(0);
  const seedRef = useRef<number>(dayIndex() * 1000 + nextVisit());
  const picksRef = useRef(picks);
  picksRef.current = picks;

  useEffect(() => {
    let timer = 0;
    const bump = () => {
      clearTimeout(timer);
      timer = window.setTimeout(() => setVersion((v) => v + 1), 600);
    };
    const dropWatched = () => {
      const watched = recentlyPlayed();
      if (watched.ids.size === 0 && watched.titles.size === 0) return;
      setPicks((prev) => {
        const next = prev.filter((m) => !watched.ids.has(m.id) && !watched.titles.has(watchTitleKey(m.name)));
        return next.length === prev.length ? prev : next;
      });
    };
    const offTaste = subscribeTaste(bump);
    const offPlayback = subscribePlayback(() => {
      dropWatched();
      bump();
    });
    const offPrefs = subscribePrefs(() => {
      const blocked = new Set<string>([...getDownvotedIds(), ...getUpvotedIds()]);
      setPicks((prev) => prev.filter((m) => !blocked.has(m.id)));
      bump();
    });
    return () => {
      clearTimeout(timer);
      offTaste();
      offPlayback();
      offPrefs();
    };
  }, []);

  const finishedKey = finishedFranchises(libItems)
    .seeds.map((s) => s._id)
    .join(",");
  const cwKey = continueWatching.map((i) => i._id).join(",");
  const recsKey = watchHistoryRecs.map((m) => m.id).join(",");
  const genreKey = favoriteGenres.join(",");

  useEffect(() => {
    let cancelled = false;
    const seed = seedRef.current;
    (async () => {
      const genres = animeSeedGenres(favoriteGenres);
      const { seeds } = finishedFranchises(libItems);
      const pageSeed = dayIndex();
      const [airing, fresh, ...genreLists] = await Promise.all([
        jikanTopAiring(pageFor("airing", pageSeed)).catch(() => [] as Meta[]),
        jikanNewReleases(pageFor("new", pageSeed)).catch(() => [] as Meta[]),
        ...genres.map((id) => jikanByGenre(id, pageFor(`g${id}`, pageSeed)).catch(() => [] as Meta[])),
      ]);
      if (cancelled) return;
      const recs = watchHistoryRecs;

      const { skip } = buildExclusion({ heroMetas, continueWatching, libItems });
      const byFranchise = new Map<string, PickEntry>();
      const add = (m: Meta, source: PickSource, idx = 0, len = 0) => {
        if (skip(m)) return;
        const fk = animeFranchiseKey(m.name);
        const s = scorePick(m, source, idx, len);
        const existing = byFranchise.get(fk);
        if (existing) existing.score += s;
        else byFranchise.set(fk, { meta: cleanName(m), score: s });
      };

      for (let i = 0; i < recs.length; i++) add(recs[i], "rec", i, recs.length);
      const maxGenre = Math.max(0, ...genreLists.map((l) => l.length));
      for (let i = 0; i < maxGenre; i++) {
        for (const list of genreLists) if (list[i]) add(list[i], "genre");
      }
      for (const m of fresh) add(m, "new");
      for (const m of airing) add(m, "airing");

      if (picksRef.current.length === 0 && byFranchise.size > 0) {
        setPicks(rankPicks(byFranchise, seed, CAP));
      }

      const sequels = await sequelMetas(seeds);
      if (cancelled) return;
      for (let i = 0; i < sequels.length; i++) add(sequels[i], "sequel");

      if (picksRef.current.length === 0 && byFranchise.size > 0) {
        setPicks(rankPicks(byFranchise, seed, CAP));
      }

      let page = 2;
      while (byFranchise.size < CAP && page <= 5) {
        if (cancelled) return;
        const more = await Promise.all([
          ...genres.map((id) => jikanByGenre(id, page).catch(() => [] as Meta[])),
          page === 2 ? jikanTopAnime(1).catch(() => [] as Meta[]) : Promise.resolve([]),
          page === 3 ? jikanTopPopular(1).catch(() => [] as Meta[]) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        for (const list of more) for (const m of list) add(m, "top");
        page++;
      }

      if (byFranchise.size < CAP) {
        const floor = await jikanTopAiring(1).catch(() => [] as Meta[]);
        if (cancelled) return;
        const watched = recentlyPlayed();
        for (const m of floor) {
          if (byFranchise.size >= CAP) break;
          const fk = animeFranchiseKey(m.name);
          if (byFranchise.has(fk)) continue;
          if (watched.ids.has(m.id) || watched.titles.has(watchTitleKey(m.name))) continue;
          byFranchise.set(fk, { meta: cleanName(m), score: scorePick(m, "airing") });
        }
      }

      const ranked = rankPicks(byFranchise, seed, CAP);
      recordShownPicks(ranked.map((m) => animeFranchiseKey(m.name)));
      if (!cancelled) {
        setPicks(ranked);
        writeCachedPicks(ranked);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, finishedKey, cwKey, recsKey, genreKey]);

  return picks;
}
