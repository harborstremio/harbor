import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUp,
  ChevronLeft,
  Filter,
  Loader2,
  PackageX,
  RefreshCw,
  X,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import { resolveAddonLogo } from "@/components/addon-logo";
import { torrentEngineStatus } from "@/lib/torrent/local-engine";
import { directTorrentEnabled, torrentsDisabled } from "@/lib/torrent/stremio-stream";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import {
  cachedDebridPreparationSignature,
  prepareCachedDebridStreams,
} from "@/lib/debrid/playback-preparation";
import { useTogether } from "@/lib/together/provider";
import { buildMatchScores, matchBadge, MATCH_CLOSE } from "@/lib/together/source-match";
import { HostSourceBanner } from "@/components/host-source-banner";
import { HoverTooltip } from "@/components/hover-tooltip";
import { StreamModeToggle } from "@/components/stream-mode-toggle";
import { filterStreamsByMode } from "@/lib/streams/mode";
import { consumeRecentStubEvent } from "@/lib/dead-streams";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import {
  readPlayback,
  readLastSeriesPlayback,
  streamMatchesEntry,
  streamMatchesReleaseLineage,
  streamMatchesSource,
} from "@/lib/playback-history";
import { readSeasonLock } from "@/lib/season-lock";
import { useSettings } from "@/lib/settings";
import type { ScoredStream, Tier } from "@/lib/streams/types";
import { isAddonRanked } from "@/lib/streams/addon-detect";
import { isFilterEmpty, matchesCustomFilter } from "@/lib/streams/custom-filters";
import { useScrollMemory, useView, type PlayEpisode, type PlayerSrc } from "@/lib/view";
import { prefetchSegments } from "@/lib/skip-intro";
import { exitWindowFullscreen } from "@/lib/fullscreen-state";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { AutoExhaustedModal } from "./play-picker/auto-exhausted-modal";
import { AutoPlayTransition } from "./play-picker/auto-play-transition";
import { BackdropLayer } from "./play-picker/backdrop-layer";
import { CinematicLoader } from "./play-picker/cinematic-loader";
import { DebridDownModal } from "./play-picker/debrid-down-modal";
import { P2pConfirmModal } from "./play-picker/p2p-confirm-modal";
import { CachedFilterPill, LanguageFilterPill } from "./play-picker/filter-pills";
import { PickerEmptyLadder } from "./play-picker/picker-empty-ladder";
import { NoSourcesConfiguredModal } from "./play-picker/no-sources-modal";
import {
  debridBanner,
  hasCachedMarker,
  hasUncachedMarker,
  isEngineWarmingError,
  normalizeLangCode,
  orderByAddonNative,
  playError,
  streamIdentity,
  streamMatchesLangs,
  translateDebridBannerTitle,
  translatePickerError,
} from "./play-picker/picker-utils";
import { PickerHeader, PickerNav } from "./play-picker/picker-header";
import { PrimaryCard } from "./play-picker/primary-card";
import { SourceDiagnostic } from "./play-picker/source-diagnostic";
import { CachedTip } from "./play-picker/cached-tip";
import { StremioLayout } from "./play-picker/stremio-layout";
import { SourceDrawer } from "./play-picker/source-drawer";
import { TierStrip } from "./play-picker/tier-strip";
import { usePickHandler, type ResolvingSelection } from "./play-picker/use-pick-handler";
import { useActiveKid } from "@/lib/profiles";
import { useAutoCandidates } from "./play-picker/use-auto-candidates";
import { useAutoFire } from "./play-picker/use-auto-fire";
import { useRoomInvite } from "./play-picker/use-room-invite";
import { useAddons } from "./play-picker/use-addons";
import { useAnimeAltTitles } from "./play-picker/use-anime-alt-titles";
import { useImdbId } from "./play-picker/use-imdb-id";
import { usePipelineResult } from "./play-picker/use-pipeline-result";
import { animeAbsoluteFromStreamIds } from "@/lib/streams/anime-identity";
import { useStreamIds } from "./play-picker/use-stream-ids";
import { findLocalEpisodeVersions, findLocalMovieVersions } from "@/lib/local-library/versions";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { downloadableSeasonPacks } from "@/lib/download/season-pack";
import { downloadSeasonPerEpisode } from "@/lib/download/season-download";
import { completedDownloadFor, type DownloadItem } from "@/lib/download/downloads-store";
import { downloadLocalEntry, downloadPlayerSrc } from "@/lib/download/player-src";
import { LocalStreamList } from "./play-picker/local-stream-card";
import { SubtitleSelectStep } from "./play-picker/subtitle-select-step";
import { prefetchResumeStart } from "@/lib/player/resume-start";
import { isLivePlaybackSrc } from "@/lib/player/live-src";

const TIER_ORDER: Tier[] = ["4K_DV", "4K_HDR", "4K", "1080p_HDR", "1080p", "720p", "SD", "ROUGH"];

const RESOLVE_TIMEOUT_MS = 150_000;

type PerEpisodeStatus =
  | { code: "checking"; total: number }
  | { code: "checked"; done: number; total: number }
  | { code: "already-downloading" }
  | { code: "no-source" }
  | { code: "queued"; queued: number; total: number }
  | { code: "failed" };

