import type { MetaType } from "@/lib/cinemeta";

const STORAGE_KEY = "harbor.feed-prefs.v2";
const LEGACY_KEY = "harbor.feed-prefs.v1";

export type FeedVote = "up" | "down";

export type VoteEntry = {
  vote: FeedVote;
  ts: number;
  name?: string;
  type?: MetaType;
  altId?: string;
};

type Stored = {
  votes: Record<string, VoteEntry>;
  updatedAt: number;
};

let cache: Stored | null = null;
const listeners = new Set<() => void>();

function migrate(raw: string): Stored {
  const parsed = JSON.parse(raw) as { votes?: Record<string, unknown>; updatedAt?: number };
  const updatedAt = parsed.updatedAt ?? Date.now();
  const votes: Record<string, VoteEntry> = {};
  for (const [id, v] of Object.entries(parsed.votes ?? {})) {
    if (v === "up" || v === "down") {
      votes[id] = { vote: v, ts: updatedAt };
    } else if (v && typeof v === "object" && "vote" in v) {
      const e = v as VoteEntry;
      if (e.vote === "up" || e.vote === "down") {
        votes[id] = {
          vote: e.vote,
          ts: e.ts ?? updatedAt,
          name: e.name,
          type: e.type,
          altId: e.altId,
        };
      }
    }
  }
  return { votes, updatedAt };
}

function load(): Stored {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_KEY);
    cache = raw ? migrate(raw) : { votes: {}, updatedAt: 0 };
  } catch {
    cache = { votes: {}, updatedAt: 0 };
  }
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {}
  listeners.forEach((l) => l());
}

export function getVote(metaId: string): FeedVote | null {
  return load().votes[metaId]?.vote ?? null;
}

export function getVoteWithTs(metaId: string): { vote: FeedVote; ts: number } | null {
  const e = load().votes[metaId];
  return e ? { vote: e.vote, ts: e.ts } : null;
}

export function setVote(
  metaId: string,
  vote: FeedVote | null,
  meta?: { name?: string; type?: MetaType; altId?: string },
): void {
  const store = load();
  if (vote == null) {
    delete store.votes[metaId];
  } else {
    store.votes[metaId] = {
      vote,
      ts: Date.now(),
      name: meta?.name,
      type: meta?.type,
      altId: meta?.altId,
    };
  }
  store.updatedAt = Date.now();
  persist();
}

export function getDownvotedIds(): Set<string> {
  const ids = new Set<string>();
  for (const [id, e] of Object.entries(load().votes)) if (e.vote === "down") ids.add(id);
  return ids;
}

export function getUpvotedIds(): Set<string> {
  const ids = new Set<string>();
  for (const [id, e] of Object.entries(load().votes)) if (e.vote === "up") ids.add(id);
  return ids;
}

export function getVoteEntries(): Array<{ id: string } & VoteEntry> {
  return Object.entries(load().votes).map(([id, e]) => ({ id, ...e }));
}

export function subscribePrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
