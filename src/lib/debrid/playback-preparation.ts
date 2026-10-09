import type { EpisodeHint } from "@/lib/streams/episode-file";
import type { ParsedStream, ScoredStream } from "@/lib/streams/types";
import { magnetFromHash, type DebridStore, type DirectLink } from "./types";

const PREPARED_LINK_TTL_MS = 2 * 60 * 1000;
const MAX_PREPARES_PER_MINUTE = 6;
const MAX_PREPARES_PER_HOUR = 30;
const MAX_CACHE_ENTRIES = 64;

type PreparedEntry = {
  data: DirectLink;
  expiresAt: number;
};

type PreparationCandidate = {
  stream: ParsedStream | ScoredStream;
  debrid: DebridStore;
};

const prepared = new Map<string, PreparedEntry>();
const inFlight = new Map<string, Promise<DirectLink | null>>();
const activeProviders = new Set<DebridStore["slug"]>();
const prepareStarts: number[] = [];
const clientIds = new WeakMap<DebridStore, number>();
let nextClientId = 0;

function clientId(debrid: DebridStore): number {
  const existing = clientIds.get(debrid);
  if (existing != null) return existing;
  const id = ++nextClientId;
  clientIds.set(debrid, id);
  return id;
}

function normalizedHash(stream: ParsedStream | ScoredStream): string | null {
  const hash = stream.infoHash?.trim().toLowerCase();
  return hash || null;
}

function preparationKey(
  stream: ParsedStream | ScoredStream,
  debrid: DebridStore,
  hint?: EpisodeHint,
): string | null {
  const hash = normalizedHash(stream);
  if (!hash) return null;
  return [
    debrid.slug,
    clientId(debrid),
    hash,
    stream.fileIdx ?? "",
    hint?.season ?? "",
    hint?.episode ?? "",
  ].join("|");
}

function isVerifiedFor(stream: ParsedStream | ScoredStream, debrid: DebridStore): boolean {
  return stream.cacheVerified?.[debrid.slug] === true || stream.inLibrary?.[debrid.slug] === true;
}

function prune(now = Date.now()) {
  for (const [key, entry] of prepared) {
    if (entry.expiresAt <= now) prepared.delete(key);
  }
  const hourAgo = now - 60 * 60 * 1000;
  while (prepareStarts.length > 0 && prepareStarts[0] < hourAgo) prepareStarts.shift();
  while (prepared.size > MAX_CACHE_ENTRIES) {
    const oldest = prepared.keys().next().value as string | undefined;
    if (!oldest) break;
    prepared.delete(oldest);
  }
}

function reservePreparation(now = Date.now()): boolean {
  prune(now);
  const minuteAgo = now - 60 * 1000;
  let startsInMinute = 0;
  for (let i = prepareStarts.length - 1; i >= 0; i--) {
    if (prepareStarts[i] < minuteAgo) break;
    startsInMinute += 1;
  }
  if (startsInMinute >= MAX_PREPARES_PER_MINUTE || prepareStarts.length >= MAX_PREPARES_PER_HOUR) {
    return false;
  }
  prepareStarts.push(now);
  return true;
}

function cachedLink(key: string): DirectLink | null {
  prune();
  const entry = prepared.get(key);
  if (!entry) return null;
  prepared.delete(key);
  prepared.set(key, entry);
  return entry.data;
}

function waitForPending(
  pending: Promise<DirectLink | null>,
  signal: AbortSignal,
): Promise<DirectLink | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: DirectLink | null) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);
    signal.addEventListener("abort", onAbort, { once: true });
    void pending.then(finish, () => finish(null));
  });
}

async function prepareOne(
  stream: ParsedStream | ScoredStream,
  debrid: DebridStore,
  hint: EpisodeHint | undefined,
  signal: AbortSignal,
): Promise<DirectLink | null> {
  if (signal.aborted || stream.url || !isVerifiedFor(stream, debrid)) return null;
  const key = preparationKey(stream, debrid, hint);
  if (!key) return null;
  const cached = cachedLink(key);
  if (cached) return cached;
  const existing = inFlight.get(key);
  if (existing) return waitForPending(existing, signal);
  if (activeProviders.has(debrid.slug) || !reservePreparation()) return null;

  activeProviders.add(debrid.slug);
  const pending = (async () => {
    try {
      const result = await debrid.playableUrl(
        magnetFromHash(stream.infoHash!),
        stream.fileIdx,
        signal,
        hint,
      );
      if (!result.ok || signal.aborted) return null;
      prepared.set(key, {
        data: result.data,
        expiresAt: Date.now() + PREPARED_LINK_TTL_MS,
      });
      prune();
      return result.data;
    } catch {
      return null;
    } finally {
      activeProviders.delete(debrid.slug);
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, pending);
  return waitForPending(pending, signal);
}

function selectPreparationCandidates(
  streams: Array<ParsedStream | ScoredStream>,
  debrids: DebridStore[],
  hint?: EpisodeHint,
): PreparationCandidate[] {
  const selected: PreparationCandidate[] = [];
  const seen = new Set<string>();
  for (const stream of streams) {
    if (selected.length >= 2) break;
    if (stream.url || !stream.infoHash) continue;
    const debrid = debrids.find((candidate) => isVerifiedFor(stream, candidate));
    if (!debrid) continue;
    const key = preparationKey(stream, debrid, hint);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    selected.push({ stream, debrid });
  }
  return selected;
}

export function cachedDebridPreparationSignature(
  streams: Array<ParsedStream | ScoredStream>,
  debrids: DebridStore[],
  hint?: EpisodeHint,
): string {
  return selectPreparationCandidates(streams, debrids, hint)
    .map(({ stream, debrid }) => preparationKey(stream, debrid, hint))
    .filter((key): key is string => Boolean(key))
    .join("||");
}

export async function prepareCachedDebridStreams(
  streams: Array<ParsedStream | ScoredStream>,
  debrids: DebridStore[],
  hint: EpisodeHint | undefined,
  signal: AbortSignal,
): Promise<void> {
  const selected = selectPreparationCandidates(streams, debrids, hint);

  const byProvider = new Map<DebridStore["slug"], typeof selected>();
  for (const candidate of selected) {
    const list = byProvider.get(candidate.debrid.slug) ?? [];
    list.push(candidate);
    byProvider.set(candidate.debrid.slug, list);
  }
  await Promise.all(
    [...byProvider.values()].map(async (list) => {
      for (const candidate of list) {
        if (signal.aborted) return;
        await prepareOne(candidate.stream, candidate.debrid, hint, signal);
      }
    }),
  );
}

export async function getPreparedDebridLink(
  stream: ParsedStream | ScoredStream,
  debrid: DebridStore,
  hint: EpisodeHint | undefined,
  signal: AbortSignal,
): Promise<DirectLink | null> {
  const key = preparationKey(stream, debrid, hint);
  if (!key) return null;
  const cached = cachedLink(key);
  if (cached) return cached;
  const pending = inFlight.get(key);
  return pending ? waitForPending(pending, signal) : null;
}

export function invalidatePreparedDebridLink(
  stream: ParsedStream | ScoredStream,
  debrid: DebridStore,
  hint?: EpisodeHint,
): void {
  const key = preparationKey(stream, debrid, hint);
  if (key) prepared.delete(key);
}
