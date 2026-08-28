import { readResumeEntry, saveResumeBatch } from "@/lib/resume";
import { episodeFromVideoId, libraryGetOne, type LibraryItem } from "@/lib/stremio";

const RESTART_THRESHOLD = 0.8;
const REMOTE_CACHE_TTL_MS = 30_000;
const MAX_CACHE_KEYS_PER_ACCOUNT = 24;

type ResumeIdentity = {
  metaId: string;
  authKey: string | null;
  imdbId: string | null;
  imdbVerified: boolean;
};

type ResolveStartArgs = ResumeIdentity & {
  season: number | undefined;
  episode: number | undefined;
  openingVid: string | null;
};

type RemoteEntry = {
  at: number;
  promise: Promise<LibraryItem | null>;
  settled: boolean;
};

const remoteByAccount = new Map<string, Map<string, RemoteEntry>>();

function lookupIds(identity: ResumeIdentity): string[] {
  const out: string[] = [];
  if (identity.metaId.startsWith("tt")) out.push(identity.metaId);
  else if (identity.imdbVerified && identity.imdbId?.startsWith("tt")) {
    out.push(identity.imdbId, identity.metaId);
  } else {
    out.push(identity.metaId);
  }
  return [...new Set(out)];
}

export function resumeLibraryGetOne(authKey: string, id: string): Promise<LibraryItem | null> {
  let account = remoteByAccount.get(authKey);
  if (!account) {
    account = new Map();
    remoteByAccount.set(authKey, account);
  }
  const now = Date.now();
  const cached = account.get(id);
  if (cached && now - cached.at < REMOTE_CACHE_TTL_MS) return cached.promise;
  const entry: RemoteEntry = {
    at: now,
    promise: Promise.resolve(null),
    settled: false,
  };
  entry.promise = libraryGetOne(authKey, id)
    .catch(() => null)
    .finally(() => {
      entry.settled = true;
    });
  account.set(id, entry);
  while (account.size > MAX_CACHE_KEYS_PER_ACCOUNT) {
    const oldest = account.keys().next().value as string | undefined;
    if (!oldest) break;
    account.delete(oldest);
  }
  return entry.promise;
}

export function isResumeStartReady(identity: ResumeIdentity): boolean {
  if (!identity.authKey) return true;
  const account = remoteByAccount.get(identity.authKey);
  if (!account) return false;
  const now = Date.now();
  return lookupIds(identity).every((id) => {
    const entry = account.get(id);
    return !!entry && entry.settled && now - entry.at < REMOTE_CACHE_TTL_MS;
  });
}

function remoteItems(identity: ResumeIdentity): Promise<Array<LibraryItem | null>> {
  if (!identity.authKey) return Promise.resolve([]);
  return Promise.all(lookupIds(identity).map((id) => resumeLibraryGetOne(identity.authKey!, id)));
}

export function prefetchResumeStart(identity: ResumeIdentity): void {
  if (!identity.authKey) return;
  void remoteItems(identity);
}

export async function resolveStartMs({
  metaId,
  season,
  episode,
  authKey,
  imdbId,
  imdbVerified,
  openingVid,
}: ResolveStartArgs): Promise<{ ms: number; fromRemote: boolean; finished: boolean }> {
  const localEntry = readResumeEntry(metaId, season, episode);
  const local = localEntry?.ms ?? 0;
  const isEpisode = typeof season === "number" && typeof episode === "number";
  if (!authKey) return { ms: local, fromRemote: false, finished: false };
  const matchesEpisode = (item: LibraryItem | null) => {
    if (!item) return false;
    if (typeof season !== "number" || typeof episode !== "number") return true;
    const vid = item.state?.video_id;
    if (openingVid && vid && vid === openingVid) return true;
    const fromVid = episodeFromVideoId(vid);
    const se = item.state?.season ?? fromVid?.season;
    const ep = item.state?.episode ?? fromVid?.episode;
    return se === season && ep === episode;
  };
  const remotes = await remoteItems({ metaId, authKey, imdbId, imdbVerified });
  for (const remote of remotes) {
    if (!remote || !matchesEpisode(remote)) continue;
    const remoteMs = remote.state?.timeOffset ?? 0;
    if (remoteMs <= 0) continue;
    const remoteDuration = remote.state?.duration ?? 0;
    const flaggedWatched = (remote.state as { flaggedWatched?: number })?.flaggedWatched === 1;
    const finished =
      isEpisode &&
      (flaggedWatched || (remoteDuration > 0 && remoteMs / remoteDuration >= RESTART_THRESHOLD));
    const rawMtime = (remote as { _mtime?: unknown })._mtime;
    const remoteMtime =
      typeof rawMtime === "number" ? rawMtime : Date.parse(String(rawMtime ?? ""));
    const remoteIsNewer =
      Number.isFinite(remoteMtime) && (!localEntry || remoteMtime > localEntry.t);
    if (remoteIsNewer || remoteMs >= local) {
      saveResumeBatch([
        {
          id: metaId,
          ms: remoteMs,
          season,
          episode,
          t: Number.isFinite(remoteMtime) ? remoteMtime : undefined,
        },
      ]);
      return { ms: remoteMs, fromRemote: true, finished };
    }
    return { ms: local, fromRemote: false, finished };
  }
  return { ms: local, fromRemote: false, finished: false };
}