export function PlayPicker({
  meta,
  episode,
  autoPlay,
  attempt,
  intent,
  seasonEpisodes,
  resume,
  playerActive,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  autoPlay?: boolean;
  attempt?: number;
  intent?: "play" | "download";
  seasonEpisodes?: PlayEpisode[];
  resume?: boolean;
  playerActive?: boolean;
}) {
  const t = useT();
  const isDownload = intent === "download";
  const isSeasonDownload = isDownload && (seasonEpisodes?.length ?? 0) > 0;
  const { openPlayer, openSettings, exitPickerToDetail } = useView();
  const backToDetail = () => {
    if (playerActive) void exitWindowFullscreen();
    exitPickerToDetail(meta);
  };
  const { settings, update } = useSettings();
  const fs = useWindowFullscreen();
  const { authKey } = useAuth();
  const debrids = useDebridClients();
  const {
    snapshot: roomSnapshot,
    sendInvite,
    claimHost,
    wasInvitedTo,
    clientId,
    hostSource,
    roomGuestPick,
    lastInviteProto,
  } = useTogether();
  const inSession = roomSnapshot.state === "joined";
  const resolvedImdb = useImdbId(meta, settings.tmdbKey);
  useEffect(() => {
    prefetchSegments(meta, episode);
  }, [meta, episode]);
  const imdbId = resolvedImdb.id;
  useEffect(() => {
    if (!authKey || (!settings.resumePlayback && !settings.resumePrompt)) return;
    prefetchResumeStart({
      metaId: meta.id,
      authKey,
      imdbId,
      imdbVerified: resolvedImdb.verified,
    });
  }, [
    authKey,
    imdbId,
    meta.id,
    resolvedImdb.verified,
    settings.resumePlayback,
    settings.resumePrompt,
  ]);
  const streamIds = useStreamIds(meta, episode, imdbId);
  const animeAbsoluteEpisode = useMemo(() => animeAbsoluteFromStreamIds(streamIds), [streamIds]);
  const localMatches = useMemo(() => {
    const m = meta.id.match(/^tmdb:(?:movie|tv):(\d+)$/);
    const tmdbId = m ? parseInt(m[1], 10) : null;
    if (tmdbId == null && !imdbId) return [];
    return episode
      ? findLocalEpisodeVersions(episode.season, episode.episode, tmdbId, imdbId)
      : findLocalMovieVersions(tmdbId, imdbId);
  }, [meta.id, imdbId, episode]);
  const [downloadMatch, setDownloadMatch] = useState<DownloadItem | null>(null);
  useEffect(() => {
    if (isDownload) {
      setDownloadMatch(null);
      return;
    }
    let cancelled = false;
    completedDownloadFor(meta.id, episode?.season ?? null, episode?.episode ?? null)
      .then((item) => {
        if (!cancelled) setDownloadMatch(item);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDownload, meta.id, episode?.season, episode?.episode]);
  const downloadEntry = useMemo(
    () => (downloadMatch ? downloadLocalEntry(downloadMatch) : null),
    [downloadMatch],
  );
  const diskEntries = useMemo(
    () => (downloadEntry ? [downloadEntry, ...localMatches] : localMatches),
    [downloadEntry, localMatches],
  );
  const { addons } = useAddons(authKey, settings);
  const [seasonLogo, setSeasonLogo] = useState<string | undefined>(() =>
    peekCachedLogo(settings.tmdbKey, meta, { preferOwn: true }),
  );
  useEffect(() => {
    if (!/^(kitsu|mal|anilist|anidb):/.test(meta.id)) return;
    const seed = peekCachedLogo(settings.tmdbKey, meta, { preferOwn: true });
    if (seed) setSeasonLogo(seed);
    let cancelled = false;
    resolveLogo(settings.tmdbKey, meta, { preferOwn: true })
      .then((u) => {
        if (!cancelled && u) setSeasonLogo(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [meta, settings.tmdbKey]);
  const metaForDisplay = useMemo(
    () => (seasonLogo ? { ...meta, logo: seasonLogo } : meta),
    [meta, seasonLogo],
  );
  const [resolving, setResolving] = useState<ResolvingSelection | null>(null);
  const [failedStreams, setFailedStreams] = useState<Set<ScoredStream>>(new Set());
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [strictMode, setStrictMode] = useState(settings.streamFilterLevel === "strict");
  const [forceShowAll, setForceShowAll] = useState(false);
  const filterDisabled = settings.streamFilterLevel === "off" || forceShowAll || isDownload;
  const animeTitles = useAnimeAltTitles(meta);
  const {
    result,
    loading,
    pipelineDone,
    firstResultAt,
    autoSettleReady,
    addonQuorum,
    pipelineStartedAt,
    pickerError,
    refresh,
    setAutoSettleReady,
    setResolveError,
  } = usePipelineResult({
    meta,
    episode,
    imdbId,
    streamIds,
    addons,
    debrids,
    settings,
    strictMode,
    filterDisabled,
    animeTitles,
  });
  const baseLangs = settings.preferredLanguages ?? [];
  const isAnimeRequest = useMemo(
    () => (streamIds ?? []).some((id) => id.startsWith("kitsu:") || id.startsWith("mal:")),
    [streamIds],
  );
  const preferredLangs = useMemo(() => {
    const codes = settings.preferredAudioLangs ?? [];
    const animeAdd = isAnimeRequest ? ["Japanese"] : [];
    const all = [...baseLangs, ...codes, ...animeAdd];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const lang of all) {
      const code = normalizeLangCode(lang);
      if (!isAnimeRequest && code === "ja") continue;
      if (seen.has(code)) continue;
      seen.add(code);
      out.push(lang);
    }
    return out;
  }, [baseLangs, settings.preferredAudioLangs, isAnimeRequest]);
  const [langFilter, setLangFilter] = useState(
    settings.requirePreferredLanguage === true && baseLangs.length > 0,
  );
  const [cachedOnly, setCachedOnly] = useState(false);

  const { inviteKey, canInvite, inviteSentRef, hostSourceForMedia, expectHostSource } =
    useRoomInvite({
      meta,
      episode,
      inSession,
      roomSnapshot,
      clientId,
      hostSource,
      lastInviteProto,
      wasInvitedTo,
      claimHost,
      sendInvite,
    });

  useEffect(() => {
    setStrictMode(settings.streamFilterLevel === "strict");
    setForceShowAll(false);
  }, [meta.id, episode?.season, episode?.episode, settings.streamFilterLevel]);

  const hostMatch = useMemo(
    () =>
      hostSourceForMedia && result ? buildMatchScores(result.picker.all, hostSourceForMedia) : null,
    [result, hostSourceForMedia],
  );
  const matchFor = useCallback(
    (s: ScoredStream) => (hostMatch ? matchBadge(hostMatch.get(s)) : null),
    [hostMatch],
  );

  const isCached = useCallback(
    (s: ScoredStream) =>
      (s.url != null && !s.infoHash && !hasUncachedMarker(s)) ||
      debrids.some((d) => s.cached[d.slug] === true || s.inLibrary[d.slug] === true) ||
      hasCachedMarker(s),
    [debrids],
  );
  const hasStrongAddon = useMemo(
    () => (addons ?? []).some((a) => /mediafusion|comet/i.test(a.manifest?.name ?? "")),
    [addons],
  );
  const isTorrentioStream = useCallback(
    (s: ScoredStream) => /torrentio/i.test(s.addonName ?? ""),
    [],
  );

  const activeStreamFilter = useMemo(() => {
    const f = settings.customStreamFilters.find((x) => x.id === settings.activeStreamFilterId);
    return f && !isFilterEmpty(f) ? f : null;
  }, [settings.customStreamFilters, settings.activeStreamFilterId]);

  const filteredPicker = useMemo(() => {
    if (!result) return null;
    const candidatePool = isSeasonDownload
      ? downloadableSeasonPacks(
          result.picker.all,
          /^(kitsu|mal|anilist|anidb):/.test(meta.id) ? null : (episode?.season ?? null),
        )
      : result.picker.all;
    let all = filterStreamsByMode(candidatePool, settings.streamMode);
    if (langFilter && preferredLangs.length > 0) {
      const langFiltered = all.filter((s) => streamMatchesLangs(s, preferredLangs));
      if (langFiltered.length > 0) all = langFiltered;
    }
    if (cachedOnly && debrids.length > 0) {
      const cached = all.filter(isCached);
      if (cached.length > 0) all = cached;
    }
    let allRaw = all;
    let fellBack = false;
    if (activeStreamFilter && !hostMatch) {
      const matched = all.filter((s) => matchesCustomFilter(s, activeStreamFilter));
      if (matched.length > 0) all = matched;
      else fellBack = true;
    }
    if (all.length === 0 && candidatePool.length > 0) {
      all = candidatePool;
      allRaw = candidatePool;
      fellBack = true;
    }
    const cachedFirst = all.slice().sort((a, b) => (isCached(b) ? 1 : 0) - (isCached(a) ? 1 : 0));
    const ranked = hostMatch
      ? cachedFirst.slice().sort((a, b) => (hostMatch.get(b) ?? 0) - (hostMatch.get(a) ?? 0))
      : cachedFirst;
    const byTier: Partial<Record<Tier, ScoredStream>> = {};
    for (const s of ranked) if (!byTier[s.tier]) byTier[s.tier] = s;
    const hostBest =
      hostMatch && ranked.length > 0 && (hostMatch.get(ranked[0]) ?? 0) >= MATCH_CLOSE
        ? ranked[0]
        : null;
    const primaryCandidates = [hostBest, result.picker.primary, ...ranked].filter(
      (s): s is ScoredStream => s != null && all.includes(s),
    );
    const primary = primaryCandidates[0] ?? null;
    return { primary, byTier, all, allRaw, fellBack };
  }, [
    result,
    langFilter,
    preferredLangs,
    cachedOnly,
    debrids.length,
    isCached,
    hostMatch,
    activeStreamFilter,
    settings.streamMode,
    isSeasonDownload,
    meta.id,
    episode?.season,
  ]);

  const anyAddonRanked = useMemo(() => (addons ?? []).some((a) => isAddonRanked(a)), [addons]);
  const addonOrderMode = settings.streamSort === "addon" || anyAddonRanked;
  const displayStreams = useMemo(() => {
    const all = filteredPicker?.all ?? [];
    const base = addonOrderMode && result ? orderByAddonNative(all, result.raw.addon, addons) : all;
    if (!hostMatch) return base;
    return base.slice().sort((a, b) => (hostMatch.get(b) ?? 0) - (hostMatch.get(a) ?? 0));
  }, [filteredPicker, addonOrderMode, result, addons, hostMatch]);

  const playbackPreparationHint = useMemo(
    () =>
      episode ? { season: episode.season ?? null, episode: episode.episode ?? null } : undefined,
    [episode?.season, episode?.episode],
  );
  const playbackPreparationSignature = useMemo(
    () => cachedDebridPreparationSignature(displayStreams, debrids, playbackPreparationHint),
    [displayStreams, debrids, playbackPreparationHint],
  );
  const playbackPreparationInput = useRef({
    streams: displayStreams,
    debrids,
    hint: playbackPreparationHint,
  });
  playbackPreparationInput.current = {
    streams: displayStreams,
    debrids,
    hint: playbackPreparationHint,
  };

  useEffect(() => {
    if (!settings.instantPlaybackPreparation || isDownload || !playbackPreparationSignature) {
      return;
    }
    const ac = new AbortController();
    const { streams, debrids: clients, hint } = playbackPreparationInput.current;
    void prepareCachedDebridStreams(streams, clients, hint, ac.signal);
    return () => ac.abort();
  }, [settings.instantPlaybackPreparation, isDownload, playbackPreparationSignature]);

  const langHiddenCount = useMemo(() => {
    if (!result || preferredLangs.length === 0) return 0;
    return result.picker.all.filter((s) => !streamMatchesLangs(s, preferredLangs)).length;
  }, [result, preferredLangs]);

  const uncachedHiddenCount = useMemo(() => {
    if (!result || debrids.length === 0) return 0;
    return result.picker.all.filter((s) => !isCached(s)).length;
  }, [result, debrids.length, isCached]);

  const populatedTiers = useMemo(
    () => TIER_ORDER.filter((t) => filteredPicker?.byTier[t]),
    [filteredPicker],
  );

  useEffect(() => {
    if (!filteredPicker?.primary) return;
    setSelectedTier((s) => s ?? filteredPicker.primary!.tier);
  }, [filteredPicker]);

  const isAnimeMetaId = /^(kitsu|mal|anilist|anidb):/.test(meta.id);
  const previousPlayback = useMemo(
    () =>
      settings.rememberLastStream ? readPlayback(meta.id, episode?.season, episode?.episode) : null,
    [meta.id, episode?.season, episode?.episode, settings.rememberLastStream],
  );

  const seasonLock = settings.seasonSourceLock && (meta.type === "series" || isAnimeMetaId);
  const seasonLockEntry = useMemo(
    () =>
      seasonLock ? readSeasonLock(meta.id, isAnimeMetaId ? null : (episode?.season ?? null)) : null,
    [seasonLock, meta.id, episode?.season, isAnimeMetaId],
  );
  const lastSeriesSource = useMemo(
    () =>
      seasonLockEntry ??
      (settings.keepSourceNextEpisode && !!autoPlay && (meta.type === "series" || isAnimeMetaId)
        ? readLastSeriesPlayback(meta.id)
        : null),
    [seasonLockEntry, meta.id, meta.type, isAnimeMetaId, settings.keepSourceNextEpisode, autoPlay],
  );
  const lastSeriesSourceIsLineage = seasonLockEntry == null;

  const kidProfile = useActiveKid();
  const p2pAutoConsent = settings.p2pAutoConsent || !!kidProfile;
  const autoCandidates = useAutoCandidates({
    filteredPicker,
    previousPlayback,
    sourceEntry: lastSeriesSource,
    sourceEntryLineage: lastSeriesSourceIsLineage,
    isCached,
    addons,
    hasStrongAddon,
    isTorrentioStream,
    preferredLangs,
    hostSource: hostSourceForMedia,
    prefer1080: !!kidProfile,
    preferPacks: seasonLock,
    season: !isAnimeMetaId ? (episode?.season ?? null) : null,
    episode: !isAnimeMetaId ? (episode?.episode ?? null) : null,
    expectedTitle: meta.name,
    expectedTitles: animeTitles,
    isAnime: isAnimeRequest,
    filterDisabled,
  });

  const autoFiredRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const [autoAttemptIdx, setAutoAttemptIdx] = useState(0);
  const [autoExhausted, setAutoExhausted] = useState(false);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const isLiveLikeContent = isLivePlaybackSrc({ meta });
  const autoActive =
    !!((autoPlay && !isLiveLikeContent) || wasInvitedTo(inviteKey)) &&
    !autoCancelled &&
    !autoExhausted &&
    !isDownload &&
    !roomGuestPick;
  useEffect(() => {
    if (!autoActive) return;
    const t = window.setTimeout(() => setAutoCancelled(true), 45_000);
    return () => window.clearTimeout(t);
  }, [autoActive]);

  const previousMatch: ScoredStream | null = useMemo(() => {
    if (!filteredPicker || !previousPlayback) return null;
    const m = filteredPicker.allRaw.find((s) => streamMatchesEntry(s, previousPlayback)) ?? null;
    if (!m || isAnimeMetaId || !episode) return m;
    if (
      m.episode != null &&
      (episode.episode < m.episode || episode.episode > (m.episodeEnd ?? m.episode))
    )
      return null;
    if (
      m.episode != null &&
      m.season != null &&
      episode.season != null &&
      m.season !== episode.season
    )
      return null;
    return m;
  }, [filteredPicker, previousPlayback, episode, isAnimeMetaId]);

  const sameSourceMatch: ScoredStream | null = useMemo(() => {
    if (!filteredPicker || !lastSeriesSource || previousMatch) return null;
    const matches = lastSeriesSourceIsLineage ? streamMatchesReleaseLineage : streamMatchesSource;
    return filteredPicker.allRaw.find((s) => matches(s, lastSeriesSource)) ?? null;
  }, [filteredPicker, lastSeriesSource, lastSeriesSourceIsLineage, previousMatch]);

  const currentPick: ScoredStream | null = useMemo(() => {
    if (!filteredPicker) return null;
    if (selectedTier && filteredPicker.byTier[selectedTier]) {
      return filteredPicker.byTier[selectedTier]!;
    }
    if (previousMatch) return previousMatch;
    if (sameSourceMatch) return sameSourceMatch;
    return filteredPicker.primary;
  }, [filteredPicker, selectedTier, previousMatch, sameSourceMatch]);

  const [pendingPreselect, setPendingPreselect] = useState<PlayerSrc | null>(null);
  const openPlayerGated = useCallback(
    (s: PlayerSrc) => {
      const applicable =
        settings.subtitlePreselect &&
        !isDownload &&
        !inSession &&
        !s.autoFired &&
        !s.isLive &&
        !s.meta.id?.startsWith("iptv:") &&
        (s.meta.type === "movie" || s.meta.type === "series" || s.meta.type === "anime");
      if (!applicable) {
        openPlayer(s);
        return;
      }
      setResolving(null);
      setPendingPreselect(s);
    },
    [settings.subtitlePreselect, isDownload, inSession, openPlayer],
  );

  const {
    onPlay,
    onCache,
    queuedHash,
    queuedDownloadKeys,
    debridDown,
    resetDebridDown,
    abortResolve,
    p2pConfirm,
    confirmP2p,
    cancelP2p,
  } = usePickHandler({
    meta: metaForDisplay,
    imdbId,
    imdbIdVerified: resolvedImdb.verified,
    episode,
    absoluteEpisode: animeAbsoluteEpisode,
    attempt,
    resume,
    debrids,
    isCached,
    seasonLock,
    p2pAutoConsent,
    streamMode: settings.streamMode,
    inSession,
    canInvite,
    inviteSentRef,
    sendInvite,
    claimHost,
    openPlayer: openPlayerGated,
    intent,
    seasonEpisodes,
    autoActive,
    autoAttemptIdx,
    autoCandidatesLength: autoCandidates.length,
    autoFiredRef,
    setAutoAttemptIdx,
    setAutoExhausted,
    setFailedStreams,
    setResolveError,
    setResolving,
  });

  const playManually = useCallback(
    (s: ScoredStream) => {
      setAutoCancelled(true);
      onPlay(s);
    },
    [onPlay],
  );

  useEffect(() => {
    if (!resolving) return;
    const t = window.setTimeout(() => {
      abortResolve();
      setResolving(null);
      setAutoCancelled(true);
      setResolveError(playError("timeout"));
    }, RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, [resolving, abortResolve, setResolveError]);

  const rememberedInstant =
    !!previousMatch && (isCached(previousMatch) || !!previousMatch.url || p2pAutoConsent);
  const rememberedFiredRef = useRef(false);
  const rememberedHandledFirst =
    !!previousMatch &&
    settings.rememberLastStream &&
    !!resume &&
    !wasInvitedTo(inviteKey) &&
    !isDownload &&
    !roomGuestPick &&
    !inSession &&
    rememberedInstant &&
    (attempt ?? 0) === 0;
  useEffect(() => {
    if (rememberedFiredRef.current || !rememberedHandledFirst || !previousMatch) return;
    rememberedFiredRef.current = true;
    onPlay(previousMatch, true, false, true);
  }, [rememberedHandledFirst, previousMatch, onPlay]);

  const downloadFiredRef = useRef(false);
  useEffect(() => {
    if (downloadFiredRef.current || !downloadMatch) return;
    if (!autoActive || !autoPlay || (attempt ?? 0) !== 0) return;
    if (inSession || hostSourceForMedia) return;
    if (settings.localPlaybackMode === "stream" || localMatches.length > 0) return;
    if (autoFiredRef.current || rememberedFiredRef.current) return;
    downloadFiredRef.current = true;
    autoFiredRef.current = true;
    rememberedFiredRef.current = true;
    openPlayerGated({
      ...downloadPlayerSrc(metaForDisplay, episode, downloadMatch, {
        imdbId,
        isAnime: isAnimeRequest,
      }),
      autoFired: true,
    });
  }, [
    downloadMatch,
    autoActive,
    autoPlay,
    attempt,
    inSession,
    hostSourceForMedia,
    settings.localPlaybackMode,
    localMatches,
    metaForDisplay,
    episode,
    imdbId,
    isAnimeRequest,
    openPlayerGated,
  ]);

  useAutoFire({
    autoActive,
    rememberedHandledFirst: rememberedHandledFirst && autoAttemptIdx === 0,
    attempt,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady,
    pipelineDone,
    firstResultAt,
    isCached,
    p2pAutoConsent,
    preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    expectHostSource,
    hostSource: hostSourceForMedia,
    preferredSourceEntry: lastSeriesSource,
    preferredSourceMatched: sameSourceMatch != null || previousMatch != null,
    season: !isAnimeMetaId ? (episode?.season ?? null) : null,
    episode: !isAnimeMetaId ? (episode?.episode ?? null) : null,
    addonQuorum,
    pipelineStartedAt,
    autoFiredRef,
    setAutoSettleReady,
    setAutoCancelled,
    onPlay,
  });

  const allCount = filteredPicker?.all.length ?? 0;
  const rawCount = (result?.raw.addon.length ?? 0) + (result?.raw.library.length ?? 0);
  const addonCount = useMemo(() => {
    if (!filteredPicker) return 0;
    return new Set(filteredPicker.all.map((s) => s.addonId)).size;
  }, [filteredPicker]);
  const addonLogoMap = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const a of addons ?? [])
      m.set(a.manifest.id, resolveAddonLogo(a.manifest.logo, a.transportUrl));
    return m;
  }, [addons]);
  const lookupLogo = (id: string): string | null => addonLogoMap.get(id) ?? null;
  const usedAddons = useMemo(() => {
    if (!filteredPicker) return [];
    const seen = new Map<string, { id: string; name: string; logo: string | null }>();
    for (const s of filteredPicker.all) {
      if (seen.has(s.addonId)) continue;
      seen.set(s.addonId, {
        id: s.addonId,
        name: s.addonName,
        logo: addonLogoMap.get(s.addonId) ?? null,
      });
    }
    return [...seen.values()];
  }, [result, addonLogoMap]);
  const backdropSrc = episode?.still || meta.background || meta.poster;

  const [maxWaitElapsed, setMaxWaitElapsed] = useState(false);
  useEffect(() => {
    setMaxWaitElapsed(false);
    const t = window.setTimeout(() => setMaxWaitElapsed(true), 30_000);
    return () => window.clearTimeout(t);
  }, [streamIds]);
  const addonsSettled = pipelineDone || maxWaitElapsed;

  const noStreamIds = addonsSettled && (!streamIds || streamIds.length === 0);
  const noDebrids = addonsSettled && !!streamIds && streamIds.length > 0 && debrids.length === 0;
  const noResults =
    addonsSettled && !!streamIds && streamIds.length > 0 && allCount === 0 && debrids.length > 0;
  const terminalEmpty = noStreamIds || noDebrids || noResults;
  const seasonPackEmpty = isSeasonDownload && addonsSettled && allCount === 0;
  const [perEpisodeBusy, setPerEpisodeBusy] = useState(false);
  const [perEpisodeStatus, setPerEpisodeStatus] = useState<PerEpisodeStatus | null>(null);
  const perEpisodeAcRef = useRef<AbortController | null>(null);
  useEffect(() => () => perEpisodeAcRef.current?.abort(), []);
  const startPerEpisodeSeason = useCallback(async () => {
    const targets = seasonEpisodes ?? [];
    if (targets.length === 0 || perEpisodeAcRef.current) return;
    const ac = new AbortController();
    perEpisodeAcRef.current = ac;
    setPerEpisodeBusy(true);
    setPerEpisodeStatus({ code: "checking", total: targets.length });
    try {
      const batch = await downloadSeasonPerEpisode({
        meta,
        episodes: targets,
        addons: addons ?? [],
        debrids,
        allowP2p: directTorrentEnabled(),
        signal: ac.signal,
        onProgress: (done, total) => {
          if (!ac.signal.aborted) {
            setPerEpisodeStatus({ code: "checked", done, total });
          }
        },
      });
      if (ac.signal.aborted) return;
      if (batch.total === 0) {
        setPerEpisodeStatus({ code: "already-downloading" });
      } else if (batch.queued === 0) {
        setPerEpisodeStatus({ code: "no-source" });
      } else {
        setPerEpisodeStatus({ code: "queued", queued: batch.queued, total: batch.total });
      }
    } catch {
      if (!ac.signal.aborted) setPerEpisodeStatus({ code: "failed" });
    } finally {
      if (!ac.signal.aborted) {
        perEpisodeAcRef.current = null;
        setPerEpisodeBusy(false);
      }
    }
  }, [addons, debrids, meta, seasonEpisodes]);
  const [stubBanner, setStubBanner] = useState(false);
  useEffect(() => {
    const ev = consumeRecentStubEvent(8000);
    if (!ev) return;
    setStubBanner(true);
    const t = window.setTimeout(() => setStubBanner(false), 6000);
    return () => window.clearTimeout(t);
  }, [streamIds]);
  useEffect(() => {
    if (
      autoPlay &&
      pipelineDone &&
      autoCandidates.length === 0 &&
      !autoExhausted &&
      !autoCancelled
    ) {
      setAutoExhausted(true);
    }
  }, [autoPlay, pipelineDone, autoCandidates.length, autoExhausted, autoCancelled]);

  const engineWarming = isEngineWarmingError(pickerError);
  const pickerErrorText = pickerError ? translatePickerError(t, pickerError) : null;
  useEffect(() => {
    if (!engineWarming) return;
    let alive = true;
    const clear = () => {
      if (alive) setResolveError(null);
    };
    const poll = async () => {
      const status = await torrentEngineStatus();
      if (status?.ready) clear();
    };
    void poll();
    const id = window.setInterval(() => void poll(), 1500);
    const cap = window.setTimeout(clear, 20000);
    return () => {
      alive = false;
      window.clearInterval(id);
      window.clearTimeout(cap);
    };
  }, [engineWarming, setResolveError]);

  const showAutoTransition =
    !pickerErrorText &&
    !isDownload &&
    ((autoActive && (streamIds === null || loading || autoCandidates.length > 0)) ||
      resolving != null);
  void terminalEmpty;

  const pickerScrollKey = useMemo(() => {
    const attemptKey = typeof attempt === "number" ? `:a${attempt}` : "";
    return episode
      ? `picker:${meta.id}:${episode.season}:${episode.episode}${attemptKey}`
      : `picker:${meta.id}${attemptKey}`;
  }, [attempt, episode, meta.id]);
  useScrollMemory(pickerScrollKey, mainRef, !showAutoTransition);

  const noSourcesConfigured = addons !== null && addons.length === 0 && debrids.length === 0;

  if (pendingPreselect) {
    return (
      <SubtitleSelectStep
        src={pendingPreselect}
        absoluteEpisode={animeAbsoluteEpisode}
        onStart={(finalSrc) => {
          setPendingPreselect(null);
          openPlayer(finalSrc);
        }}
        onCancel={() => setPendingPreselect(null)}
      />
    );
  }

  if (noSourcesConfigured) {
    return <NoSourcesConfiguredModal meta={meta} />;
  }

  if (p2pConfirm) {
    return (
      <P2pConfirmModal
        meta={meta}
        stream={p2pConfirm.stream}
        onConfirm={(remember) => {
          if (remember) update({ p2pAutoConsent: true });
          confirmP2p();
        }}
        onCancel={cancelP2p}
      />
    );
  }

  if (showAutoTransition) {
    return (
      <AutoPlayTransition
        meta={metaForDisplay}
        episode={episode}
        resolving={resolving != null}
        p2p={resolving?.p2p === true}
        attemptIdx={autoAttemptIdx}
        download={isDownload}
        onCancel={() => {
          abortResolve();
          setResolving(null);
          setAutoCancelled(true);
        }}
      />
    );
  }

  if (debridDown) {
    return (
      <DebridDownModal meta={meta} onTryAgain={resetDebridDown} onBack={() => backToDetail()} />
    );
  }

  if (autoExhausted) {
    return (
      <AutoExhaustedModal
        meta={meta}
        episode={episode}
        absoluteEpisode={animeAbsoluteEpisode}
        triedCount={autoCandidates.length}
        onBrowseManually={() => {
          setAutoCancelled(true);
          setAutoExhausted(false);
        }}
      />
    );
  }

  return (
    <main ref={mainRef} className="absolute inset-0 z-50 overflow-y-auto bg-canvas">
      <BackdropLayer src={backdropSrc} />

      <div
        aria-hidden
        data-tauri-drag-region={fs ? "false" : "true"}
        className="absolute start-0 end-6 top-0 z-10 h-20"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-12 px-12 pb-32 pt-32">
        <PickerNav onBack={backToDetail} onRefresh={refresh} refreshing={loading} />
        <PickerHeader
          meta={metaForDisplay}
          episode={episode}
          absoluteEpisode={animeAbsoluteEpisode}
        />

        {!isDownload && (
          <LocalStreamList
            entries={diskEntries}
            onPlay={(entry) =>
              openPlayerGated(
                downloadMatch && entry.id === downloadEntry?.id
                  ? downloadPlayerSrc(metaForDisplay, episode, downloadMatch, {
                      imdbId,
                      isAnime: isAnimeRequest,
                    })
                  : localPlayerSrc(entry, undefined, episode),
              )
            }
          />
        )}

        {hostSourceForMedia && <HostSourceBanner source={hostSourceForMedia} />}

        {isDownload && (
          <div className="rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-3.5 text-[13.5px] text-ink-muted">
            {isSeasonDownload
              ? t(
                  "Choose one season package. Harbor will match and download every available episode from it.",
                )
              : t("Choose a source to save offline. You can track progress on the Downloads page.")}
          </div>
        )}

        {stubBanner && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-4 text-[13.5px] text-amber-100">
            {t(
              "Last source wasn't actually cached on your debrid yet. Pick another from the list.",
            )}
          </div>
        )}

        {torrentsDisabled() && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-3.5 text-[13px] text-amber-100">
            <span>
              Torrents are disabled in settings. Uncached streams will not play unless they come
              from a debrid service or a direct link.
            </span>
            <button
              type="button"
              onClick={() => openSettings("player")}
              className="rounded-md border border-amber-300/40 px-3 py-1 text-[12px] font-semibold text-amber-100 transition-colors hover:bg-amber-300/10"
            >
              Open Settings
            </button>
          </div>
        )}

        {!addonsSettled && (!filteredPicker || filteredPicker.all.length === 0) && (
          <CinematicLoader meta={metaForDisplay} />
        )}

        {result?.debridErrors && result.debridErrors.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-5 py-3.5 text-[13px] ring-1 ring-edge-soft">
            <div className="flex min-w-0 flex-1 flex-col">
              <p className="font-semibold text-accent">
                {translateDebridBannerTitle(t, debridBanner(result.debridErrors[0]))}
              </p>
              <p className="text-[12.5px] leading-snug text-ink-muted">
                {t(
                  "Some of your cached sources may be missing from this list. This is a debrid-side issue, not a problem with your subscription.",
                )}
              </p>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="shrink-0 rounded-full bg-elevated px-4 py-2 text-[12.5px] font-semibold text-ink ring-1 ring-edge-soft transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {t("Recheck")}
            </button>
          </div>
        )}

        {seasonPackEmpty ? (
          <SeasonPackEmptyState
            season={episode?.season ?? null}
            rawCount={rawCount}
            refreshing={loading}
            episodeCount={seasonEpisodes?.length ?? 0}
            queueing={perEpisodeBusy}
            queueStatus={perEpisodeStatus}
            onQueueEpisodes={() => void startPerEpisodeSeason()}
            onRefresh={refresh}
            onOpenSettings={() => openSettings("streaming")}
          />
        ) : (
          !isSeasonDownload && (
            <PickerEmptyLadder
              meta={meta}
              result={result}
              addonsSettled={addonsSettled}
              pipelineDone={pipelineDone}
              streamIds={streamIds}
              debridCount={debrids.length}
              addonCount={addons?.length ?? 0}
              allCount={allCount}
              rawCount={rawCount}
              strictMode={strictMode}
              forceShowAll={forceShowAll}
              onOpenLibrarySettings={() => openSettings("library")}
              onOpenStreamingSettings={() => openSettings("streaming")}
              onShowAll={() => setForceShowAll(true)}
              onSearchWider={() => {
                if (strictMode) setStrictMode(false);
                else setForceShowAll(true);
              }}
            />
          )
        )}

        {debrids.length > 0 && filteredPicker && filteredPicker.all.length > 0 && <CachedTip />}

        {activeStreamFilter && filteredPicker && filteredPicker.all.length > 0 && (
          <ActiveFilterHint
            name={activeStreamFilter.name.trim() || "filter"}
            fellBack={filteredPicker.fellBack}
            onClear={() => update({ activeStreamFilterId: null })}
            onManage={() => openSettings("streamFilters")}
          />
        )}

        {!isDownload && result && result.picker.all.length > 0 && (
          <div className="flex justify-end">
            <StreamModeToggle
              mode={settings.streamMode}
              onChange={(mode) => update({ streamMode: mode })}
            />
          </div>
        )}

        {(settings.pickerLayout === "stremio" || isDownload) &&
        filteredPicker &&
        filteredPicker.all.length > 0 ? (
          <StremioLayout
            streams={displayStreams}
            addons={addons}
            pipelineDone={pipelineDone}
            loadingAddonCount={Math.max(0, (addons?.length ?? 0) - addonCount)}
            failedStreams={failedStreams}
            preserveOrder={addonOrderMode || !!hostMatch}
            matchFor={hostMatch ? matchFor : undefined}
            onPlay={playManually}
            download={isDownload}
            downloadStateFor={(stream) =>
              resolving?.stream === stream
                ? "preparing"
                : queuedDownloadKeys.has(streamIdentity(stream))
                  ? "queued"
                  : "idle"
            }
            isAnime={isAnimeMetaId}
          />
        ) : (
          <>
            {!loading && result && <SourceDiagnostic result={result} debrids={debrids} />}

            {!loading && currentPick && (
              <PrimaryCard
                meta={metaForDisplay}
                episode={episode}
                absoluteEpisode={animeAbsoluteEpisode}
                stream={currentPick}
                debrids={debrids}
                addonLogo={lookupLogo(currentPick.addonId)}
                onPlay={() => playManually(currentPick)}
                onCache={() => onCache(currentPick)}
                resolving={resolving?.stream === currentPick}
                queued={currentPick.infoHash != null && queuedHash === currentPick.infoHash}
                inSession={inSession}
                isPreviouslyPlayed={previousMatch === currentPick}
                match={matchFor(currentPick)}
              />
            )}

            {!loading && populatedTiers.length > 1 && filteredPicker && (
              <TierStrip
                tiers={populatedTiers}
                selected={selectedTier}
                onSelect={setSelectedTier}
                byTier={filteredPicker.byTier}
                debrids={debrids}
                langFilterSlot={
                  <div className="ml-auto flex items-center gap-2">
                    {uncachedHiddenCount > 0 && (
                      <CachedFilterPill
                        on={cachedOnly}
                        hiddenCount={uncachedHiddenCount}
                        onToggle={() => setCachedOnly((v) => !v)}
                      />
                    )}
                    {preferredLangs.length > 0 && langHiddenCount > 0 && (
                      <LanguageFilterPill
                        languages={preferredLangs}
                        on={langFilter}
                        hiddenCount={langHiddenCount}
                        onToggle={() => setLangFilter((v) => !v)}
                        isAnime={isAnimeRequest}
                      />
                    )}
                  </div>
                }
              />
            )}

            {!loading && allCount > 0 && filteredPicker && (
              <SourceDrawer
                open={drawerOpen}
                onToggle={() => setDrawerOpen((o) => !o)}
                count={allCount}
                addonCount={addonCount}
                usedAddons={usedAddons}
                streams={displayStreams}
                debrids={debrids}
                getAddonLogo={lookupLogo}
                matchFor={hostMatch ? matchFor : undefined}
                onPlay={playManually}
                resolvingId={resolving?.stream.infoHash ?? null}
                showName={meta.name}
                episode={episode}
                absoluteEpisode={animeAbsoluteEpisode}
              />
            )}
          </>
        )}

        {pickerErrorText && engineWarming && (
          <div className="flex items-center gap-3 rounded-2xl border border-edge-soft/60 bg-elevated/40 px-5 py-4 text-[13.5px] text-ink-muted">
            <Loader2 size={16} className="shrink-0 animate-spin text-ink-subtle" />
            <span>{pickerErrorText}</span>
          </div>
        )}
        {pickerErrorText && !engineWarming && (
          <div className="rounded-2xl border border-danger/30 bg-danger/15 px-5 py-4 text-[13.5px] text-ink">
            {pickerErrorText}
          </div>
        )}
      </div>
      {(settings.pickerLayout === "stremio" || isDownload) &&
        filteredPicker &&
        filteredPicker.all.length > 0 && (
          <PickerScrollTop
            scrollRef={mainRef}
            onBack={backToDetail}
            onRefresh={refresh}
            refreshing={loading}
          />
        )}
    </main>
  );
}

function SeasonPackEmptyState({
  season,
  rawCount,
  refreshing,
  episodeCount,
  queueing,
  queueStatus,
  onQueueEpisodes,
  onRefresh,
  onOpenSettings,
}: {
  season: number | null;
  rawCount: number;
  refreshing: boolean;
  episodeCount: number;
  queueing: boolean;
  queueStatus: PerEpisodeStatus | null;
  onQueueEpisodes: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
}) {
  const t = useT();
  const seasonLabel = season == null ? t("this season") : t("Season {n}", { n: season });
  const queueStatusText = (() => {
    if (!queueStatus) return null;
    switch (queueStatus.code) {
      case "checking":
        return t("Checking {total} episodes for sources.", { total: queueStatus.total });
      case "checked":
        return t("Checked {done} of {total} episodes.", {
          done: queueStatus.done,
          total: queueStatus.total,
        });
      case "already-downloading":
        return t("These episodes are already downloading.");
      case "no-source":
        return t("No source was found for any of these episodes. Try refreshing or another addon.");
      case "queued":
        return t("Queued {queued} of {total} episodes.", {
          queued: queueStatus.queued,
          total: queueStatus.total,
        });
      case "failed":
        return t("Could not queue these episodes.");
    }
  })();
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-3xl border border-edge-soft/70 bg-canvas/80 px-9 py-11"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-elevated text-ink-muted ring-1 ring-edge-soft">
          <PackageX size={22} strokeWidth={1.8} aria-hidden />
        </span>
        <div className="flex max-w-lg flex-col gap-2">
          <h2 className="font-display text-[30px] leading-tight text-ink">
            {t("No season package found")}
          </h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {rawCount > 0
              ? t(
                  "Harbor found episode sources for {season}, but none of them is a single downloadable package. It can still fetch the episodes one at a time.",
                  { season: seasonLabel },
                )
              : t(
                  "None of your addons returned a downloadable package for {season}. Harbor can still fetch the episodes one at a time, or you can refresh the sources.",
                  { season: seasonLabel },
                )}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2.5">
          {episodeCount > 0 && (
            <button
              type="button"
              onClick={onQueueEpisodes}
              disabled={queueing}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-5 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:hover:scale-100"
            >
              {queueing ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <ArrowDownToLine size={14} strokeWidth={2.2} aria-hidden />
              )}
              {t("Download episode by episode")}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-elevated px-5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden />
            {t("Refresh sources")}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="h-10 rounded-full border border-edge-soft bg-elevated px-5 text-[13px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            {t("Source settings")}
          </button>
        </div>
        {queueStatusText && (
          <p className="animate-lift-in max-w-lg text-[12.5px] leading-relaxed text-ink-subtle">
            {queueStatusText}
          </p>
        )}
      </div>
    </div>
  );
}

function ActiveFilterHint({
  name,
  fellBack,
  onClear,
  onManage,
}: {
  name: string;
  fellBack: boolean;
  onClear: () => void;
  onManage: () => void;
}) {
  const t = useT();
  return (
    <div
      className={`flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-[13px] ring-1 ${
        fellBack
          ? "bg-accent/10 text-ink ring-accent/30"
          : "bg-elevated/50 text-ink-muted ring-edge-soft"
      }`}
    >
      <Filter size={14} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
      <span className={`min-w-0 flex-1 truncate ${fellBack ? "font-semibold" : ""}`}>
        {fellBack
          ? `${t("No streams match")} ${name}. ${t("Showing all sources.")}`
          : `${t("Preferring")} ${name}`}
      </span>
      <button
        onClick={onManage}
        className="shrink-0 rounded-full px-2 py-1 text-[12px] font-medium text-ink-muted transition-colors hover:bg-canvas/60 hover:text-ink"
      >
        {t("Manage")}
      </button>
      <button
        onClick={onClear}
        aria-label={t("Clear filter")}
        className="shrink-0 rounded-full p-1 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
      >
        <X size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function PickerScrollTop({
  scrollRef,
  onBack,
  onRefresh,
  refreshing = false,
}: {
  scrollRef: React.RefObject<HTMLElement | null>;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const t = useT();
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShow(el.scrollTop > 600);
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [scrollRef]);
  if (!show) return null;
  const circle =
    "flex h-14 w-14 items-center justify-center rounded-full bg-canvas/80 text-ink shadow-[0_14px_36px_-12px_rgba(0,0,0,0.7)] ring-1 ring-edge-soft backdrop-blur-md transition-transform duration-200 hover:scale-105 active:scale-95";
  return (
    <>
      <div className="animate-in fade-in slide-in-from-bottom-3 fixed bottom-7 start-7 z-[60]">
        <HoverTooltip label={t("Back")} side="top" align="center">
          <button type="button" onClick={onBack} aria-label={t("Back")} className={circle}>
            <ChevronLeft size={26} strokeWidth={2.4} className="dir-icon" />
          </button>
        </HoverTooltip>
      </div>
      <div className="animate-in fade-in slide-in-from-bottom-3 fixed bottom-7 end-7 z-[60] flex items-center gap-3">
        {onRefresh && (
          <HoverTooltip label={t("Refresh sources")} side="top" align="center">
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={t("Refresh sources")}
              className={`${circle} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <RefreshCw size={22} strokeWidth={2.4} className={refreshing ? "animate-spin" : ""} />
            </button>
          </HoverTooltip>
        )}
        <button
          type="button"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label={t("Scroll to top")}
          className="flex h-14 items-center gap-2.5 rounded-full bg-accent px-6 text-canvas shadow-[0_16px_40px_-10px_rgba(0,0,0,0.7)] transition-transform duration-200 hover:scale-105 active:scale-95"
        >
          <ArrowUp size={24} strokeWidth={2.6} />
          <span className="text-[16px] font-bold">{t("Top")}</span>
        </button>
      </div>
    </>
  );
}
