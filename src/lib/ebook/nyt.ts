import { safeFetch } from "@/lib/safe-fetch";
import { setItemWithRecovery } from "@/lib/storage-recovery";

export type NytBook = {
  rank: number;
  rankLastWeek: number;
  weeksOnList: number;
  title: string;
  author: string;
  description: string;
  publisher: string;
  isbn13?: string;
  cover?: string;
};

export type NytList = {
  name: string;
  encodedName: string;
  displayName: string;
  books: NytBook[];
};

export type NytSnapshot = {
  fetchedAt: number;
  publishedDate: string;
  lists: NytList[];
};

const KEY = "harbor.ebook.nyt.v1";
const API = "https://api.nytimes.com/svc/books/v3/lists/full-overview.json";
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
const RETRY_BASE_MS = 15 * 60 * 1000;
const MAX_RETRIES = 4;
const MAX_BOOKS_PER_LIST = 15;

export const NYT_PRIMARY_LIST = "combined-print-and-e-book-fiction";
export const NYT_ATTRIBUTION = "Data provided by The New York Times";

type RawBook = {
  rank?: number;
  rank_last_week?: number;
  weeks_on_list?: number;
  title?: string;
  author?: string;
  description?: string;
  publisher?: string;
  primary_isbn13?: string;
  book_image?: string;
};

type RawList = {
  list_name?: string;
  list_name_encoded?: string;
  display_name?: string;
  books?: RawBook[];
};

function trimBook(raw: RawBook): NytBook | null {
  const title = (raw.title ?? "").trim();
  if (!title) return null;
  return {
    rank: Number(raw.rank) || 0,
    rankLastWeek: Number(raw.rank_last_week) || 0,
    weeksOnList: Number(raw.weeks_on_list) || 0,
    title: title.replace(/\s+/g, " "),
    author: (raw.author ?? "").trim(),
    description: (raw.description ?? "").trim(),
    publisher: (raw.publisher ?? "").trim(),
    isbn13: raw.primary_isbn13 || undefined,
    cover: raw.book_image || undefined,
  };
}

function trimList(raw: RawList): NytList | null {
  const encodedName = (raw.list_name_encoded ?? "").trim();
  const name = (raw.list_name ?? "").trim();
  if (!encodedName || !name) return null;
  const books = (raw.books ?? [])
    .map(trimBook)
    .filter((b): b is NytBook => b != null)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_BOOKS_PER_LIST);
  if (books.length === 0) return null;
  return { name, encodedName, displayName: (raw.display_name ?? name).trim(), books };
}

export function readNytSnapshot(): NytSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NytSnapshot;
    if (!Array.isArray(parsed?.lists) || parsed.lists.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function nytSnapshotIsStale(snap: NytSnapshot | null): boolean {
  if (!snap) return true;
  return Date.now() - snap.fetchedAt >= FRESH_MS;
}

let inflight: Promise<NytSnapshot | null> | null = null;

export async function refreshNytBestsellers(apiKey: string): Promise<NytSnapshot | null> {
  const key = apiKey.trim();
  if (!key) return null;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await safeFetch(`${API}?api-key=${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const json = (await res.json()) as {
        results?: { published_date?: string; lists?: RawList[] };
      };
      const lists = (json.results?.lists ?? [])
        .map(trimList)
        .filter((l): l is NytList => l != null);
      if (lists.length === 0) return null;
      const snap: NytSnapshot = {
        fetchedAt: Date.now(),
        publishedDate: json.results?.published_date ?? "",
        lists,
      };
      setItemWithRecovery(KEY, JSON.stringify(snap));
      return snap;
    } catch {
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function loadNytBestsellers(apiKey: string): Promise<NytSnapshot | null> {
  const cached = readNytSnapshot();
  if (cached && !nytSnapshotIsStale(cached)) return cached;
  const fresh = await refreshNytBestsellers(apiKey);
  return fresh ?? cached;
}

export function nytList(snap: NytSnapshot | null, encodedName: string): NytList | null {
  if (!snap) return null;
  return snap.lists.find((l) => l.encodedName === encodedName) ?? null;
}

export function nytRankMove(book: NytBook): "new" | "up" | "down" | "same" {
  if (book.weeksOnList <= 1 || book.rankLastWeek === 0) return "new";
  if (book.rank < book.rankLastWeek) return "up";
  if (book.rank > book.rankLastWeek) return "down";
  return "same";
}

let failures = 0;
let nextAttemptAt = 0;
let timer: number | null = null;
let bound = false;
const snapshotListeners = new Set<(snap: NytSnapshot) => void>();

export function subscribeNytSnapshot(fn: (snap: NytSnapshot) => void): () => void {
  snapshotListeners.add(fn);
  return () => {
    snapshotListeners.delete(fn);
  };
}

async function attempt(apiKey: string): Promise<void> {
  const key = apiKey.trim();
  if (!key) return;
  if (Date.now() < nextAttemptAt) return;
  if (!nytSnapshotIsStale(readNytSnapshot())) return;
  const fresh = await refreshNytBestsellers(key);
  if (fresh) {
    failures = 0;
    nextAttemptAt = 0;
    snapshotListeners.forEach((fn) => fn(fresh));
    return;
  }
  failures += 1;
  nextAttemptAt =
    failures >= MAX_RETRIES
      ? Date.now() + FRESH_MS
      : Date.now() + RETRY_BASE_MS * 2 ** (failures - 1);
}

export function startNytAutoRefresh(getKey: () => string): () => void {
  const tick = () => void attempt(getKey());
  tick();
  if (timer != null) window.clearInterval(timer);
  timer = window.setInterval(tick, CHECK_EVERY_MS);
  if (!bound) {
    bound = true;
    window.addEventListener("focus", tick);
    window.addEventListener("online", tick);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) tick();
    });
  }
  return () => {
    if (timer != null) window.clearInterval(timer);
    timer = null;
  };
}

export function resetNytBackoff(): void {
  failures = 0;
  nextAttemptAt = 0;
}
