import { getSession, subscribeSession } from "./session";
import { fetchMediaListCollection } from "./lists";
import { kitsuToAnilist, kitsuToMal } from "@/lib/providers/anime-mapping";

type Entry = { count: number };
type Index = { byAnilist: Map<number, Entry>; byMal: Map<number, Entry> };

let cache: Promise<Index> | null = null;
let cachedAt = 0;
const TTL = 120000;

subscribeSession(() => {
  cache = null;
});

async function buildIndex(): Promise<Index> {
  const byAnilist = new Map<number, Entry>();
  const byMal = new Map<number, Entry>();
  const session = getSession();
  if (!session) return { byAnilist, byMal };
  const groups = await fetchMediaListCollection(session.userId).catch(() => []);
  for (const group of groups) {
    for (const e of group.entries) {
      if (e.media.format === "MOVIE") continue;
      const total = e.media.episodes ?? undefined;
      const raw = e.status === "COMPLETED" ? (total ?? e.progress) : e.progress;
      const count = total != null ? Math.min(raw, total) : raw;
      if (count <= 0) continue;
      const entry: Entry = { count };
      byAnilist.set(e.media.id, entry);
      if (e.media.idMal != null) byMal.set(e.media.idMal, entry);
    }
  }
  return { byAnilist, byMal };
}

function loadIndex(): Promise<Index> {
  if (!cache || Date.now() - cachedAt > TTL) {
    cache = buildIndex();
    cachedAt = Date.now();
  }
  return cache;
}

function keysFor(count: number): Set<string> {
  const set = new Set<string>();
  for (let e = 1; e <= count; e++) set.add(`1:${e}`);
  return set;
}

export async function loadAnilistWatchedMap(
  harborIds: string[],
): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (harborIds.length === 0) return out;
  const { byAnilist, byMal } = await loadIndex();
  if (byAnilist.size === 0 && byMal.size === 0) return out;
  for (const id of harborIds) {
    let hit: Entry | undefined;
    if (id.startsWith("anilist:")) {
      const n = parseInt(id.slice(8), 10);
      if (Number.isFinite(n)) hit = byAnilist.get(n);
    } else if (id.startsWith("mal:")) {
      const n = parseInt(id.slice(4), 10);
      if (Number.isFinite(n)) hit = byMal.get(n);
    } else if (id.startsWith("kitsu:")) {
      const k = parseInt(id.slice(6), 10);
      if (Number.isFinite(k)) {
        const a = await kitsuToAnilist(k).catch(() => null);
        if (a != null) hit = byAnilist.get(a);
        if (!hit) {
          const m = await kitsuToMal(k).catch(() => null);
          if (m != null) hit = byMal.get(m);
        }
      }
    }
    if (hit) out.set(id, keysFor(hit.count));
  }
  return out;
}
