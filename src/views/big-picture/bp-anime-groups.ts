import { createAddonCatalogFetcher, isCollectionCatalog, normalizeName, type AddonRow } from "@/lib/addons";
import { isAdultAnime } from "@/lib/addons-store/adult-filter";
import { awardFranchiseKey, uniqueWinnerFranchisesAcrossSources } from "@/lib/anime-awards";
import type { Meta } from "@/lib/cinemeta";
import type { Collection } from "@/lib/collections";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";
import type { LibraryItem } from "@/lib/stremio";
import type { AnilistRail } from "@/lib/use-anilist-anime-rails";
import type { AwardWinnerEntry } from "@/lib/use-crunchyroll-award-metas";
import type { MalRail } from "@/lib/use-mal-anime-rails";
import type { HomeRow } from "@/views/home/home-types";
import { EMPTY_ROW, SPECS, TOP_PICKS_KEY, type RowPool, type RowState } from "@/views/anime/anime-rows";

const RANK_CAP = 10;

export type BpAnimeRow = {
  id: string;
  group: string;
  title: string;
  metas: Meta[];
  cwItems?: LibraryItem[];
  /** Draw the row as desktop's numbered Top 10 rather than as plain posters. */
  ranked?: boolean;
  notice?: string;
  loading?: boolean;
  source?: HomeRow;
};

export type BpAnimeGroup = { key: string; name: string; rows: BpAnimeRow[] };

export type BpAnimeAwardWinner = { meta: Meta; year: number };

export type BpListState = { loading: boolean; error: boolean };

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export function cleanMeta(m: Meta): Meta {
  const cleaned = stripFranchiseSuffix(m.name);
  return cleaned === m.name ? m : { ...m, name: cleaned };
}

// Hero franchises are deliberately not seeded here. The Big Picture hero is a
// non-interactive billboard, so dropping its titles from the rows would leave
// them displayed and unreachable by any input.
export function filterSpecRows(
  rowsByKey: Record<string, RowState>,
  topPicks: Meta[],
): Record<string, RowState> {
  const seeded = new Set<string>();
  for (const m of topPicks) seeded.add(animeFranchiseKey(m.name));
  const pools: Record<RowPool, Set<string>> = {
    general: new Set(seeded),
    era: new Set(seeded),
    genre: new Set(seeded),
  };
  const out: Record<string, RowState> = {};
  for (const spec of SPECS) {
    const row = rowsByKey[spec.key];
    if (!row) {
      out[spec.key] = EMPTY_ROW;
      continue;
    }
    if (spec.key === "upcoming" || !row.ready) {
      out[spec.key] = row;
      continue;
    }
    const seen = pools[spec.pool ?? "general"];
    const metas: Meta[] = [];
    for (const m of row.metas) {
      const fk = animeFranchiseKey(m.name);
      if (seen.has(fk)) continue;
      seen.add(fk);
      metas.push(cleanMeta(m));
    }
    out[spec.key] = { ...row, metas };
  }
  return out;
}

export function mergeAwardWinners(
  rowsByKey: Record<string, RowState>,
  entries: AwardWinnerEntry[],
): BpAnimeAwardWinner[] {
  const winByKey = uniqueWinnerFranchisesAcrossSources();
  const resolved = new Map<string, Meta>();
  for (const e of entries) resolved.set(awardFranchiseKey(e.meta.name), e.meta);
  const seen = new Set<string>();
  const out: BpAnimeAwardWinner[] = [];
  for (const spec of SPECS) {
    const r = rowsByKey[spec.key];
    if (!r?.ready) continue;
    for (const m of r.metas) {
      const fk = awardFranchiseKey(m.name);
      if (seen.has(fk)) continue;
      const win = winByKey.get(fk);
      if (!win) continue;
      seen.add(fk);
      out.push({ meta: cleanMeta(resolved.get(fk) ?? m), year: win.year });
    }
  }
  for (const e of entries) {
    const fk = awardFranchiseKey(e.meta.name);
    if (seen.has(fk)) continue;
    seen.add(fk);
    out.push({ meta: cleanMeta(e.meta), year: e.win.year });
  }
  out.sort((a, b) => b.year - a.year);
  return out;
}

