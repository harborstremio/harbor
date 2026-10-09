import { safeFetch } from "@/lib/safe-fetch";

const FEED_URL =
  "https://raw.githubusercontent.com/RockinChaos/AniSchedule/master/raw/dub-schedule.json";

let byMal: Set<number> | null = null;
let byAnilist: Set<number> | null = null;
let inflight: Promise<void> | null = null;
const subs = new Set<() => void>();

export type DubFeedEntry = {
  title?: string | null;
  romaji?: string | null;
  english?: string | null;
  episodeDate?: string | null;
  episodeNumber?: number | null;
  media?: {
    media?: {
      id?: number | null;
      idMal?: number | null;
      type?: string | null;
      format?: string | null;
      isAdult?: boolean | null;
      title?: { romaji?: string | null; english?: string | null } | null;
      coverImage?: { extraLarge?: string | null; medium?: string | null } | null;
      bannerImage?: string | null;
    } | null;
  } | null;
};

let feedCache: { entries: DubFeedEntry[]; at: number } | null = null;
const FEED_STALE_MS = 30 * 60 * 1000;

/** Fetch the AniSchedule dub feed, cached briefly. Never rejects. */
export async function fetchDubSchedule(): Promise<DubFeedEntry[]> {
  const now = Date.now();
  if (feedCache && now - feedCache.at < FEED_STALE_MS) return feedCache.entries;
  try {
    const res = await safeFetch(FEED_URL);
    if (!res.ok) return feedCache?.entries ?? [];
    const arr = (await res.json()) as DubFeedEntry[];
    feedCache = { entries: arr, at: now };
    return arr;
  } catch {
    return feedCache?.entries ?? [];
  }
}

function load(): Promise<void> {
  if (byMal) return Promise.resolve();
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const arr = await fetchDubSchedule();
      const mal = new Set<number>();
      const ani = new Set<number>();
      for (const e of arr) {
        const m = e?.media?.media?.idMal;
        const a = e?.media?.media?.id;
        if (typeof m === "number") mal.add(m);
        if (typeof a === "number") ani.add(a);
      }
      byMal = mal;
      byAnilist = ani;
      for (const s of subs) s();
    } catch {
      /* leave sets null; badge stays hidden */
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function ensureDubSet(): void {
  void load();
}

export function dubSetReady(): boolean {
  return byMal != null;
}

export function subscribeDubSet(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function animeHasDub(metaId: string): boolean {
  if (!byMal) return false;
  if (metaId.startsWith("mal:")) {
    const m = Number(metaId.slice(4));
    if (Number.isFinite(m) && byMal.has(m)) return true;
  }
  if (metaId.startsWith("anilist:")) {
    const a = Number(metaId.slice(8));
    if (Number.isFinite(a) && byAnilist?.has(a)) return true;
  }
  return false;
}
