import kobeIcon from "@/assets/awards/animation-kobe.svg";
import crunchyrollIconFull from "@/assets/awards/crunchyroll-awards-full.png";
import crunchyrollIcon from "@/assets/awards/crunchyroll-awards.png";
import jmafIcon from "@/assets/awards/japan-media-arts.webp";
import jmafIconSmall from "@/assets/awards/jmaf-icon.png";
import rAnimeIcon from "@/assets/awards/r-anime-awards.png";
import rAnimeIconSmall from "@/assets/awards/r-anime-icon.png";
import taafIconSmall from "@/assets/awards/taaf-icon.png";
import taafIcon from "@/assets/awards/taaf.png";
import kobeData from "@/data/animation-kobe-awards.json";
import crunchyrollData from "@/data/crunchyroll-awards.json";
import jmafData from "@/data/japan-media-arts-awards.json";
import rAnimeData from "@/data/r-anime-awards.json";
import taafData from "@/data/taaf-awards.json";
import { animeFranchiseKey, stripFranchiseSuffix } from "@/lib/providers/jikan";

export type AwardSourceId = "crunchyroll" | "taaf" | "jmaf" | "r_anime" | "animation_kobe";

export type AwardWin = {
  source: AwardSourceId;
  year: number;
  categoryKey: string;
  categoryName: string;
  title: string;
  isAOTY: boolean;
};

type Raw = {
  categories: Record<string, { name: string; winners: { year: number; title: string }[] }>;
};

const AOTY_KEYS: Record<AwardSourceId, ReadonlySet<string>> = {
  crunchyroll: new Set(["anime_of_the_year"]),
  taaf: new Set(["anime_of_the_year"]),
  jmaf: new Set(["grand_prize"]),
  r_anime: new Set(["anime_of_the_year"]),
  animation_kobe: new Set(["best_film", "best_tv"]),
};

const SOURCE_META: Record<
  AwardSourceId,
  {
    id: AwardSourceId;
    name: string;
    shortName: string;
    /** Long-form logo, used in the detail-page corner + AwardsBlock */
    icon: string;
    /** Square favicon-ish mark, used in compact badges. Falls back to `icon`. */
    iconSmall: string;
    /** Bonus added to a win's score: higher = badge wins ties */
    prestige: number;
  }
> = {
  crunchyroll: {
    id: "crunchyroll",
    name: "Crunchyroll Anime Awards",
    shortName: "CR",
    icon: crunchyrollIconFull,
    iconSmall: crunchyrollIcon,
    prestige: 100,
  },
  taaf: {
    id: "taaf",
    name: "Tokyo Anime Award Festival",
    shortName: "TAAF",
    icon: taafIcon,
    iconSmall: taafIconSmall,
    prestige: 95,
  },
  jmaf: {
    id: "jmaf",
    name: "Japan Media Arts Festival",
    shortName: "JMAF",
    icon: jmafIcon,
    iconSmall: jmafIconSmall,
    prestige: 90,
  },
  r_anime: {
    id: "r_anime",
    name: "r/anime Awards",
    shortName: "r/anime",
    icon: rAnimeIcon,
    iconSmall: rAnimeIconSmall,
    prestige: 70,
  },
  animation_kobe: {
    id: "animation_kobe",
    name: "Animation Kobe",
    shortName: "Kobe",
    icon: kobeIcon,
    iconSmall: kobeIcon,
    prestige: 60,
  },
};

export function awardSourceMeta(id: AwardSourceId) {
  return SOURCE_META[id];
}

export function allAwardSources(): AwardSourceId[] {
  return Object.keys(SOURCE_META) as AwardSourceId[];
}

export type AnimeAwardCategory = {
  key: string;
  name: string;
  isAOTY: boolean;
  winners: Array<{ year: number; title: string }>;
};

