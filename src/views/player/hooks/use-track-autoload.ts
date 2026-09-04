import { useEffect, useRef, useState, type RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { langScore, pickBestTrack, normalizeLang } from "@/lib/subtitles/language";
import { fetchSubtitlesIntoPlayer, streamHintsOf } from "@/lib/subtitles/fetch-into-player";
import { subtitleStreamDescriptor } from "@/lib/subtitles/provider-label";
import { publishSubtitleSearch } from "@/components/player/subtitle-menu/subtitle-search-store";
import { publishSubtitleContext } from "@/components/player/subtitle-menu/subtitle-context-store";
import { readPlayerPrefs, type PerShowPrefs } from "@/lib/player-prefs";
import { tmdbImdbId } from "@/lib/providers/tmdb";
import type { Addon } from "@/lib/addons";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { buildStreamIds } from "@/lib/streams/stream-ids";
import type { PlayerSrc } from "@/lib/view";
import type { Settings } from "@/lib/settings";
import { canStartSubtitleAutoload, subtitleSearchImdbId } from "@/lib/subtitles/autoload";
import {
  SubtitleAutoloadRunCoordinator,
  subtitleAutoloadLateSelectionAllowed,
  subtitleAutoloadSelectionLeaseValid,
} from "@/lib/subtitles/autoload-run";
import { resolveAnimeSearchCoords } from "@/lib/subtitles/anime-numbering";
import {
  isAutoSelectableSubtitleTrack,
  pickDesiredSubtitleTrack,
  subtitleAutoSelectionSignature,
} from "@/lib/subtitles/track-selection";
import { markAddedSub } from "@/lib/subtitles/added-subs";
import { markImportedSub } from "@/lib/player/imported-subs";
import { bindSubtitleDownloadAuth } from "@/lib/subtitles/provider-auth";
import {
  readRememberedSub,
  rememberedSubAppliesToStream,
  rememberedSubtitleLoadMetadata,
  rememberedSubtitleIsLocal,
  subtitleMediaKey,
} from "@/lib/subtitles/subtitle-memory";

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
  const selectedSubtitleId = snap.subtitleTracks.find((track) => track.selected)?.id ?? null;
  const subtitleSelectionStateRef = useRef({
    mediaUrl: src.url,
    selectedId: selectedSubtitleId,
    revision: 0,
  });
  if (subtitleSelectionStateRef.current.mediaUrl !== src.url) {
    subtitleSelectionStateRef.current = {
      mediaUrl: src.url,
      selectedId: selectedSubtitleId,
      revision: 0,
    };
  } else if (subtitleSelectionStateRef.current.selectedId !== selectedSubtitleId) {
    subtitleSelectionStateRef.current.selectedId = selectedSubtitleId;
    subtitleSelectionStateRef.current.revision += 1;
  }

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
  const [initialSearches, setInitialSearches] = useState(0);
  const [initialPreflight, setInitialPreflight] = useState({
    mediaUrl: src.url,
    settled: false,
  });
  const [refreshReady, setRefreshReady] = useState(false);
  const [lastAdded, setLastAdded] = useState<number | null>(null);
  const lastAddedTimer = useRef<number | null>(null);
  const clearLastAddedTimer = () => {
    if (lastAddedTimer.current != null) {
      window.clearTimeout(lastAddedTimer.current);
      lastAddedTimer.current = null;
    }
  };
  useEffect(() => {
    refetchRef.current = null;
    setRefreshReady(false);
    setLastAdded(null);
    setRefreshing(false);
    setInitialSearches(0);
    setInitialPreflight({ mediaUrl: src.url, settled: false });
    clearLastAddedTimer();
  }, [src.url]);

  useEffect(() => {
    if (!refreshReady) {
      publishSubtitleSearch(null);
      return;
    }
    publishSubtitleSearch({
      status: refreshing || initialSearches > 0 ? "searching" : "idle",
      lastAdded,
      hints: streamHintsOf(src),
      refresh: () => {
        if (!refetchRef.current || refreshing) return;
        setRefreshing(true);
        setLastAdded(null);
        clearLastAddedTimer();
        void refetchRef
          .current()
          .then((n) => setLastAdded(n))
          .catch(() => setLastAdded(0))
          .finally(() => {
            setRefreshing(false);
            clearLastAddedTimer();
            lastAddedTimer.current = window.setTimeout(() => setLastAdded(null), 5000);
          });
      },
      dismiss: () => {
        clearLastAddedTimer();
        setLastAdded(null);
      },
    });
    return () => publishSubtitleSearch(null);
  }, [refreshReady, refreshing, initialSearches, lastAdded, src]);

  useEffect(() => {
    if (!resolutionSettled) return;
    const searchImdbId = subtitleSearchImdbId(resolvedImdbId, resolvedImdbVerified);
    publishSubtitleContext({
      candidateIds: buildStreamIds(
        src.meta.id,
        src.episode,
        searchImdbId ?? null,
        src.meta.behaviorHints?.defaultVideoId ?? null,
      ),
      stremioId: src.meta.id ?? null,
      filename: subtitleStreamDescriptor(src.streamRef) ?? null,
    });
    return () => publishSubtitleContext(null);
  }, [resolutionSettled, resolvedImdbId, resolvedImdbVerified, src]);

  const autoSubLoadKeyRef = useRef<string | null>(null);
  const autoSubStagesRef = useRef(new Set<string>());
  const autoSubRunRef = useRef(new SubtitleAutoloadRunCoordinator());
  const autoSubIdRef = useRef<string | null>(null);
  const autoSubSourceRef = useRef<string | null>(null);
  const autoAudioIdRef = useRef<string | null>(null);
  useEffect(() => {
    autoSubRunRef.current.invalidate();
    autoSubLoadKeyRef.current = null;
    autoSubSourceRef.current = null;
    autoSubStagesRef.current.clear();
  }, [src.url]);
  useEffect(() => {
    if (!resolutionSettled) return;
    // The identity preflight needs a real duration. Audio tracks often appear first,
    // while duration is still zero; starting then permanently records an unmeasurable run.
    const mediaReady = snap.durationSec > 0;
    const enabled = settings.subProvidersEnabled ?? {};
    const readyAddons = enabled.addons === false ? [] : userAddons;
    if (readyAddons == null) return;
    const searchImdbId = subtitleSearchImdbId(resolvedImdbId, resolvedImdbVerified);
    const contentId = searchImdbId ?? src.meta.id;
    if (!canStartSubtitleAutoload({ imdbId: contentId, mediaReady })) {
      if (mediaReady) setInitialPreflight({ mediaUrl: src.url, settled: true });
      return;
    }
    const key = `${contentId}|${src.episode?.season ?? ""}|${src.episode?.episode ?? ""}|${src.url}`;
    const addonSignature = readyAddons
      .map((addon) => addon.transportUrl)
      .sort()
      .join("|");
    const stageKey = `${key}|all|${addonSignature}`;
    if (autoSubStagesRef.current.has(stageKey)) return;
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
    autoSubLoadKeyRef.current = key;
    autoSubStagesRef.current.add(stageKey);
    const runLease = autoSubRunRef.current.begin(key);
    const isActive = () =>
      autoSubLoadKeyRef.current === key && autoSubRunRef.current.isCurrent(runLease, key);
    setInitialPreflight({ mediaUrl: src.url, settled: false });
    void (async () => {
      const coords = await resolveAnimeSearchCoords({
        isAnime: subIsAnime,
        metaId: src.meta.id,
        imdbId: searchImdbId,
        imdbVerified: resolvedImdbVerified,
        episode: src.episode,
      });
      if (!isActive()) return;
      const animeIds = candidateIds.some((i) => i.startsWith("kitsu:") || i.startsWith("mal:"));
      const imdbEpAligned =
        !animeIds ||
        src.episode?.imdbEpisode == null ||
        src.episode.episode === src.episode.imdbEpisode;
      const searchSeason = coords
        ? coords.season
        : imdbEpAligned
          ? (src.episode?.imdbSeason ?? src.episode?.season)
          : src.episode?.season;
      const searchEpisode = coords
        ? coords.episode
        : imdbEpAligned
          ? (src.episode?.imdbEpisode ?? src.episode?.episode)
          : src.episode?.episode;
      publishSubtitleContext({
        candidateIds,
        stremioId: src.meta.id ?? null,
        filename: subtitleStreamDescriptor(src.streamRef) ?? null,
        searchSeason,
        searchEpisode,
      });
      console.info("[subs/autoload] starting unified stage", {
        imdbId: searchImdbId,
        candidateIds,
        numbering: coords?.mode ?? "default",
        season: searchSeason,
        episode: searchEpisode,
        langs,
      });
      const movieHashStageKey = `${key}|moviehash`;
      const shouldResolveMovieHash =
        canResolveVideoHash(src) && !autoSubStagesRef.current.has(movieHashStageKey);
      if (shouldResolveMovieHash) autoSubStagesRef.current.add(movieHashStageKey);
      const movieHashPromise = shouldResolveMovieHash ? resolveVideoHash(src) : null;
      const b = bridgeRef.current;
      if (!b || !isActive()) {
        console.warn("[subs/autoload] no bridge ready, skipping");
        return;
      }
      const base = {
        src,
        settings,
        addons: readyAddons,
        langs,
        searchImdbId,
        candidateIds,
        season: searchSeason,
        episode: searchEpisode,
        durationSec: snapRef.current.durationSec,
      };
      const selectionLease = {
        revision: subtitleSelectionStateRef.current.revision,
        selectedId: subtitleSelectionStateRef.current.selectedId,
      };
      const shouldAutoSelectForStage = (lateHash: boolean) => {
        if (bridgeRef.current?.canAutoSelectSubtitle?.() === false) return false;
        const state = subtitleSelectionStateRef.current;
        const currentTrack = snapRef.current.subtitleTracks.find((track) => track.selected) ?? null;
        const currentSelected = currentTrack?.id ?? null;
        const autoSource = autoSubSourceRef.current;
        const currentSelectionIsAutomatic =
          currentSelected != null &&
          (currentSelected === autoSubIdRef.current ||
            (autoSource != null &&
              (currentTrack?.originalUrl === autoSource || currentTrack?.url === autoSource)));
        const selectionLeaseValid = subtitleAutoloadSelectionLeaseValid({
          leaseRevision: selectionLease.revision,
          leaseSelectedId: selectionLease.selectedId,
          currentRevision: state.revision,
          currentSelectedId: currentSelected,
          currentSelectionIsAutomatic,
        });
        const stageAllowsSelection =
          !lateHash ||
          subtitleAutoloadLateSelectionAllowed({
            currentSelectedId: currentSelected,
            currentSelectionIsAutomatic,
            autoUpgradeEnabled: settings.subtitleAutoUpgrade,
          });
        return (
          isActive() &&
          !src.subtitlePreselect &&
          !subsOffFor(readPlayerPrefs(src.meta.id), settings) &&
          !rememberedSubAppliesToStream(
            readRememberedSub(
              subtitleMediaKey(src.meta.id, src.episode?.season, src.episode?.episode),
            ),
            src.streamRef,
          ) &&
          stageAllowsSelection &&
          selectionLeaseValid
        );
      };
      const shouldAutoSelect = () => shouldAutoSelectForStage(false);
      const shouldAutoSelectLateHash = () => shouldAutoSelectForStage(true);
      refetchRef.current = async () => {
        const bridge = bridgeRef.current;
        if (!bridge || !isActive()) return 0;
        const movieHash = await resolveVideoHash(src);
        if (!isActive()) return 0;
        const skipUrls = new Set(
          (snapRef.current.subtitleTracks ?? []).map((t) => t.url ?? "").filter(Boolean),
        );
        const r = await fetchSubtitlesIntoPlayer({
          ...base,
          ...movieHash,
          bridge,
          deep: true,
          skipUrls,
          isActive,
        });
        console.info(`[subs/refresh] found ${r.found}, added ${r.added} new tracks`);
        return r.added;
      };
      setRefreshReady(true);
      setInitialSearches((count) => count + 1);
      try {
        const res = await fetchSubtitlesIntoPlayer({
          ...base,
          bridge: b,
          shouldAutoSelect,
          isActive,
        });
        if (isActive() && res.selected) autoSubSourceRef.current = res.selected.url;
        console.info(`[subs/autoload] unified stage found ${res.found}, added ${res.added} tracks`);
      } finally {
        if (autoSubLoadKeyRef.current === key) {
          setInitialSearches((count) => Math.max(0, count - 1));
          setInitialPreflight({ mediaUrl: src.url, settled: true });
        }
      }

      // MovieHash improves exact-file matching, but remote range reads can be slow. Never
      // make the normal progressive search wait for it. Once ready, query only the built-in
      // hash-aware providers and merge any new exact matches into the existing track list.
      if (movieHashPromise) {
        void movieHashPromise
          .then(async ({ videoHash, videoSize }) => {
            if (!videoHash || !isActive()) return;
            console.info("[subs/autoload] moviehash ready", { videoSize });
            const bridge = bridgeRef.current;
            if (!bridge) return;
            const skipUrls = new Set(
              (snapRef.current.subtitleTracks ?? [])
                .map((track) => track.url ?? "")
                .filter(Boolean),
            );
            setInitialSearches((count) => count + 1);
            try {
              const result = await fetchSubtitlesIntoPlayer({
                ...base,
                bridge,
                videoHash,
                videoSize,
                providers: {
                  opensubtitles: false,
                  wyzie: false,
                  addons: false,
                  extras: true,
                },
                shouldAutoSelect: shouldAutoSelectLateHash,
                skipUrls,
                isActive,
              });
              if (isActive() && result.selected) {
                autoSubSourceRef.current = result.selected.url;
              }
              console.info(
                `[subs/autoload] moviehash stage found ${result.found}, added ${result.added} tracks`,
              );
            } finally {
              if (autoSubLoadKeyRef.current === key) {
                setInitialSearches((count) => Math.max(0, count - 1));
              }
            }
          })
          .catch((error) =>
            console.warn("[subs/autoload] moviehash enrichment failed", {
              error: error instanceof Error ? error.name : "unknown",
            }),
          );
      }
    })().catch((error) => {
      console.warn("[subs/autoload] unified stage failed", {
        error: error instanceof Error ? error.name : "unknown",
      });
      if (isActive()) setInitialPreflight({ mediaUrl: src.url, settled: true });
    });
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
  useEffect(() => {
    autoSubIdRef.current = null;
    autoAudioIdRef.current = null;
  }, [src.url]);

  const preselectAppliedRef = useRef<string | null>(null);
  useEffect(() => {
    const choice = src.subtitlePreselect;
    if (!choice) return;
    if (snap.audioTracks.length === 0 && snap.subtitleTracks.length === 0 && snap.durationSec === 0)
      return;
    if (preselectAppliedRef.current === src.url) return;
    preselectAppliedRef.current = src.url;
    if (choice.off) {
      bridgeRef.current?.setSubtitleTrack(null);
      return;
    }
    if (choice.url) {
      const url = choice.url;
      void bridgeRef.current
        ?.addSubtitle(url, choice.lang, choice.title, true, choice.metadata)
        ?.then((ok) => {
          if (ok) markAddedSub(url);
        });
    }
  }, [
    src.url,
    src.subtitlePreselect,
    snap.audioTracks.length,
    snap.subtitleTracks,
    snap.durationSec,
    bridgeRef,
  ]);
  const subRestoreWaitRef = useRef<{ key: string; startedAt: number } | null>(null);
  const subRestoreLogRef = useRef<string | null>(null);
  const subRestoreSelectRef = useRef<{
    key: string;
    attempts: number;
    attemptedAt: number;
  } | null>(null);
  const subRestoreAddRef = useRef<{ key: string; pending: boolean } | null>(null);
  const subRestoreTimerRef = useRef<{ id: number; dueAt: number } | null>(null);
  const [subRestoreTick, setSubRestoreTick] = useState(0);
  useEffect(() => {
    subRestoreWaitRef.current = null;
    subRestoreLogRef.current = null;
    subRestoreSelectRef.current = null;
    subRestoreAddRef.current = null;
    if (subRestoreTimerRef.current != null) {
      window.clearTimeout(subRestoreTimerRef.current.id);
      subRestoreTimerRef.current = null;
    }
    setSubRestoreTick(0);
    return () => {
      if (subRestoreTimerRef.current != null) {
        window.clearTimeout(subRestoreTimerRef.current.id);
        subRestoreTimerRef.current = null;
      }
    };
  }, [src.url]);
  useEffect(() => {
    if (src.subtitlePreselect) return;
    const remembered = readRememberedSub(
      subtitleMediaKey(src.meta.id, src.episode?.season, src.episode?.episode),
    );
    if (!remembered) return;
    if (!rememberedSubAppliesToStream(remembered, src.streamRef)) return;
    const mediaReady =
      snap.audioTracks.length > 0 || snap.subtitleTracks.length > 0 || snap.durationSec > 0;
    if (!mediaReady) return;
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (bridge.canAutoSelectSubtitle?.() === false) return;
    const sameLang = (a?: string | null, b?: string | null) =>
      normalizeLang(a ?? "") === normalizeLang(b ?? "");

    if (remembered.off) {
      if (snap.subtitleTracks.some((t) => t.selected)) bridge.setSubtitleTrack(null, "restore");
      autoSubIdRef.current = null;
      return;
    }

    if (remembered.source) {
      const source = remembered.source;
      const restoreKey = [
        src.url,
        remembered.streamKey ?? "",
        remembered.subId ?? "",
        remembered.provider ?? "",
        remembered.release ?? "",
        source,
      ].join("|");
      const scheduleRestoreCheck = (delayMs: number) => {
        const dueAt = Date.now() + Math.max(0, delayMs);
        const current = subRestoreTimerRef.current;
        if (current != null && current.dueAt <= dueAt) return;
        if (current != null) window.clearTimeout(current.id);
        const id = window.setTimeout(
          () => {
            subRestoreTimerRef.current = null;
            setSubRestoreTick((tick) => tick + 1);
          },
          Math.max(0, delayMs),
        );
        subRestoreTimerRef.current = { id, dueAt };
      };
      const norm = (v?: string | null) => normalizeLang(v ?? "");
      const bySubId = () =>
        remembered.subId && !rememberedSubtitleIsLocal(remembered)
          ? snap.subtitleTracks.find(
              (t) =>
                t.subId === remembered.subId &&
                (!remembered.provider || t.provider === remembered.provider) &&
                (!remembered.lang || norm(t.lang) === norm(remembered.lang)),
            )
          : undefined;
      const sameSource = (t: (typeof snap.subtitleTracks)[number]) =>
        [t.url, t.originalUrl, t.externalFilename].some(
          (url) => url != null && url.replace(/\\/g, "/") === source.replace(/\\/g, "/"),
        );
      // Release names can identify several different subtitle files. A cached
      // selection must restore its own bytes, not an earlier search result.
      const existing = snap.subtitleTracks.find(sameSource) ?? bySubId();
      if (!existing && subRestoreLogRef.current !== restoreKey) {
        subRestoreLogRef.current = restoreKey;
        console.info("[subs/restore] no match yet", {
          remembered: {
            lang: remembered.lang,
            subId: remembered.subId,
            provider: remembered.provider,
            release: remembered.release,
            title: remembered.title,
            matchConfidence: remembered.matchConfidence,
          },
          externalCandidates: snap.subtitleTracks
            .filter((t) => t.external)
            .map((t) => ({
              id: t.id,
              subId: t.subId,
              lang: t.lang,
              provider: t.provider,
              release: t.release,
              title: t.title,
              matchScore: t.matchScore,
              matchConfidence: t.matchConfidence,
            })),
        });
      }
      if (existing) {
        subRestoreWaitRef.current = null;
        subRestoreAddRef.current = null;
        if (existing.selected) {
          subRestoreSelectRef.current = null;
          autoSubIdRef.current = existing.id;
          if (remembered.imported && remembered.title) markImportedSub(remembered.title);
          else markAddedSub(source);
          return;
        }
        const selectionKey = `${restoreKey}|${existing.id}`;
        const previous = subRestoreSelectRef.current;
        const attempts = previous?.key === selectionKey ? previous.attempts : 0;
        const elapsed =
          previous?.key === selectionKey ? Date.now() - previous.attemptedAt : Infinity;
        if (attempts < 4 && elapsed >= 750) {
          console.info("[subs/restore] selecting remembered track", {
            id: existing.id,
            subId: existing.subId,
            via: sameSource(existing) ? "source" : "subId",
            release: existing.release,
            title: existing.title,
            matchConfidence: existing.matchConfidence,
            attempt: attempts + 1,
          });
          subRestoreSelectRef.current = {
            key: selectionKey,
            attempts: attempts + 1,
            attemptedAt: Date.now(),
          };
          bridge.setSubtitleTrack(existing.id, "restore");
        }
        if (attempts < 4) scheduleRestoreCheck(750);
        return;
      }
      subRestoreSelectRef.current = null;
      if (subRestoreWaitRef.current?.key !== restoreKey) {
        subRestoreWaitRef.current = { key: restoreKey, startedAt: Date.now() };
        subRestoreAddRef.current = null;
      }
      const waited = Date.now() - (subRestoreWaitRef.current?.startedAt ?? Date.now());
      const addNow = remembered.imported === true || waited > 12_000;
      if (!addNow) {
        scheduleRestoreCheck(12_000 - waited + 1);
        return;
      }
      if (subRestoreAddRef.current?.key === restoreKey) return;
      subRestoreAddRef.current = { key: restoreKey, pending: true };
      console.info("[subs/restore] re-adding remembered sub from source", {
        lang: remembered.lang,
        provider: remembered.provider,
        release: remembered.release,
        imported: remembered.imported === true,
      });
      void (async () => {
        const rememberedApiKey =
          remembered.downloadAuthKind === "subsource-api-key"
            ? settings.subsourceApiKey
            : remembered.downloadAuthKind === "subdl-api-key"
              ? settings.subdlApiKey
              : null;
        const downloadAuth = await bindSubtitleDownloadAuth(
          remembered.downloadAuthKind,
          rememberedApiKey,
        );
        if (subRestoreAddRef.current?.key !== restoreKey) return false;
        return bridge.addSubtitle(
          source,
          remembered.lang,
          remembered.title,
          true,
          rememberedSubtitleLoadMetadata(remembered, downloadAuth),
          "restore",
        );
      })().then((ok) => {
        if (subRestoreAddRef.current?.key !== restoreKey) return;
        subRestoreAddRef.current = { key: restoreKey, pending: false };
        if (!ok) return;
        if (remembered.imported && remembered.title) markImportedSub(remembered.title);
        else markAddedSub(source);
        setSubRestoreTick((tick) => tick + 1);
      });
      return;
    }

    if (snap.subtitleTracks.length === 0) return;
    const want =
      snap.subtitleTracks.find(
        (t) =>
          !t.external &&
          sameLang(t.lang, remembered.lang) &&
          (!remembered.title || t.title === remembered.title),
      ) ?? snap.subtitleTracks.find((t) => !t.external && sameLang(t.lang, remembered.lang));
    if (want) {
      if (!want.selected) bridge.setSubtitleTrack(want.id, "restore");
      autoSubIdRef.current = want.id;
    }
  }, [
    src.url,
    src.meta.id,
    src.episode,
    src.subtitlePreselect,
    snap.audioTracks.length,
    snap.subtitleTracks,
    snap.durationSec,
    bridgeRef,
    subRestoreTick,
    settings.subsourceApiKey,
    settings.subdlApiKey,
  ]);
  useEffect(() => {
    if (engine !== "mpv") return;
    bridgeRef.current?.setAudioDevice?.(settings.audioDevice);
  }, [engine, settings.audioDevice, bridgeRef]);
  useEffect(() => {
    const subIdSig = subtitleAutoSelectionSignature(snap.subtitleTracks);
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
      if (snap.subtitleTracks.some((t) => t.selected))
        bridgeRef.current?.setSubtitleTrack(null, "automatic");
    } else if (
      bridgeRef.current?.canAutoSelectSubtitle?.() !== false &&
      !rememberedSubAppliesToStream(
        readRememberedSub(subtitleMediaKey(src.meta.id, src.episode?.season, src.episode?.episode)),
        src.streamRef,
      ) &&
      !src.subtitlePreselect &&
      snap.subtitleTracks.length > 0 &&
      subLangs.length > 0
    ) {
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
              .filter((track) => isForcedTrack(track) && isAutoSelectableSubtitleTrack(track))
              .sort(
                (a, b) => langScore(b.lang ?? "", subLangs) - langScore(a.lang ?? "", subLangs),
              )[0] ?? null)
          : pickDesiredSubtitleTrack(
              allow(snap.subtitleTracks),
              subLangs,
              settings.preferEmbeddedSubs,
            );
        if (want) {
          if (want.id !== current?.id) bridgeRef.current?.setSubtitleTrack(want.id, "automatic");
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
    if (selected) bridgeRef.current?.setSubtitleTrack(null, "automatic");
  }, [src.meta.id, snap.subtitleTracks, settings]);

  return {
    resolvedImdbId,
    resolvedImdbVerified,
    resolutionSettled,
    subtitleSearchActive: refreshing || initialSearches > 0,
    subtitlePreflightSettled: initialPreflight.mediaUrl === src.url && initialPreflight.settled,
  };
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

function canResolveVideoHash(src: PlayerSrc): boolean {
  return !!src.url && !src.url.startsWith("blob:") && !isLoopback(src.url);
}

function raceTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function resolveVideoHash(
  src: PlayerSrc,
): Promise<{ videoHash?: string; videoSize?: number }> {
  if (!canResolveVideoHash(src)) return {};
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
