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
      const raw = e.status === "COMPLETED" ? total ?? e.progress : e.progress;
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

// A kitsu id maps to one anilist and one mal id forever, so these outlive the
// list index the session resets. The caller re-enters with a longer id list
// every time hero, picks and trending resolve, and without this each pass
// re-reads and re-parses the whole arm cache out of localStorage per id.
const anilistByKitsu = new Map<number, Promise<number | null>>();
const malByKitsu = new Map<number, Promise<number | null>>();

function memo(
  store: Map<number, Promise<number | null>>,
  kitsuId: number,
  load: (id: number) => Promise<number | null>,
): Promise<number | null> {
  let p = store.get(kitsuId);
  if (!p) {
    p = load(kitsuId).catch(() => null);
    store.set(kitsuId, p);
  }
  return p;
}

const MAP_CONCURRENCY = 8;

export async function loadAnilistWatchedMap(harborIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (harborIds.length === 0) return out;
  const { byAnilist, byMal } = await loadIndex();
  if (byAnilist.size === 0 && byMal.size === 0) return out;

  const pending: Array<[string, number]> = [];
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
      if (Number.isFinite(k)) pending.push([id, k]);
    }
    if (hit) out.set(id, keysFor(hit.count));
  }

  let at = 0;
  const worker = async () => {
    while (at < pending.length) {
      const [id, k] = pending[at++];
      let hit: Entry | undefined;
      const a = await memo(anilistByKitsu, k, kitsuToAnilist);
      if (a != null) hit = byAnilist.get(a);
      if (!hit) {
        const m = await memo(malByKitsu, k, kitsuToMal);
        if (m != null) hit = byMal.get(m);
      }
      if (hit) out.set(id, keysFor(hit.count));
    }
  };
  const lanes = Math.min(MAP_CONCURRENCY, pending.length);
  await Promise.all(Array.from({ length: lanes }, worker));
  return out;
}
