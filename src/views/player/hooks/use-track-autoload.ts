import { useEffect, useRef, useState, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { langScore, pickBestTrack } from "@/lib/subtitles/language";
import { fetchSubtitlesIntoPlayer, streamHintsOf } from "@/lib/subtitles/fetch-into-player";
import { publishSubtitleSearch } from "@/components/player/subtitle-menu/subtitle-search-store";
import { readPlayerPrefs, type PerShowPrefs } from "@/lib/player-prefs";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { buildStreamIds } from "@/lib/streams/stream-ids";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { canStartSubtitleAutoload, subtitleSearchImdbId } from "@/lib/subtitles/autoload";
import { pickDesiredSubtitleTrack } from "@/lib/subtitles/track-selection";

export function useTrackAutoload(params: {
  bridgeRef: RefObject<PlayerBridge | null>;
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  settings: Settings;
  authKey: string | null;
}) {
  const { bridgeRef, src, snap, engine, settings, authKey } = params;
  const snapRef = useRef(snap);
  snapRef.current = snap;

  const [resolvedImdbId, setResolvedImdbId] = useState<string | null>(null);
  const [resolvedImdbVerified, setResolvedImdbVerified] = useState(false);
  const [resolutionSettled, setResolutionSettled] = useState(false);
  useEffect(() => {
    setResolvedImdbId(null);
    setResolvedImdbVerified(false);
    setResolutionSettled(false);
    if (src.imdbId) {
      setResolvedImdbId(src.imdbId);
      setResolvedImdbVerified(src.imdbIdVerified === true);
      setResolutionSettled(true);
      return;
    }
    const raw = src.meta.id ?? "";
    if (raw.startsWith("tt")) {
      setResolvedImdbId(raw);
      setResolvedImdbVerified(true);
      setResolutionSettled(true);
      return;
    }
    if (!settings.tmdbKey) {
      setResolutionSettled(true);
      return;
    }
    let cancelled = false;
    tmdbImdbId(settings.tmdbKey, raw)
      .then((id) => {
        if (cancelled) return;
        setResolvedImdbId(id);
        setResolvedImdbVerified(!!id);
        setResolutionSettled(true);
      })
      .catch(() => {
        if (!cancelled) setResolutionSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src.imdbId, src.imdbIdVerified, src.meta.id, settings.tmdbKey]);

  const [userAddonsState, setUserAddonsState] = useState<{
    authKey: string | null;
    addons: Addon[] | null;
  }>({ authKey, addons: null });
  const userAddons = userAddonsState.authKey === authKey ? userAddonsState.addons : null;
  useEffect(() => {
    let cancelled = false;
    gatherSubtitleAddons(authKey)
      .then((a) => {
        if (!cancelled) setUserAddonsState({ authKey, addons: a });
      })
      .catch(() => {
        if (!cancelled) setUserAddonsState({ authKey, addons: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const refetchRef = useRef<(() => Promise<number>) | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshReady, setRefreshReady] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  useEffect(() => {
    refetchRef.current = null;
    setRefreshReady(false);
    setLastAdded(null);
    setRefreshing(false);
  }, [src.url]);

  useEffect(() => {
    if (!refreshReady) {
      publishSubtitleSearch(null);
      return;
    }
    publishSubtitleSearch({
      status: refreshing ? "searching" : "idle",
      lastAdded,
      hints: streamHintsOf(src),
      refresh: () => {
        if (!refetchRef.current || refreshing) return;
        setRefreshing(true);
        setLastAdded(null);
        void refetchRef.current()
          .then((n) => setLastAdded(n))
          .catch(() => setLastAdded(0))
          .finally(() => setRefreshing(false));
      },
    });
    return () => publishSubtitleSearch(null);
  }, [refreshReady, refreshing, lastAdded, src]);

  const autoSubLoadKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!resolutionSettled) return;
    const mediaReady = snap.audioTracks.length > 0 || snap.durationSec > 0;
    const enabled = settings.subProvidersEnabled ?? {};
    const readyAddons = enabled.addons === false ? [] : userAddons;
    const searchImdbId = subtitleSearchImdbId(resolvedImdbId, resolvedImdbVerified);
    const contentId = searchImdbId ?? src.meta.id;
    if (!canStartSubtitleAutoload({ imdbId: contentId, mediaReady, addons: readyAddons })) return;
    const key = `${contentId}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}|${src.url}`;
    if (autoSubLoadKeyRef.current === key) return;
    const subIsAnime =
      !!src.meta.id?.startsWith("kitsu:") ||
      !!src.meta.id?.startsWith("mal:") ||
      (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime");
    const rawLangs = resolveLangPreference(settings.preferredSubLangs, settings.preferredLanguages);
    const strippedLangs = rawLangs.filter((l) => !isJapanese(l));
    const langs = subIsAnime || strippedLangs.length === 0 ? rawLangs : strippedLangs;
    const candidateIds = buildStreamIds(
      src.meta.id,
      src.episode,
      searchImdbId ?? null,
      src.meta.behaviorHints?.defaultVideoId ?? null,
    );
    const animeIds = candidateIds.some((i) => i.startsWith("kitsu:") || i.startsWith("mal:"));
    const imdbEpAligned =
      !animeIds || src.episode?.imdbEpisode == null || src.episode.episode === src.episode.imdbEpisode;
    const searchSeason = imdbEpAligned
      ? src.episode?.imdbSeason ?? src.episode?.season
      : src.episode?.season;
    const searchEpisode = imdbEpAligned
      ? src.episode?.imdbEpisode ?? src.episode?.episode
      : src.episode?.episode;
    autoSubLoadKeyRef.current = key;
    void (async () => {
      console.info("[subs/autoload] starting", {
        imdbId: searchImdbId,
        candidateIds,
        season: searchSeason,
        episode: searchEpisode,
        langs,
      });
      const { videoHash, videoSize } = settings.subtitleAutoSync
        ? await resolveVideoHash(src)
        : {};
      if (videoHash) console.info(`[subs/autoload] moviehash ${videoHash} (${videoSize})`);
      const b = bridgeRef.current;
      if (!b || autoSubLoadKeyRef.current !== key) {
        console.warn("[subs/autoload] no bridge ready, skipping");
        return;
      }
      const base = {
        src,
        settings,
        addons: readyAddons ?? [],
        langs,
        searchImdbId,
        candidateIds,
        season: searchSeason,
        episode: searchEpisode,
        videoHash,
        videoSize,
      };
      refetchRef.current = async () => {
        const bridge = bridgeRef.current;
        if (!bridge || autoSubLoadKeyRef.current !== key) return 0;
        const skipUrls = new Set(
          (snapRef.current.subtitleTracks ?? []).map((t) => t.url ?? "").filter(Boolean),
        );
        const r = await fetchSubtitlesIntoPlayer({
          ...base,
          bridge,
          deep: true,
          skipUrls,
          isActive: () => autoSubLoadKeyRef.current === key,
        });
        console.info(`[subs/refresh] found ${r.found}, added ${r.added} new tracks`);
        return r.added;
      };
      setRefreshReady(true);
      const res = await fetchSubtitlesIntoPlayer({
        ...base,
        bridge: b,
        isActive: () => autoSubLoadKeyRef.current === key,
      });
      console.info(`[subs/autoload] found ${res.found}, added ${res.added} tracks`);
    })();
  }, [
    resolvedImdbId,
    resolvedImdbVerified,
    resolutionSettled,
    src,
    snap.audioTracks.length,
    snap.durationSec,
    userAddons,
    settings,
    bridgeRef,
  ]);

  const autoTrackKeyRef = useRef<string | null>(null);
  const prefsAppliedRef = useRef<string | null>(null);
  const autoSubIdRef = useRef<string | null>(null);
  const autoAudioIdRef = useRef<string | null>(null);
  useEffect(() => {
    autoSubIdRef.current = null;
    autoAudioIdRef.current = null;
  }, [src.url]);

  const preselectAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const choice = src.subtitlePreselect;
    if (!choice) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0 && snap.durationSec === 0) return;
    if (preselectAppliedRef.current === src.url) return;
    preselectAppliedRef.current = src.url;
    if (choice.off) {
      if (snap.subtitleTracks.some((t) => t.selected)) bridgeRef.current?.setSubtitleTrack(null);
      return;
    }
    if (choice.url) {
      void bridgeRef.current?.addSubtitle(choice.url, choice.lang, choice.title, true);
    }
  }, [src.url, src.subtitlePreselect, snap.audioTracks.length, snap.subtitleTracks, snap.durationSec, bridgeRef]);
  useEffect(() => {
    if (engine !== "mpv") return;
    bridgeRef.current?.setAudioDevice?.(settings.audioDevice);
  }, [engine, settings.audioDevice, bridgeRef]);
  useEffect(() => {
    const subIdSig = snap.subtitleTracks.map((t) => t.id).join(",");
    const audioIdSig = snap.audioTracks.map((t) => t.id).join(",");
    const key = `${src.url}|${audioIdSig}|${subIdSig}`;
    if (autoTrackKeyRef.current === key) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0) return;
    autoTrackKeyRef.current = key;
    bridgeRef.current?.setAudioNormalize(settings.audioNormalize);
    bridgeRef.current?.setAudioProfile?.(settings.audioProfile);

    const prefs = readPlayerPrefs(src.meta.id);
    const isAnime =
      !!src.meta.id?.startsWith("kitsu:") ||
      !!src.meta.id?.startsWith("mal:") ||
      (src.meta.genres ?? []).some((g) => g.toLowerCase() === "anime");
    const stripJaForNonAnime = (langs: string[]) => {
      if (isAnime) return langs;
      const kept = langs.filter((l) => !isJapanese(l));
      return kept.length > 0 ? kept : langs;
    };
    const baseAudio = stripJaForNonAnime(
      resolveLangPreference(settings.preferredAudioLangs, settings.preferredLanguages),
    );
    const baseSub = stripJaForNonAnime(
      resolveLangPreference(settings.preferredSubLangs, settings.preferredLanguages),
    );
    const audioLangs = prefs?.audioLang
      ? [prefs.audioLang, ...baseAudio.filter((l) => l !== prefs.audioLang)]
      : baseAudio;
    const subLangs = prefs?.subLang
      ? [prefs.subLang, ...baseSub.filter((l) => l !== prefs.subLang)]
      : baseSub;

    const allow = <T extends { title?: string; label?: string }>(tracks: T[]): T[] => {
      const words = blockWords(settings);
      if (words.length === 0) return tracks;
      const kept = tracks.filter((t) => !trackMatchesWords(t, words));
      return kept.length > 0 ? kept : tracks;
    };

    let effAudio: (typeof snap.audioTracks)[number] | null = null;
    if (snap.audioTracks.length > 0) {
      const cur = snap.audioTracks.find((t) => t.selected) ?? null;
      const userPicked =
        cur != null && autoAudioIdRef.current != null && cur.id !== autoAudioIdRef.current;
      if (userPicked) {
        effAudio = cur;
      } else {
        const want = pickBestTrack(allow(snap.audioTracks), audioLangs);
        effAudio = want ?? cur;
        if (want && (!cur || cur.id !== want.id)) {
          bridgeRef.current?.setAudioTrack(want.id);
          autoAudioIdRef.current = want.id;
        }
      }
    }
    const subsOff = subsOffFor(prefs, settings);
    if (subsOff) {
      if (snap.subtitleTracks.some((t) => t.selected)) bridgeRef.current?.setSubtitleTrack(null);
    } else if (!src.subtitlePreselect && snap.subtitleTracks.length > 0 && subLangs.length > 0) {
      const current = snap.subtitleTracks.find((t) => t.selected) ?? null;
      const userPicked =
        current != null && autoSubIdRef.current != null && current.id !== autoSubIdRef.current;
      const lockedToAuto =
        current != null && autoSubIdRef.current != null && !settings.subtitleAutoUpgrade;
      if (!userPicked && !lockedToAuto) {
        const nativeAudio =
          settings.forcedSubsWhenNativeAudio &&
          effAudio != null &&
          langScore(effAudio.lang ?? "", subLangs) >= 0;
        const want = nativeAudio
          ? (snap.subtitleTracks
            .filter(isForcedTrack)
            .sort(
              (a, b) => langScore(b.lang ?? "", subLangs) - langScore(a.lang ?? "", subLangs),
            )[0] ?? null)
          : pickDesiredSubtitleTrack(
              allow(snap.subtitleTracks),
              subLangs,
              settings.preferEmbeddedSubs,
            );
        if (want) {
          if (want.id !== current?.id) bridgeRef.current?.setSubtitleTrack(want.id);
          autoSubIdRef.current = want.id;
        }
      }
    }

    if (prefsAppliedRef.current !== src.meta.id) {
      prefsAppliedRef.current = src.meta.id;
      const savedRate = typeof prefs?.rate === "number" ? prefs.rate : null;
      const wanted = savedRate ?? settings.defaultPlaybackSpeed ?? 1;
      if (Number.isFinite(wanted) && wanted > 0 && Math.abs(wanted - snap.rate) > 0.001) {
        bridgeRef.current?.setRate(wanted);
      }
    }
  }, [engine, src.url, src.meta.id, snap.audioTracks, snap.subtitleTracks, snap.rate, settings]);

  useEffect(() => {
    bridgeRef.current?.setSubDelay(readPlayerPrefs(src.meta.id)?.subDelaySec ?? 0);
  }, [src.url, src.meta.id]);

  useEffect(() => {
    if (!subsOffFor(readPlayerPrefs(src.meta.id), settings)) return;
    const selected = snap.subtitleTracks.find((t) => t.selected);
    if (selected) bridgeRef.current?.setSubtitleTrack(null);
  }, [src.meta.id, snap.subtitleTracks, settings]);

  return { resolvedImdbId, resolvedImdbVerified, resolutionSettled };
}

function blockWords(s: Settings): string[] {
  return (s.trackBlockWords ?? []).map((w) => w.trim().toLowerCase()).filter(Boolean);
}

function trackMatchesWords(t: { title?: string; label?: string }, words: string[]): boolean {
  const hay = `${t.title ?? ""} ${t.label ?? ""}`.toLowerCase();
  return words.some((w) => hay.includes(w));
}

function isForcedTrack(t: { title?: string; label?: string }): boolean {
  return /\bforced\b/i.test(`${t.title ?? ""} ${t.label ?? ""}`);
}

function subsOffFor(prefs: PerShowPrefs | null, s: Settings): boolean {
  if (prefs?.subsOff != null) return prefs.subsOff;
  if (s.subtitlesOffByDefault) return true;
  if (prefs?.subLang) return false;
  return false;
}

function resolveLangPreference(
  primary: string[] | undefined,
  fallback: string[] | undefined,
): string[] {
  if (primary && primary.length > 0) return primary;
  if (fallback && fallback.length > 0) return fallback;
  return ["English"];
}

function isJapanese(lang: string): boolean {
  const l = lang.trim().toLowerCase();
  return l === "ja" || l === "jpn" || l === "jp" || l === "japanese";
}

function isLoopback(url: string): boolean {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(url);
}

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function resolveVideoHash(
  src: PlayerSrc,
): Promise<{ videoHash?: string; videoSize?: number }> {
  if (isLoopback(src.url)) return {};
  if (!src.url || src.url.startsWith("blob:")) return {};
  try {
    const mh = await raceTimeout(
      invoke<{ hash: string; size: number }>("compute_moviehash", {
        url: src.url,
        headers: src.headers,
        size: src.streamRef?.size ?? undefined,
      }),
      1800,
    );
    if (mh?.hash) return { videoHash: mh.hash, videoSize: mh.size };
  } catch {
    return {};
  }
  return {};
}
