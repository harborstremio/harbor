import { useEffect, useMemo, useState } from "react";
import type { Meta } from "../cinemeta";
import type { Chapter } from "../player/bridge";
import type { PlayEpisode, PlayerStreamRef } from "../view";
import { fetchAdSegments } from "./adcorpus";
import { fingerprint } from "./fingerprint";
import { fetchAniSkipSegments, kitsuToMal } from "./aniskip";
import { chaptersToSegments } from "./chapters";
import { fetchIntroDbAppSegments } from "./introdb-app";
import { fetchSkipDbSegments } from "./skipdb";
import { fetchIntroDbSegments, readTheIntroDbKey, setTheIntroDbApiKey } from "./theintrodb";
import type { SkipSegment } from "./types";
import { getLocalCache } from "../simkl/activities";
import { useSettings } from "../settings";

export type { SkipSegment, SkipKind, SkipSource } from "./types";

const MIN_OUTRO_START_FRACTION = 0.5;
const MAX_SEGMENT_SEC = 360;

function parseKitsuId(id: string): number | null {
  if (!id.startsWith("kitsu:")) return null;
  const n = parseInt(id.slice("kitsu:".length).split(":")[0], 10);
  return Number.isFinite(n) ? n : null;
}

export function mergeSegments(sourcesInPriority: SkipSegment[][]): SkipSegment[] {
  const merged: SkipSegment[] = [];
  for (const list of sourcesInPriority) {
    if (!list) continue;
    for (const segment of list) {
      const hasOverlap = merged.some(
        (existing) => segment.startSec < existing.endSec && segment.endSec > existing.startSec,
      );
      if (!hasOverlap) merged.push(segment);
    }
  }
  return merged.sort((a, b) => a.startSec - b.startSec);
}

function resolveAnimeToExternalId(metaId: string): string | null {
  if (!metaId.startsWith("kitsu:")) return null;
  const kitsuStr = metaId.slice("kitsu:".length).split(":")[0];
  try {
    const cache = getLocalCache();
    if (!cache) return null;
    const simklId = cache.kitsuToSimkl[kitsuStr];
    if (simklId == null) return null;
    const imdbEntry = Object.entries(cache.imdbToSimkl).find(([, sid]) => sid === simklId);
    if (imdbEntry) return imdbEntry[0];
    const tmdbEntry = Object.entries(cache.tmdbToSimkl).find(([, sid]) => sid === simklId);
    if (tmdbEntry) {
      const tmdbKey = tmdbEntry[0];
      if (tmdbKey.startsWith("movie:")) return `tmdb:movie:${tmdbKey.slice("movie:".length)}`;
      if (tmdbKey.startsWith("tv:")) return `tmdb:tv:${tmdbKey.slice("tv:".length)}`;
    }
  } catch (e) {
    console.error("Failed to resolve anime ID to external ID", e);
  }
  return null;
}