export function readAnimeAwardSource(source: AwardSourceId): {
  meta: (typeof SOURCE_META)[AwardSourceId];
  categories: AnimeAwardCategory[];
  years: number[];
} {
  const entry = SOURCES.find((s) => s.id === source);
  const data = entry?.data;
  const aotyKeys = AOTY_KEYS[source];
  const categories: AnimeAwardCategory[] = [];
  const yearSet = new Set<number>();
  if (data) {
    for (const [key, bucket] of Object.entries(data.categories ?? {})) {
      const winners = [...bucket.winners].sort((a, b) => b.year - a.year);
      for (const w of winners) yearSet.add(w.year);
      categories.push({
        key,
        name: bucket.name,
        isAOTY: aotyKeys.has(key),
        winners,
      });
    }
    categories.sort((a, b) => {
      if (a.isAOTY !== b.isAOTY) return a.isAOTY ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }
  return {
    meta: SOURCE_META[source],
    categories,
    years: [...yearSet].sort((a, b) => b - a),
  };
}

const SOURCES: { id: AwardSourceId; data: Raw }[] = [
  { id: "crunchyroll", data: crunchyrollData as Raw },
  { id: "taaf", data: taafData as Raw },
  { id: "jmaf", data: jmafData as Raw },
  { id: "r_anime", data: rAnimeData as Raw },
  { id: "animation_kobe", data: kobeData as Raw },
];

const INDEX: Map<string, AwardWin[]> = (() => {
  const out = new Map<string, AwardWin[]>();
  for (const { id, data } of SOURCES) {
    const aotyKeys = AOTY_KEYS[id];
    for (const [categoryKey, bucket] of Object.entries(data.categories ?? {})) {
      for (const w of bucket.winners) {
        const fk = animeFranchiseKey(stripFranchiseSuffix(w.title));
        const arr = out.get(fk) ?? [];
        arr.push({
          source: id,
          year: w.year,
          categoryKey,
          categoryName: bucket.name,
          title: w.title,
          isAOTY: aotyKeys.has(categoryKey),
        });
        out.set(fk, arr);
      }
    }
  }
  for (const list of out.values()) list.sort(compareWinsForBadge);
  return out;
})();

function compareWinsForBadge(a: AwardWin, b: AwardWin): number {
  if (a.isAOTY !== b.isAOTY) return a.isAOTY ? -1 : 1;
  if (a.year !== b.year) return b.year - a.year;
  return SOURCE_META[b.source].prestige - SOURCE_META[a.source].prestige;
}

const AWARD_METAS_CACHE_KEY = "harbor.anime_awards.metas.v2";

let synonymMap: Map<string, string> | null = null;

function rebuildSynonymMap(): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof localStorage === "undefined") return out;
  try {
    const raw = localStorage.getItem(AWARD_METAS_CACHE_KEY);
    if (!raw) return out;
    const cache = JSON.parse(raw) as Record<string, { name?: string } | null>;
    for (const [dataFk, meta] of Object.entries(cache)) {
      if (!meta || !meta.name) continue;
      const jikanFk = animeFranchiseKey(stripFranchiseSuffix(meta.name));
      if (!jikanFk || jikanFk === dataFk) continue;
      if (!out.has(jikanFk)) out.set(jikanFk, dataFk);
    }
  } catch {
    /* ignore */
  }
  return out;
}

function getSynonymMap(): Map<string, string> {
  if (synonymMap === null) synonymMap = rebuildSynonymMap();
  return synonymMap;
}

export function invalidateAnimeAwardSynonyms() {
  synonymMap = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === AWARD_METAS_CACHE_KEY) synonymMap = null;
  });
}

export function parseAwardYear(value: string | number | null | undefined): number | undefined {
  if (value == null) return undefined;
  const n = typeof value === "number" ? value : Number.parseInt(String(value).slice(0, 4), 10);
  return Number.isFinite(n) ? n : undefined;
}

function gateByReleaseYear(wins: AwardWin[], releaseYear?: number): AwardWin[] {
  if (typeof releaseYear !== "number" || !Number.isFinite(releaseYear)) return wins;
  const plausible = wins.some((w) => w.year >= releaseYear - 1);
  return plausible ? wins : [];
}

export function findAnyAwardWins(animeName: string, releaseYear?: number): AwardWin[] {
  if (!animeName) return [];
  const fk = animeFranchiseKey(stripFranchiseSuffix(animeName));
  const direct = INDEX.get(fk);
  if (direct && direct.length > 0) return gateByReleaseYear(direct, releaseYear);
  const synFk = getSynonymMap().get(fk);
  if (synFk) {
    const viaSyn = INDEX.get(synFk);
    if (viaSyn && viaSyn.length > 0) return gateByReleaseYear(viaSyn, releaseYear);
  }
  return [];
}

export function findTopAward(animeName: string, releaseYear?: number): AwardWin | null {
  const wins = findAnyAwardWins(animeName, releaseYear);
  return wins[0] ?? null;
}

export function groupWinsBySource(
  animeName: string,
  releaseYear?: number,
): Array<{
  source: AwardSourceId;
  wins: AwardWin[];
}> {
  const wins = findAnyAwardWins(animeName, releaseYear);
  if (wins.length === 0) return [];
  const map = new Map<AwardSourceId, AwardWin[]>();
  for (const w of wins) {
    const arr = map.get(w.source) ?? [];
    arr.push(w);
    map.set(w.source, arr);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => {
      if (a.isAOTY !== b.isAOTY) return a.isAOTY ? -1 : 1;
      if (a.year !== b.year) return b.year - a.year;
      return a.categoryName.localeCompare(b.categoryName);
    });
  }
  return Array.from(map.entries())
    .map(([source, w]) => ({ source, wins: w }))
    .sort((a, b) => SOURCE_META[b.source].prestige - SOURCE_META[a.source].prestige);
}

export function uniqueWinnerFranchisesAcrossSources(): Map<string, AwardWin> {
  const out = new Map<string, AwardWin>();
  for (const [fk, wins] of INDEX.entries()) {
    out.set(fk, wins[0]);
  }
  return out;
}
