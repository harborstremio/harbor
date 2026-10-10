import type { AwardCategory } from "./awards-catalog";
import type { AwardEntry, AwardType } from "./providers/wikidata";

export type CategoryWinner = {
  year: number;
  workTitle: string;
  recipients: string[];
  imdb?: string;
  nominees?: Array<{ title: string; imdb?: string }>;
};

export type CategoryHistory = {
  category: AwardCategory;
  entries: CategoryWinner[];
};

type RawEntry = {
  year: number;
  title: string | null;
  recipients: string[];
  won?: boolean;
  imdb?: string;
};

type RawData = Record<string, Record<string, { name: string; entries: RawEntry[] }>>;

// data/awards.json is 4.2MB, and an `import x from "*.json"` compiles to a
// javascript object literal, which a television parses far slower than it
// parses the same bytes through JSON.parse. Measured on a Fire TV Stick 4K Max
// it was the single largest thing in the Big Picture boot graph. So the file is
// no longer wired in here; whoever boots the app decides how it arrives.
// Desktop keeps the old timing exactly via awards-history-eager, which main.tsx
// imports before it mounts. Television calls ensureBundledAwards after the
// first paint and re-renders through subscribeBundledAwards when it lands.
let data: RawData = {};
let version = 0;
const listeners = new Set<() => void>();
let requested = false;

/**
 * @param warm build the title index here rather than leaving it to the first
 * reader. Setting the table nulls the index, so on television the notification
 * below reached 240 mounted tiles whose memo then re-ran, and the first one
 * through built the index inside a React render on a sync lane that cannot
 * yield. buildTitleIndex walks 16,312 titled entries, allocating an object, a
 * template string and an NFKD normalise for each: 48 to 67ms measured in V8 on
 * x86, so 150 to 400ms on a Cortex-A55, landing exactly when the viewer first
 * presses a key on home. Desktop passes false and keeps the old lazy timing.
 */
export function setBundledAwards(raw: unknown, warm = false): void {
  data = (raw ?? {}) as RawData;
  titleIndex = null;
  personIndex = null;
  if (warm) titleIndex = buildTitleIndex();
  version += 1;
  for (const fn of listeners) fn();
}

export function bundledAwardsVersion(): number {
  return version;
}