export function useSkipSegments(
  meta: Meta,
  episode: PlayEpisode | undefined,
  chapters: Chapter[],
  durationSec: number,
  adSegments: SkipSegment[] = [],
): SkipSegment[] {
  const [aniSkip, setAniSkip] = useState<SkipSegment[]>([]);
  const [introDb, setIntroDb] = useState<SkipSegment[]>([]);
  const [skipDb, setSkipDb] = useState<SkipSegment[]>([]);
  const [introDbApp, setIntroDbApp] = useState<SkipSegment[]>([]);
  const { settings } = useSettings();
  const theIntroDbKey = readTheIntroDbKey(settings);
  const resolvedExternalId = useMemo(() => resolveAnimeToExternalId(meta.id), [meta.id]);
  const kitsuId = parseKitsuId(meta.id);
  const epNum = episode?.episode;
  const introSeason = episode?.imdbSeason ?? episode?.season;
  const introEpisode = episode?.imdbEpisode ?? episode?.episode;
  const introDbId =
    meta.id.startsWith("tt") || meta.id.startsWith("tmdb:")
      ? meta.id
      : episode?.imdbId && episode.imdbId.startsWith("tt")
        ? episode.imdbId
        : resolvedExternalId || meta.id;
  const skipImdbId = meta.id.startsWith("tt")
    ? meta.id
    : episode?.imdbId && episode.imdbId.startsWith("tt")
      ? episode.imdbId
      : resolvedExternalId && resolvedExternalId.startsWith("tt")
        ? resolvedExternalId
        : null;

  useEffect(() => {
    setTheIntroDbApiKey(theIntroDbKey);
  }, [theIntroDbKey]);

  useEffect(() => {
    setAniSkip([]);
    if (kitsuId == null || epNum == null || durationSec <= 0) return;
    let cancelled = false;
    (async () => {
      const malId = await kitsuToMal(kitsuId);
      if (cancelled || malId == null) return;
      const segs = await fetchAniSkipSegments(malId, epNum, durationSec);
      if (cancelled) return;
      setAniSkip(segs);
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [kitsuId, epNum, durationSec]);

  useEffect(() => {
    setIntroDb([]);
    if (durationSec <= 0) return;
    if (!introDbId.startsWith("tmdb:") && !introDbId.startsWith("tt")) return;
    let cancelled = false;
    const ep =
      introSeason != null && introEpisode != null
        ? { season: introSeason, episode: introEpisode }
        : undefined;
    fetchIntroDbSegments(introDbId, ep, durationSec)
      .then((segs) => {
        if (!cancelled) setIntroDb(segs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [introDbId, introSeason, introEpisode, durationSec, theIntroDbKey]);

  useEffect(() => {
    setSkipDb([]);
    if (!skipImdbId || durationSec <= 0) return;
    let cancelled = false;
    const ep =
      introSeason != null && introEpisode != null
        ? { season: introSeason, episode: introEpisode }
        : undefined;
    fetchSkipDbSegments(skipImdbId, ep, durationSec)
      .then((segs) => {
        if (!cancelled) setSkipDb(segs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [skipImdbId, introSeason, introEpisode, durationSec]);

  useEffect(() => {
    setIntroDbApp([]);
    if (!skipImdbId || introSeason == null || introEpisode == null) return;
    let cancelled = false;
    fetchIntroDbAppSegments(skipImdbId, { season: introSeason, episode: introEpisode })
      .then((segs) => {
        if (!cancelled) setIntroDbApp(segs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [skipImdbId, introSeason, introEpisode]);

  const fromChapters = useMemo(
    () => chaptersToSegments(chapters, durationSec),
    [chapters, durationSec],
  );

  return useMemo(() => {
    const base = mergeSegments([adSegments, aniSkip, skipDb, introDb, introDbApp, fromChapters]);
    if (durationSec <= 0) return base;
    const minOutroStart = durationSec * MIN_OUTRO_START_FRACTION;
    return base
      .filter((s) => s.startSec < durationSec)
      .map((s) => (s.endSec > durationSec ? { ...s, endSec: durationSec } : s))
      .filter((s) => {
        const len = s.endSec - s.startSec;
        return len >= 2 && len <= MAX_SEGMENT_SEC;
      })
      .filter((s) => s.kind !== "outro" || s.startSec >= minOutroStart);
  }, [aniSkip, skipDb, introDb, introDbApp, fromChapters, durationSec, adSegments]);
}

export function useAdSegments(
  metaId: string,
  imdbId: string | null,
  streamRef: PlayerStreamRef | undefined,
  url: string,
  enabled: boolean,
): SkipSegment[] {
  const [segs, setSegs] = useState<SkipSegment[]>([]);
  const fp = useMemo(
    () => fingerprint(metaId, imdbId, streamRef, url),
    [metaId, imdbId, streamRef, url],
  );
  useEffect(() => {
    setSegs([]);
    if (!enabled) return;
    let cancelled = false;
    fetchAdSegments(fp.content, fp.source, true)
      .then((s) => {
        if (!cancelled) setSegs(s);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [enabled, fp.content, fp.source]);
  return segs;
}

export function activeSegment(
  segments: SkipSegment[],
  positionSec: number,
): SkipSegment | null {
  for (const s of segments) {
    if (positionSec >= s.startSec && positionSec < s.endSec - 0.75) return s;
  }
  return null;
}

export function prefetchSegments(meta: Meta, episode?: PlayEpisode): void {
  const kitsuId = parseKitsuId(meta.id);
  const epNum = episode?.episode;

  if (kitsuId != null && epNum != null) {
    kitsuToMal(kitsuId)
      .then((malId) => {
        if (malId != null) return fetchAniSkipSegments(malId, epNum, 0);
      })
      .catch(() => {});
  }

  const resolvedExternalId = resolveAnimeToExternalId(meta.id);
  const introDbId =
    meta.id.startsWith("tt") || meta.id.startsWith("tmdb:")
      ? meta.id
      : episode?.imdbId && episode.imdbId.startsWith("tt")
        ? episode.imdbId
        : resolvedExternalId || meta.id;

  if (introDbId.startsWith("tmdb:") || introDbId.startsWith("tt")) {
    const introSeason = episode?.imdbSeason ?? episode?.season;
    const introEpisode = episode?.imdbEpisode ?? episode?.episode;
    const ep =
      introSeason != null && introEpisode != null
        ? { season: introSeason, episode: introEpisode }
        : undefined;
    fetchIntroDbSegments(introDbId, ep, 0).catch(() => {});
    const tt = meta.id.startsWith("tt")
      ? meta.id
      : episode?.imdbId && episode.imdbId.startsWith("tt")
        ? episode.imdbId
        : resolvedExternalId && resolvedExternalId.startsWith("tt")
          ? resolvedExternalId
          : null;
    if (tt && ep) fetchIntroDbAppSegments(tt, ep).catch(() => {});
  }
}