export function dedupeAnimeAddonRows(rows: AddonRow[], hideAdult: boolean): AddonRow[] {
  const seen = new Set<string>();
  for (const s of SPECS) seen.add(normalizeName(s.title, "anime"));
  const out: AddonRow[] = [];
  for (const r of rows) {
    const key = normalizeName(r.name, "anime");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hideAdult ? { ...r, metas: r.metas.filter((m) => !isAdultAnime(m)) } : r);
  }
  return out;
}

export type BpAnimeGroupInput = {
  t: Translate;
  renamed: Record<string, string>;
  cwItems: LibraryItem[];
  cwReady: boolean;
  cwPending: boolean;
  malConnected: boolean;
  malRails: MalRail[];
  malState: BpListState;
  anilistConnected: boolean;
  anilistRails: AnilistRail[];
  anilistState: BpListState;
  anilistTrending: Meta[];
  anilistTop: Meta[];
  awards: BpAnimeAwardWinner[];
  specRows: Record<string, RowState>;
  addonRows: AddonRow[];
  collections: Collection[];
};

export function buildBpAnimeGroups(input: BpAnimeGroupInput): BpAnimeGroup[] {
  const { t, renamed } = input;
  const named = (key: string, fallback: string) => renamed[key] ?? fallback;
  const out: BpAnimeGroup[] = [];
  const push = (key: string, name: string, rows: BpAnimeRow[]) => {
    if (rows.length > 0) out.push({ key, name, rows });
  };

  const cwName = named("continueWatching", t("Continue Watching"));
  if (input.cwItems.length > 0 || input.cwPending) {
    push("continueWatching", cwName, [
      {
        id: "continueWatching",
        group: "continueWatching",
        title: cwName,
        metas: [],
        cwItems: input.cwReady ? input.cwItems : [],
        loading: !input.cwReady,
      },
    ]);
  }

  const malName = named("yourMalLists", t("Your MAL Lists"));
  push(
    "yourMalLists",
    malName,
    listRows({
      connected: input.malConnected,
      state: input.malState,
      group: "yourMalLists",
      title: malName,
      offline: t("Connect MyAnimeList in Harbor on your computer to see your lists here."),
      empty: t("No entries on your MyAnimeList lists yet."),
      failed: t("Couldn't reach MyAnimeList. Check the connection and reopen Big Picture."),
      rows: input.malRails.map((rail) => ({
        id: `mal:${rail.key}`,
        group: "yourMalLists",
        title: t("Your MAL: {name}", { name: rail.title }),
        metas: rail.metas,
      })),
    }),
  );

  const anilistName = named("yourAnilistLists", t("Your Lists"));
  push(
    "yourAnilistLists",
    anilistName,
    listRows({
      connected: input.anilistConnected,
      state: input.anilistState,
      group: "yourAnilistLists",
      title: anilistName,
      offline: t("Connect AniList in Harbor on your computer to see your lists here."),
      empty: t("No entries on your AniList lists yet."),
      failed: t("Couldn't reach AniList. Check the connection and reopen Big Picture."),
      rows: input.anilistRails.map((rail) => ({
        id: `anilist:${rail.key}`,
        group: "yourAnilistLists",
        title:
          rail.key === "recommended"
            ? t("Recommended for you")
            : t("Your AniList: {name}", { name: rail.title }),
        metas: rail.metas,
      })),
    }),
  );

  if (input.anilistTrending.length > 0) {
    push("anilistTrending", named("anilistTrending", t("Trending")), [
      {
        id: "anilistTrending",
        group: "anilistTrending",
        title: t("Trending on AniList"),
        metas: input.anilistTrending,
      },
    ]);
  }

  if (input.anilistTop.length > 0) {
    push("anilistTop100", named("anilistTop100", t("Top 100")), [
      {
        id: "anilistTop100",
        group: "anilistTop100",
        title: t("Top 100 on AniList"),
        metas: input.anilistTop,
      },
    ]);
  }

  // The award index fills through a slow serial crawl, so the row arrives with
  // winners rather than sitting as a skeleton that may never resolve.
  if (input.awards.length > 0) {
    const awardName = named("awards", t("Award Winning Anime"));
    push("awards", awardName, [
      {
        id: "awards",
        group: "awards",
        title: awardName,
        metas: input.awards.map((a) => a.meta),
      },
    ]);
  }

  for (const spec of SPECS) {
    if (spec.key === TOP_PICKS_KEY) continue;
    const r = input.specRows[spec.key] ?? EMPTY_ROW;
    if (r.ready && r.metas.length === 0) continue;
    const specName = named(spec.key, t(spec.title));
    const ranked = Boolean(spec.rank) && r.metas.length >= RANK_CAP;
    const title = ranked
      ? t("Top 10 {name}", { name: specName.replace(/^Top\s*/i, "") })
      : specName;
    const metas = ranked ? r.metas.slice(0, RANK_CAP) : r.metas;
    push(spec.key, title, [
      {
        id: spec.key,
        group: spec.key,
        title,
        metas,
        loading: !r.ready,
        ranked,
        source: ranked
          ? undefined
          : {
              key: `anime:${spec.key}`,
              type: "series",
              name: title,
              metas,
              page: r.page,
              hasMore: r.hasMore,
              noDedup: true,
              fetcher: (p) => spec.fetcher(p).then((ms) => ms.map(cleanMeta)),
            },
      },
    ]);
  }

  for (const row of input.addonRows) {
    if (row.metas.length === 0) continue;
    const key = `addon:${row.key}`;
    const name = named(key, row.name);
    const collection = isCollectionCatalog({ type: row.type, id: row.more?.id, name: row.name });
    const origin = row.metas[0]?.addonOrigin;
    const map = (m: Meta): Meta => ({
      ...cleanMeta(m),
      ...(origin ? { addonOrigin: origin } : null),
      ...(collection ? { isCollection: true } : null),
    });
    const metas = row.metas.map(map);
    push(key, name, [
      {
        id: key,
        group: key,
        title: name,
        metas,
        source: row.more
          ? {
              key: `anime:${key}`,
              type: "series",
              name,
              metas,
              page: 1,
              hasMore: true,
              noDedup: true,
              fetcher: createAddonCatalogFetcher(row.more, {
                initialPageSize: row.metas.length,
                mapMeta: map,
              }),
            }
          : undefined,
      },
    ]);
  }

  for (const c of input.collections) {
    if (c.items.length === 0) continue;
    const key = `collection-${c.id}`;
    const name = named(key, c.name);
    push(key, name, [
      {
        id: key,
        group: key,
        title: name,
        metas: c.items.map((it) => ({
          id: it.id,
          type: it.type,
          name: it.name,
          poster: it.poster,
        })),
      },
    ]);
  }

  return out;
}

function listRows(input: {
  connected: boolean;
  state: BpListState;
  group: string;
  title: string;
  offline: string;
  empty: string;
  failed: string;
  rows: BpAnimeRow[];
}): BpAnimeRow[] {
  const notice = (suffix: string, text: string): BpAnimeRow[] => [
    { id: `${input.group}:${suffix}`, group: input.group, title: input.title, metas: [], notice: text },
  ];
  if (!input.connected) return notice("offline", input.offline);
  if (input.rows.length > 0) return input.rows;
  if (input.state.loading) {
    return [
      { id: `${input.group}:loading`, group: input.group, title: input.title, metas: [], loading: true },
    ];
  }
  if (input.state.error) return notice("failed", input.failed);
  return notice("empty", input.empty);
}
