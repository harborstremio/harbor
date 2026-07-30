import type { Meta } from "@/lib/cinemeta";
import type { Affinity } from "@/lib/discover/types";
import type { Settings, StreamingService } from "@/lib/settings";
import type { ShelfMeta } from "@/components/feed-shelf";
import { CATALOG, type ExpandedRow } from "./daily-rows-catalog";
import { ANCHOR_AWARDS, ANCHOR_TOP_RATED, ANCHOR_TRENDING, ROTATING_ANCHORS } from "./daily-rows-anchors";
import { fetchRowWithFallback } from "./daily-rows-select";
import { dayIndex, mixSeed, mulberry32 } from "./tags";
import { fallbackShelves } from "./themes";
import { hashStr } from "./daily-rows-types";

export type RailDef = {
  id: string;
  shelf: ShelfMeta;
  fetch: (page?: number) => Promise<Meta[]>;
};

const RECENCY_WINDOW = 10;
const RING_KEY = "harbor.discover.rows.v1";
const ANCHOR_SALT = 90001;
const ORDER_SALT = 90007;
const STANDARD_ANCHORS = new Set([ANCHOR_TRENDING, ANCHOR_TOP_RATED, ANCHOR_AWARDS]);

type RingEntry = { day: number; keys: string[] };

function readRing(): RingEntry[] {
  try {
    const raw = localStorage.getItem(RING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-RECENCY_WINDOW) : [];
  } catch {
    return [];
  }
}

function recordKey(base: number, key: string): void {
  try {
    const ring = readRing();
    let today = ring.find((e) => e.day === base);
    if (!today) {
      today = { day: base, keys: [] };
      ring.push(today);
    }
    if (!today.keys.includes(key)) today.keys.push(key);
    const trimmed = ring.slice(-RECENCY_WINDOW);
    localStorage.setItem(RING_KEY, JSON.stringify(trimmed));
  } catch {}
}

function recentKeys(base: number): Set<string> {
  const set = new Set<string>();
  for (const entry of readRing()) {
    if (entry.day === base) continue;
    for (const k of entry.keys) set.add(k);
  }
  return set;
}

function expandCandidates(affinity: Affinity, base: number, settings: Settings): ExpandedRow[] {
  const out: ExpandedRow[] = [];
  const seen = new Set<string>();
  for (const entry of CATALOG) {
    if (!entry.eligible(affinity, settings)) continue;
    for (const row of entry.expand(affinity, base, settings)) {
      if (seen.has(row.key)) continue;
      seen.add(row.key);
      const standard = STANDARD_ANCHORS.has(row.key.split(":")[0]);
      const pageBase = standard ? 1 : 1 + Math.floor(mulberry32(mixSeed(base, hashStr(row.key)))() * 3);
      out.push({ ...row, pageBase });
    }
  }
  return out;
}

function toRail(tmdbKey: string, base: number, row: ExpandedRow, settings: Settings): RailDef {
  const id = row.key;
  let recorded = false;
  return {
    id,
    shelf: { id, title: row.title, kicker: row.kicker },
    fetch: (page = 1) => {
      if (page === 1 && !recorded) {
        recorded = true;
        recordKey(base, row.key);
      }
      return fetchRowWithFallback(tmdbKey, row, page, settings);
    },
  };
}

function orderRows(rows: ExpandedRow[], base: number, count: number): ExpandedRow[] {
  const trending = rows.find((r) => r.key.startsWith(`${ANCHOR_TRENDING}:`));
  const topRated = rows.find((r) => r.key.startsWith(`${ANCHOR_TOP_RATED}:`));
  const award = rows.find((r) => r.key.startsWith(`${ANCHOR_AWARDS}:`));
  const rotatingId = ROTATING_ANCHORS[Math.floor(mulberry32(mixSeed(base, ANCHOR_SALT))() * ROTATING_ANCHORS.length)];
  const closing = rows.find((r) => r.key.startsWith(`${rotatingId}:`));
  const pinnedKeys = new Set<string>();
  if (trending) pinnedKeys.add(trending.key);
  if (topRated) pinnedKeys.add(topRated.key);
  if (award) pinnedKeys.add(award.key);
  if (closing) pinnedKeys.add(closing.key);

  const recent = recentKeys(base);
  const middle = rows.filter((r) => !pinnedKeys.has(r.key));
  const fresh = middle.filter((r) => !recent.has(r.key));
  const stale = middle.filter((r) => recent.has(r.key));
  const order = mulberry32(mixSeed(base, ORDER_SALT));
  const fy = (arr: ExpandedRow[]) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(order() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const pinnedCount = (trending ? 1 : 0) + (topRated ? 1 : 0) + (award ? 1 : 0) + (closing ? 1 : 0);
  const bodyTarget = Math.max(0, count - pinnedCount);
  const body = [...fy(fresh), ...fy(stale)].slice(0, bodyTarget + 2);

  const result: ExpandedRow[] = [];
  if (trending) result.push(trending);
  if (topRated) result.push(topRated);
  if (award) result.push(award);
  result.push(...body);
  if (closing) result.push(closing);
  return result;
}

function fallbackRows(): RailDef[] {
  return fallbackShelves().map((s) => ({
    id: `fallback_${s.id}`,
    shelf: { id: s.id, title: s.title, kicker: s.kicker },
    fetch: (page = 1) => s.fetch(page),
  }));
}

let cacheKey = "";
let cacheRows: RailDef[] = [];

function settingsHash(settings: Settings): string {
  const enabled = (Object.keys(settings.streaming) as StreamingService[])
    .filter((s) => settings.streaming[s])
    .join(",");
  const langs = (settings.preferredLanguages ?? []).join(",");
  const bias = settings.feedLocaleBias ? "1" : "0";
  return `${settings.region}|${enabled}|${langs}|${settings.tmdbLanguage}|${bias}|${settings.uiLanguage}`;
}

export function selectDailyRows(
  tmdbKey: string,
  affinity: Affinity,
  settings: Settings,
  count = 14,
  now: Date = new Date(),
): RailDef[] {
  const base = dayIndex(now);
  const key = `${base}:${tmdbKey}:${affinity.lastUpdated}:${settingsHash(settings)}:${count}`;
  if (key === cacheKey && cacheRows.length > 0) return cacheRows;

  if (!tmdbKey) {
    cacheKey = key;
    cacheRows = fallbackRows();
    return cacheRows;
  }

  const candidates = expandCandidates(affinity, base, settings);
  const ordered = orderRows(candidates, base, count);
  cacheKey = key;
  cacheRows = ordered.map((row) => toRail(tmdbKey, base, row, settings));
  return cacheRows;
}
