import { useEffect, useRef } from "react";
import { cloudWriteId, libraryGetOne, libraryGetOneStrict, type LibraryItem } from "@/lib/stremio";
import { cloudLibraryPut, flushWriteQueue, queuedWatched } from "@/lib/stremio-write-queue";
import { withItemLock } from "@/lib/stremio-item-lock";
import { freshestWatched } from "@/lib/stremio-watched-sync";
import type { PlayerSnapshot } from "@/lib/player/bridge";
import { getPlaybackPosition, subscribePlaybackClock } from "@/lib/player/playback-clock";
import { useProfiles } from "@/lib/profiles";
import { recordWatchedBy } from "@/lib/watched-by";
import { recordAnimeCwId } from "@/lib/anime-cw-ids";
import type { PlayerSrc } from "@/lib/view";
import { resumeLibraryGetOne } from "@/lib/player/resume-start";

const ANIME_SCHEME = /^(kitsu|mal|anilist|anidb):/;

const TICK_MS = 30000;
const BASE_REFRESH_MS = 30000;
const MIN_POSITION_SEC = 6;
const CREDITS_RATIO = 0.9;
const STUB_MAX_SEC = 150;

let activeFlusher: (() => Promise<void>) | null = null;

export async function flushCloudSync(): Promise<void> {
  if (activeFlusher) await activeFlusher().catch(() => {});
  await flushWriteQueue().catch(() => {});
}