export function subscribeBundledAwards(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function ensureBundledAwards(): void {
  if (requested) return;
  requested = true;
  void import("@/data/awards.json")
    .then((m) => setBundledAwards(m.default, true))
    .catch(() => {
      requested = false;
    });
}

export function readAwardHistory(
  awardType: AwardType,
  categories: AwardCategory[],
): CategoryHistory[] {
  const bucket = data[awardType] ?? {};
  return categories
    .map((cat) => {
      const raw = bucket[cat.key];
      if (!raw) return null;
      const nomineesByYear = new Map<number, Array<{ title: string; imdb?: string }>>();
      for (const e of raw.entries) {
        if (e.won !== false || !e.title) continue;
        const list = nomineesByYear.get(e.year) ?? [];
        list.push({ title: e.title, imdb: e.imdb });
        nomineesByYear.set(e.year, list);
      }
      const entries: CategoryWinner[] = raw.entries
        .filter((e) => e.won !== false)
        .filter((e) => e.title || e.recipients.length > 0)
        .map((e) => ({
          year: e.year,
          workTitle: e.title ?? e.recipients[0] ?? "",
          recipients: e.recipients,
          imdb: e.imdb,
          nominees: nomineesByYear.get(e.year),
        }))
        .filter((e) => e.workTitle.length > 0);
      return { category: cat, entries };
    })
    .filter((g): g is CategoryHistory => g !== null && g.entries.length > 0);
}

const BUNDLED_AWARD_NAME: Partial<Record<AwardType, string>> = {
  oscar: "Academy Award",
  bafta: "BAFTA Award",
  golden_globe: "Golden Globe Award",
  emmy: "Primetime Emmy Award",
  sag: "Screen Actors Guild Award",
  critics_choice: "Critics' Choice Award",
  cannes: "Cannes Film Festival",
  venice: "Venice Film Festival",
  berlin: "Berlin International Film Festival",
  bafta_tv: "BAFTA Television Award",
  annie: "Annie Award",
  spirit: "Independent Spirit Award",
  saturn: "Saturn Award",
  cesar: "César Award",
  goya: "Goya Award",
  blue_dragon: "Blue Dragon Film Award",
  baeksang: "Baeksang Arts Award",
  bifa: "British Independent Film Award",
};

function normTitle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

let titleIndex: Map<string, AwardEntry[]> | null = null;

function buildTitleIndex(): Map<string, AwardEntry[]> {
  const idx = new Map<string, AwardEntry[]>();
  for (const [type, cats] of Object.entries(data)) {
    const at = type as AwardType;
    const prefix = BUNDLED_AWARD_NAME[at] ?? "Award";
    for (const cat of Object.values(cats)) {
      for (const e of cat.entries) {
        if (!e.title) continue;
        const key = normTitle(e.title);
        const list = idx.get(key) ?? [];
        list.push({
          type: at,
          awardName: `${prefix}: ${cat.name}`,
          category: cat.name,
          year: e.year,
          result: e.won === false ? "nominated" : "won",
          workTitle: e.title,
          workImdb: e.imdb,
          recipients: e.recipients.length > 0 ? e.recipients : undefined,
        });
        idx.set(key, list);
      }
    }
  }
  return idx;
}

export function bundledAwardsForTitle(title: string | undefined, year?: number): AwardEntry[] {
  if (!title) return [];
  if (!titleIndex) titleIndex = buildTitleIndex();
  const hits = titleIndex.get(normTitle(title)) ?? [];
  if (year == null) return hits;
  return hits.filter((e) => typeof e.year !== "number" || Math.abs(e.year - year) <= 1);
}

export function mergeBundledAwards(
  live: AwardEntry[] | null | undefined,
  title: string | undefined,
  year?: number,
): AwardEntry[] {
  const liveList = live ?? [];
  const bundled = bundledAwardsForTitle(title, year);
  if (bundled.length === 0) return liveList;
  const liveTypes = new Set(liveList.map((e) => e.type));
  const extra = bundled.filter((b) => !liveTypes.has(b.type));
  return extra.length > 0 ? [...liveList, ...extra] : liveList;
}

let personIndex: Map<string, AwardEntry[]> | null = null;

function buildPersonIndex(): Map<string, AwardEntry[]> {
  const idx = new Map<string, AwardEntry[]>();
  for (const [type, cats] of Object.entries(data)) {
    const at = type as AwardType;
    const prefix = BUNDLED_AWARD_NAME[at] ?? "Award";
    for (const cat of Object.values(cats)) {
      for (const e of cat.entries) {
        for (const r of e.recipients) {
          const key = normTitle(r);
          if (!key) continue;
          const list = idx.get(key) ?? [];
          list.push({
            type: at,
            awardName: `${prefix}: ${cat.name}`,
            category: cat.name,
            year: e.year,
            result: e.won === false ? "nominated" : "won",
            workTitle: e.title ?? undefined,
            workImdb: e.imdb,
            recipient: r,
            recipients: [r],
          });
          idx.set(key, list);
        }
      }
    }
  }
  return idx;
}

export function bundledAwardsForPerson(name: string | undefined): AwardEntry[] {
  if (!name) return [];
  if (!personIndex) personIndex = buildPersonIndex();
  return personIndex.get(normTitle(name)) ?? [];
}

const CATEGORY_STOPWORDS = new Set([
  "outstanding", "performance", "by", "a", "an", "the", "in", "of", "for", "role",
  "award", "awards", "best", "achievement", "motion", "picture", "television", "tv",
  "miniseries", "series", "mini", "and", "or", "at", "as", "to",
]);

function normCategoryKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/mini[\s-]?series/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !CATEGORY_STOPWORDS.has(w))
    .join(" ")
    .trim();
}

export function dedupePersonAwards(entries: AwardEntry[]): AwardEntry[] {
  const best = new Map<string, AwardEntry>();
  const order: string[] = [];
  for (const e of entries) {
    const work = normTitle(e.workTitle ?? e.recipient ?? "");
    const key = `${e.type}|${work}|${normCategoryKey(e.category ?? "")}|${e.year ?? ""}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, e);
      order.push(key);
      continue;
    }
    const prevWon = prev.result === "won" ? 1 : 0;
    const curWon = e.result === "won" ? 1 : 0;
    const take = curWon !== prevWon ? curWon > prevWon : (e.year ?? 0) > (prev.year ?? 0);
    const base = take ? e : prev;
    const other = take ? prev : e;
    best.set(key, {
      ...base,
      workImdb: base.workImdb ?? other.workImdb,
      workTitle: base.workTitle ?? other.workTitle,
    });
  }
  return order.map((k) => best.get(k)!);
}

export function mergeBundledPersonAwards(
  live: AwardEntry[] | null | undefined,
  name: string | undefined,
): AwardEntry[] {
  const liveList = live ?? [];
  const bundled = bundledAwardsForPerson(name);
  const k3 = (e: AwardEntry) =>
    `${e.type}|${normTitle(e.workTitle ?? e.recipient ?? "")}|${normCategoryKey(e.category ?? "")}`;
  const liveImdb = new Map<string, string>();
  for (const e of liveList) {
    const k = k3(e);
    if (e.workImdb && !liveImdb.has(k)) liveImdb.set(k, e.workImdb);
  }
  const enriched = bundled.map((b) => {
    const imdb = liveImdb.get(k3(b));
    return imdb && !b.workImdb ? { ...b, workImdb: imdb } : b;
  });
  const bundledKeys = new Set(bundled.map(k3));
  const liveExtra = liveList.filter((e) => !bundledKeys.has(k3(e)));
  return dedupePersonAwards([...enriched, ...liveExtra]);
}