export function useStremioSync(params: {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  authKey: string | null;
  resolvedImdbId: string | null;
  resolvedImdbVerified: boolean;
  resolutionSettled: boolean;
  castActiveRef?: { current: boolean };
}) {
  const {
    src,
    snap,
    authKey,
    resolvedImdbId,
    resolvedImdbVerified,
    resolutionSettled,
    castActiveRef,
  } = params;
  const canonicalId = cloudWriteId(src.meta.id, resolvedImdbId, resolvedImdbVerified);
  const watcherProfileId = useProfiles().activeProfile?.id ?? null;
  useEffect(() => {
    if (!resolutionSettled) return;
    const watchedId = canonicalId ?? src.meta.id;
    if (watchedId) recordWatchedBy(watchedId, watcherProfileId);
  }, [resolutionSettled, canonicalId, src.meta.id, watcherProfileId]);
  useEffect(() => {
    if (
      ANIME_SCHEME.test(src.meta.id) &&
      resolvedImdbVerified &&
      resolvedImdbId?.startsWith("tt")
    ) {
      recordAnimeCwId(resolvedImdbId, src.meta.id);
    }
  }, [resolvedImdbId, resolvedImdbVerified, src.meta.id]);
  const sessionStartRef = useRef<number>(Date.now());
  const lastSyncedRef = useRef(0);
  const baseItemRef = useRef<LibraryItem | null>(null);
  const fetchedRef = useRef<string | null>(null);
  const lastWrittenMtimesRef = useRef<Set<string>>(new Set());
  const sessionCidRef = useRef<string | null>(null);
  const lastGoodPosRef = useRef(0);
  const wroteOnceRef = useRef(false);
  const loadResetSeenRef = useRef(true);
  const latestRef = useRef({ src, snap, authKey, canonicalId, resolutionSettled });
  latestRef.current = { src, snap, authKey, canonicalId, resolutionSettled };

  const ourVideoId = videoIdFor(src, canonicalId);

  useEffect(() => {
    const vid = ourVideoId;
    if (vid && baseItemRef.current) {
      const { src: s, snap: sn, authKey: ak } = latestRef.current;
      const cid = sessionCidRef.current ?? latestRef.current.canonicalId;
      const base = baseItemRef.current?._id === cid ? baseItemRef.current : null;
      const seeded = base?.state as { video_id?: string; timeOffset?: number } | undefined;
      const alreadyResumed =
        seeded?.video_id === vid && (seeded?.timeOffset ?? 0) > MIN_POSITION_SEC * 1000;
      if (ak && cid && base && !alreadyResumed) {
        void writeLibraryItem(ak, s, sn, base, cid, 0.001, false, vid).then((mt) => {
          if (mt) lastWrittenMtimesRef.current.add(mt);
        });
      }
    }
    return () => {
      const { src: s, snap: sn, authKey: ak } = latestRef.current;
      const cid = sessionCidRef.current ?? latestRef.current.canonicalId;
      if (!ak || !cid || !vid) return;
      const pos = getPlaybackPosition() || lastGoodPosRef.current;
      if (pos < MIN_POSITION_SEC) return;
      const base = baseItemRef.current?._id === cid ? baseItemRef.current : null;
      void writeLibraryItem(ak, s, sn, base, cid, pos, false, vid).then((mt) => {
        if (mt) lastWrittenMtimesRef.current.add(mt);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ourVideoId, src.url]);

  useEffect(() => {
    sessionStartRef.current = Date.now();
    lastGoodPosRef.current = 0;
    loadResetSeenRef.current = false;
  }, [ourVideoId, src.url]);

  useEffect(() => {
    if (loadResetSeenRef.current) return;
    if (snap.status === "loading" || (snap.positionSec === 0 && snap.durationSec === 0)) {
      loadResetSeenRef.current = true;
    }
  }, [snap.status, snap.positionSec, snap.durationSec]);

  useEffect(() => {
    sessionCidRef.current = null;
    wroteOnceRef.current = false;
  }, [src.meta.id]);

  useEffect(
    () =>
      subscribePlaybackClock(() => {
        const pos = getPlaybackPosition();
        if (pos >= MIN_POSITION_SEC) lastGoodPosRef.current = pos;
      }),
    [],
  );

  useEffect(() => {
    if (!authKey) return;
    if (!canonicalId) return;
    if (fetchedRef.current === canonicalId) return;
    fetchedRef.current = canonicalId;
    let cancelled = false;
    void resumeLibraryGetOne(authKey, canonicalId).then((item) => {
      if (cancelled) return;
      baseItemRef.current = item;
    });
    return () => {
      cancelled = true;
    };
  }, [authKey, canonicalId]);

  useEffect(() => {
    if (!authKey || !canonicalId) return;
    const id = window.setInterval(() => {
      void libraryGetOne(authKey, canonicalId).then((item) => {
        if (item && item._id === latestRef.current.canonicalId) baseItemRef.current = item;
      });
    }, BASE_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [authKey, canonicalId]);

  const writeWithFreshBase = async (isTerminal: boolean, withGet: boolean) => {
    const {
      src: s,
      snap: sn,
      authKey: ak,
      canonicalId: liveCid,
      resolutionSettled: settled,
    } = latestRef.current;
    if (!ak || !settled || !loadResetSeenRef.current) return;
    const cid = sessionCidRef.current ?? liveCid;
    if (!cid) return;
    const pos = getPlaybackPosition() || lastGoodPosRef.current;
    if (pos < MIN_POSITION_SEC || sn.durationSec <= 0) return;
    const vid = videoIdFor(s, cid);
    const fresh =
      withGet || !wroteOnceRef.current ? await libraryGetOne(ak, cid).catch(() => null) : null;
    if (fresh) baseItemRef.current = fresh;
    const base = fresh ?? (baseItemRef.current?._id === cid ? baseItemRef.current : null);
    const remoteMs = (base?.state?.timeOffset ?? 0) as number;
    const remoteMtimeStr = String((base as { _mtime?: string } | null)?._mtime ?? "");
    const remoteMtime = /^\d+$/.test(remoteMtimeStr)
      ? Number(remoteMtimeStr)
      : Date.parse(remoteMtimeStr);
    const remoteVid =
      ((base?.state as Record<string, unknown> | undefined)?.video_id as string | undefined) ?? cid;
    const ourMs = Math.floor(pos * 1000);
    if (
      !lastWrittenMtimesRef.current.has(remoteMtimeStr) &&
      remoteVid === vid &&
      Number.isFinite(remoteMtime) &&
      remoteMtime > sessionStartRef.current &&
      remoteMs > ourMs + 60_000
    ) {
      return;
    }
    lastSyncedRef.current = ourMs;
    const wroteMtime = await writeLibraryItem(ak, s, sn, base, cid, pos, isTerminal);
    if (wroteMtime) {
      lastWrittenMtimesRef.current.add(wroteMtime);
      sessionCidRef.current = cid;
      wroteOnceRef.current = true;
    }
  };

  const writeFlushFast = (): Promise<void> => {
    const {
      src: s,
      snap: sn,
      authKey: ak,
      canonicalId: liveCid,
      resolutionSettled: settled,
    } = latestRef.current;
    if (!ak || !settled || !loadResetSeenRef.current) return Promise.resolve();
    const cid = sessionCidRef.current ?? liveCid;
    if (!cid) return Promise.resolve();
    const pos = getPlaybackPosition() || lastGoodPosRef.current;
    if (pos < MIN_POSITION_SEC || sn.durationSec <= 0) return Promise.resolve();
    const base = baseItemRef.current?._id === cid ? baseItemRef.current : null;
    return writeLibraryItem(ak, s, sn, base, cid, pos, true).then((mt) => {
      if (mt) lastWrittenMtimesRef.current.add(mt);
    });
  };
  const writeFlushFastRef = useRef(writeFlushFast);
  writeFlushFastRef.current = writeFlushFast;

  useEffect(() => {
    const flusher = () => writeFlushFastRef.current();
    activeFlusher = flusher;
    return () => {
      if (activeFlusher === flusher) activeFlusher = null;
    };
  }, []);

  useEffect(() => {
    if (!authKey) return;
    const id = window.setInterval(() => {
      const { snap: sn } = latestRef.current;
      const active = sn.status === "playing" || castActiveRef?.current === true;
      if (!active || !loadResetSeenRef.current) return;
      const pos = getPlaybackPosition();
      if (pos < MIN_POSITION_SEC || sn.durationSec <= 0) return;
      if (
        import.meta.env.DEV &&
        Date.now() - sessionStartRef.current > 30000 &&
        !wroteOnceRef.current
      ) {
        console.warn("[stremio-sync] playing >30s with zero successful cloud writes");
      }
      const ms = pos * 1000;
      if (Math.abs(ms - lastSyncedRef.current) < 4000) return;
      void writeWithFreshBase(false, false);
    }, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authKey]);

  useEffect(() => {
    if (snap.status === "paused") void writeWithFreshBase(false, true);
    if (snap.status === "ended" || snap.status === "error") void writeWithFreshBase(true, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.status]);

  useEffect(() => {
    return () => {
      void writeWithFreshBase(true, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onHide = () => {
      void writeFlushFastRef.current();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);
}

export function videoIdFor(s: PlayerSrc, cid: string | null): string | null {
  if (!cid) return null;
  const isSeries = s.meta.type === "series" || !!s.episode;
  if (!isSeries || !s.episode) return cid;
  const threaded = s.episode.videoId ?? s.episode.kitsuStreamId;
  if (threaded && threaded.split(":")[0] === cid.split(":")[0]) return threaded;
  if (cid.startsWith("tt") && s.episode.imdbSeason != null && s.episode.imdbEpisode != null) {
    return `${cid}:${s.episode.imdbSeason}:${s.episode.imdbEpisode}`;
  }
  if (cid.startsWith("tt") && threaded && ANIME_SCHEME.test(threaded)) return null;
  return `${cid}:${s.episode.season}:${s.episode.episode}`;
}

type StremioBehaviorHints = {
  defaultVideoId: string | null;
  featuredVideoId: string | null;
  hasScheduledVideos: boolean;
  [extra: string]: unknown;
};

type StremioLibraryItemState = {
  lastWatched: string | null;
  timeWatched: number;
  timeOffset: number;
  overallTimeWatched: number;
  timesWatched: number;
  flaggedWatched: number;
  duration: number;
  video_id: string | null;
  watched: string | null;
  lastVidReleased: string | null;
  noNotif: boolean;
};

type StremioLibraryItem = {
  _id: string;
  name: string;
  type: string;
  poster: string | null;
  posterShape: "square" | "landscape" | "poster";
  removed: boolean;
  temp: boolean;
  _ctime: string | null;
  _mtime: string;
  state: StremioLibraryItemState;
  behaviorHints: StremioBehaviorHints;
};

function pickPosterShape(value: unknown): "square" | "landscape" | "poster" {
  if (value === "square" || value === "landscape" || value === "poster") return value;
  return "poster";
}

async function writeLibraryItem(
  authKey: string,
  src: PlayerSrc,
  snap: PlayerSnapshot,
  base: LibraryItem | null,
  canonicalId: string,
  positionSec: number,
  isTerminal: boolean,
  vidOverride?: string,
): Promise<string | null> {
  if (snap.durationSec > 0 && snap.durationSec < STUB_MAX_SEC) return null;
  if (!base) {
    try {
      base = await libraryGetOneStrict(authKey, canonicalId);
    } catch {
      return null;
    }
  }
  const baseName = typeof base?.name === "string" ? base.name.trim() : "";
  const metaName = (src.meta.name ?? "").trim();
  const isAnimeWrite = /^(kitsu|mal|anilist|anidb):/.test(canonicalId) || src.meta.type === "anime";
  const name = isAnimeWrite ? baseName || metaName : metaName || baseName;
  if (!name) return null;

  const now = new Date().toISOString();
  const baseRecord = base as unknown as Record<string, unknown> | null;
  const baseState = (baseRecord?.state ?? {}) as Record<string, unknown>;
  const offsetMs = Math.max(0, Math.floor(positionSec * 1000));
  const durationMs = Math.max(0, Math.floor(snap.durationSec * 1000));
  const watchedRatio = positionSec / Math.max(1, snap.durationSec);
  const isSeries = src.meta.type === "series" || !!src.episode;
  const derivedVid = vidOverride ?? videoIdFor(src, canonicalId);
  if (isSeries && src.episode && !derivedVid) return null;
  const videoId = derivedVid ?? canonicalId;
  const prevVideoId = typeof baseState.video_id === "string" ? baseState.video_id : null;
  const videoChanged = prevVideoId !== null && prevVideoId !== videoId;
  const prevTimesWatched = typeof baseState.timesWatched === "number" ? baseState.timesWatched : 0;
  const prevTimeWatched = typeof baseState.timeWatched === "number" ? baseState.timeWatched : 0;
  const prevOverall =
    typeof baseState.overallTimeWatched === "number" ? baseState.overallTimeWatched : 0;
  const prevWatched =
    typeof baseState.watched === "string" && baseState.watched.length > 0
      ? baseState.watched
      : null;
  const prevLastVidReleased =
    typeof baseState.lastVidReleased === "string" ? baseState.lastVidReleased : null;
  const prevFlagged = typeof baseState.flaggedWatched === "number" ? baseState.flaggedWatched : 0;
  const priorDuration = typeof baseState.duration === "number" ? baseState.duration : 0;
  const durationShrunk =
    !src.episode && priorDuration > 0 && durationMs > 0 && durationMs < priorDuration * 0.7;
  const playedReal = snap.status !== "error" && !durationShrunk;
  const nowFlagged = durationMs > 0 && watchedRatio > CREDITS_RATIO && playedReal;
  const meaningfulResume =
    playedReal && durationMs > 0 && offsetMs >= 45000 && watchedRatio < CREDITS_RATIO;
  const effPrevFlagged = videoChanged || meaningfulResume ? 0 : prevFlagged;
  let finaleDone = false;
  if (isTerminal && nowFlagged && isSeries && src.episode) {
    const vids = (src.meta.videos ?? []).filter(
      (v) => typeof v.episode === "number" && (v.season ?? 0) >= 1,
    );
    if (vids.length > 0) {
      const key = (s: number, e: number) => s * 100000 + e;
      const maxKey = vids.reduce((m, v) => Math.max(m, key(v.season ?? 1, v.episode ?? 0)), 0);
      const metaIsTt = src.meta.id.startsWith("tt");
      const curSeason = metaIsTt
        ? (src.episode.imdbSeason ?? src.episode.season)
        : src.episode.season;
      const curEpisode = metaIsTt
        ? (src.episode.imdbEpisode ?? src.episode.episode)
        : src.episode.episode;
      finaleDone = key(curSeason, curEpisode) >= maxKey;
    }
  }

  const state: StremioLibraryItemState = {
    lastWatched: now,
    timeWatched: offsetMs,
    timeOffset: finaleDone ? 0 : offsetMs,
    overallTimeWatched: prevOverall + (videoChanged ? prevTimeWatched : 0),
    timesWatched: nowFlagged && effPrevFlagged === 0 ? prevTimesWatched + 1 : prevTimesWatched,
    flaggedWatched: nowFlagged ? 1 : effPrevFlagged,
    duration: durationMs,
    video_id: videoId,
    watched: prevWatched,
    lastVidReleased: prevLastVidReleased,
    noNotif: baseState.noNotif === true,
  };

  const baseBehaviorHints =
    (baseRecord?.behaviorHints as StremioBehaviorHints | null | undefined) ?? null;
  const behaviorHints: StremioBehaviorHints = {
    defaultVideoId: baseBehaviorHints?.defaultVideoId ?? null,
    featuredVideoId: baseBehaviorHints?.featuredVideoId ?? null,
    hasScheduledVideos: baseBehaviorHints?.hasScheduledVideos ?? false,
  };

  const baseCtime = typeof baseRecord?._ctime === "string" ? (baseRecord._ctime as string) : null;
  const ctime = baseCtime ?? now;

  const metaPoster =
    typeof src.meta.poster === "string" && src.meta.poster.length > 0 ? src.meta.poster : null;
  const basePoster =
    typeof base?.poster === "string" && base.poster.length > 0 ? base.poster : null;
  const baseType = base?.type === "series" || base?.type === "movie" ? base.type : null;
  let removed = base ? base.removed === true : true;
  let temp = base ? base.temp === true : true;
  if (temp && state.timesWatched === 0) removed = true;
  if (removed) temp = true;

  return withItemLock(canonicalId, async () => {
    if (isSeries && !isAnimeWrite) {
      const baseMtimeRaw = (baseRecord as { _mtime?: unknown } | null)?._mtime;
      const baseMtime =
        typeof baseMtimeRaw === "number"
          ? baseMtimeRaw
          : Date.parse(String(baseMtimeRaw ?? "")) || 0;
      let bestWatched = prevWatched;
      let bestMtime = Number.isFinite(baseMtime) ? baseMtime : 0;
      const cached = freshestWatched(canonicalId);
      if (cached && cached.watched != null && cached.mtime >= bestMtime) {
        bestWatched = cached.watched;
        bestMtime = cached.mtime;
      }
      const queued = queuedWatched(canonicalId);
      if (queued && queued.watched != null && queued.mtime >= bestMtime) {
        bestWatched = queued.watched;
        bestMtime = queued.mtime;
      }
      {
        const strictGet = libraryGetOneStrict(authKey, canonicalId).catch(() => null);
        const fresh = isTerminal
          ? await Promise.race([
              strictGet,
              new Promise<null>((r) => setTimeout(() => r(null), 400)),
            ])
          : await strictGet;
        const fw = fresh?.state?.watched;
        if (typeof fw === "string" && fw.length > 0) {
          const fmRaw = (fresh as { _mtime?: unknown } | null)?._mtime;
          const fm = typeof fmRaw === "number" ? fmRaw : Date.parse(String(fmRaw ?? "")) || 0;
          if (Number.isFinite(fm) && fm >= bestMtime) {
            bestWatched = fw;
            bestMtime = fm;
          }
        }
      }
      state.watched = bestWatched;
    }
    const item: StremioLibraryItem = {
      _id: canonicalId,
      name,
      type: src.episode ? "series" : (baseType ?? (isSeries ? "series" : "movie")),
      poster: metaPoster ?? basePoster,
      posterShape: pickPosterShape(baseRecord?.posterShape),
      removed,
      temp,
      _ctime: ctime,
      _mtime: now,
      state,
      behaviorHints,
    };
    const ok = await cloudLibraryPut(authKey, item as unknown as LibraryItem);
    return ok ? now : null;
  });
}
