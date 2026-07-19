import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import { resolveAddonLogo } from "@/components/addon-logo";
import { torrentEngineStatus } from "@/lib/torrent/local-engine";
import { useAuth } from "@/lib/auth";
import type { Meta } from "@/lib/cinemeta";
import { useDebridClients } from "@/lib/debrid/registry";
import { useTogether } from "@/lib/together/provider";
import { buildMatchScores, matchBadge, MATCH_CLOSE } from "@/lib/together/source-match";
import { HostSourceBanner } from "@/components/host-source-banner";
import { consumeRecentStubEvent } from "@/lib/dead-streams";
import { peekCachedLogo, resolveLogo } from "@/lib/logo";
import {
  readPlayback,
  readLastSeriesPlayback,
  streamMatchesEntry,
  streamMatchesSource,
} from "@/lib/playback-history";
import { readSeasonLock } from "@/lib/season-lock";
import { useSettings } from "@/lib/settings";
import type { ScoredStream, Tier } from "@/lib/streams/types";
import { isAddonRanked } from "@/lib/streams/addon-detect";

import { useScrollMemory, useView, type PlayEpisode, type PlayerSrc } from "@/lib/view";
import { torrentsDisabled } from "@/lib/torrent/stremio-stream";
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
  hasCachedMarker,
  hasUncachedMarker,
  isEngineWarmingError,
  normalizeLangCode,
  orderByAddonNative,
  streamMatchesLangs,
} from "./play-picker/picker-utils";
import { PickerHeader } from "./play-picker/picker-header";
import { PrimaryCard } from "./play-picker/primary-card";
import { SourceDiagnostic } from "./play-picker/source-diagnostic";
import { CachedTip } from "./play-picker/cached-tip";
import { StremioLayout } from "./play-picker/stremio-layout";
import { SourceDrawer } from "./play-picker/source-drawer";
import { TierStrip } from "./play-picker/tier-strip";
import { usePickHandler } from "./play-picker/use-pick-handler";
import { useActiveKid } from "@/lib/profiles";
import { useAutoCandidates } from "./play-picker/use-auto-candidates";
import { useAutoFire } from "./play-picker/use-auto-fire";
import { useRoomInvite } from "./play-picker/use-room-invite";
import { useAddons } from "./play-picker/use-addons";
import { useImdbId } from "./play-picker/use-imdb-id";
import { usePipelineResult } from "./play-picker/use-pipeline-result";
import { useStreamIds } from "./play-picker/use-stream-ids";
import { findLocalEpisodeByIds, findLocalMovie } from "@/lib/local-library";
import { localPlayerSrc } from "@/lib/local-library/player-src";
import { LocalStreamCard } from "./play-picker/local-stream-card";
import { SubtitleSelectStep } from "./play-picker/subtitle-select-step";

const TIER_ORDER: Tier[] = ["4K_DV", "4K_HDR", "4K", "1080p_HDR", "1080p", "720p", "SD", "ROUGH"];

export function PlayPicker({
  meta,
  episode,
  autoPlay,
  attempt,
  intent,
  resume,
}: {
  meta: Meta;
  episode?: PlayEpisode;
  autoPlay?: boolean;
  attempt?: number;
  intent?: "play" | "download";
  resume?: boolean;
}) {
  const isDownload = intent === "download";
  const { openPlayer, openSettings, exitPickerToDetail, setView } = useView();
  const backToDetail = () => {
    void exitWindowFullscreen();
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
  // Warm the player chunk while the best source resolves, so the lazy
  // PlayerView mounts instantly instead of flashing a blank screen.
  useEffect(() => {
    void import("@/views/player");
  }, []);
  const imdbId = resolvedImdb.id;
  const streamIds = useStreamIds(meta, episode, imdbId);
  const localMatch = useMemo(() => {
    const m = meta.id.match(/^tmdb:(?:movie|tv):(\d+)$/);
    const tmdbId = m ? parseInt(m[1], 10) : null;
    if (tmdbId == null && !imdbId) return null;
    return episode
      ? findLocalEpisodeByIds(episode.season, episode.episode, tmdbId, imdbId)
      : findLocalMovie(tmdbId, imdbId);
  }, [meta.id, imdbId, episode]);
  const { addons, discovering: discoveringAddons } = useAddons(authKey, settings);
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
  const [resolving, setResolving] = useState<{ stream: ScoredStream } | null>(null);
  const [failedStreams, setFailedStreams] = useState<Set<ScoredStream>>(new Set());
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [strictMode, setStrictMode] = useState(settings.streamFilterLevel === "strict");
  const [forceShowAll, setForceShowAll] = useState(false);
  const filterDisabled = settings.streamFilterLevel === "off" || forceShowAll || isDownload;
  const {
    result,
    loading,
    pipelineDone,
    firstResultAt,
    autoSettleReady,
    resolveError,
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
  });
  const baseLangs = settings.preferredLanguages;
  const isAnimeRequest = useMemo(
    () => (streamIds ?? []).some((id) => id.startsWith("kitsu:") || id.startsWith("mal:")),
    [streamIds],
  );
  const preferredLangs = useMemo(() => {
    const codes = settings.preferredAudioLangs ?? [];
    const animeAdd = isAnimeRequest ? ["Japanese"] : [];
    const all = [...(baseLangs ?? []), ...codes, ...animeAdd];
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
    settings.requirePreferredLanguage === true && (baseLangs?.length ?? 0) > 0,
  );
  const [cachedOnly, setCachedOnly] = useState(false);
  const pickerMainRef = useRef<HTMLElement | null>(null);

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

  const filteredPicker = useMemo(() => {
    if (!result) return null;
    let all = result.picker.all;
    if (langFilter && preferredLangs.length > 0) {
      const langFiltered = all.filter((s) => streamMatchesLangs(s, preferredLangs));
      if (langFiltered.length > 0) all = langFiltered;
    }
    if (cachedOnly && debrids.length > 0) {
      const cached = all.filter(isCached);
      if (cached.length > 0) all = cached;
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
    return { primary, byTier, all };
  }, [result, langFilter, preferredLangs, cachedOnly, debrids.length, isCached, hostMatch]);

  const anyAddonRanked = useMemo(() => (addons ?? []).some((a) => isAddonRanked(a)), [addons]);
  const addonOrderMode = settings.streamSort === "addon" || anyAddonRanked;
  const displayStreams = useMemo(() => {
    const all = filteredPicker?.all ?? [];
    const base = addonOrderMode && result ? orderByAddonNative(all, result.raw.addon, addons) : all;
    if (!hostMatch) return base;
    return base.slice().sort((a, b) => (hostMatch.get(b) ?? 0) - (hostMatch.get(a) ?? 0));
  }, [filteredPicker, addonOrderMode, result, addons, hostMatch]);

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

  const seasonLock = settings.seasonSourceLock && meta.type === "series" && !isAnimeMetaId;
  const seasonLockEntry = useMemo(
    () => (seasonLock ? readSeasonLock(meta.id, episode?.season ?? null) : null),
    [seasonLock, meta.id, episode?.season],
  );
  const lastSeriesSource = useMemo(
    () =>
      seasonLockEntry ??
      (settings.keepSourceNextEpisode && !!autoPlay && meta.type === "series"
        ? readLastSeriesPlayback(meta.id)
        : null),
    [seasonLockEntry, meta.id, meta.type, settings.keepSourceNextEpisode, autoPlay],
  );

  const kidProfile = useActiveKid();
  const p2pAutoConsent = settings.p2pAutoConsent || !!kidProfile;
  const autoCandidates = useAutoCandidates({
    filteredPicker,
    previousPlayback,
    sourceEntry: lastSeriesSource,
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
  });

  const autoFiredRef = useRef(false);
  const mainRef = useRef<HTMLElement>(null);
  const [autoAttemptIdx, setAutoAttemptIdx] = useState(0);
  const [autoExhausted, setAutoExhausted] = useState(false);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const isLiveLikeContent =
    !!meta.type && !["movie", "series", "anime"].includes(String(meta.type).toLowerCase());
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
    const m = filteredPicker.all.find((s) => streamMatchesEntry(s, previousPlayback)) ?? null;
    if (!m || isAnimeMetaId || !episode) return m;
    if (m.episode != null && m.episode !== episode.episode) return null;
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
    return filteredPicker.all.find((s) => streamMatchesSource(s, lastSeriesSource)) ?? null;
  }, [filteredPicker, lastSeriesSource, previousMatch]);

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
    attempt,
    resume,
    debrids,
    isCached,
    seasonLock,
    p2pAutoConsent,
    inSession,
    canInvite,
    inviteSentRef,
    sendInvite,
    claimHost,
    openPlayer: openPlayerGated,
    intent,
    onDownloadStarted: () => setView("downloads"),
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
    season: !isAnimeMetaId ? (episode?.season ?? null) : null,
    episode: !isAnimeMetaId ? (episode?.episode ?? null) : null,
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
  }, [filteredPicker, addonLogoMap]);
  const backdropSrc = episode?.still || meta.background || meta.poster;

  const [maxWaitElapsed, setMaxWaitElapsed] = useState(false);
  useEffect(() => {
    setMaxWaitElapsed(false);
    const t = window.setTimeout(() => setMaxWaitElapsed(true), 30_000);
    return () => window.clearTimeout(t);
  }, [streamIds]);
  const addonsSettled = (pipelineDone && !discoveringAddons) || maxWaitElapsed;

  const noStreamIds = addonsSettled && (!streamIds || streamIds.length === 0);
  const noDebrids = addonsSettled && !!streamIds && streamIds.length > 0 && debrids.length === 0;
  const noResults =
    addonsSettled && !!streamIds && streamIds.length > 0 && allCount === 0 && debrids.length > 0;
  const terminalEmpty = noStreamIds || noDebrids || noResults;
  const [stubBanner, setStubBanner] = useState<string | null>(null);
  useEffect(() => {
    const ev = consumeRecentStubEvent(8000);
    if (!ev) return;
    setStubBanner(
      "Last source wasn't actually cached on your debrid yet. Pick another from the list.",
    );
    const t = window.setTimeout(() => setStubBanner(null), 6000);
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

  const engineWarming = isEngineWarmingError(resolveError);
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
    !resolveError &&
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
  useScrollMemory(pickerScrollKey, pickerMainRef, !showAutoTransition);

  const noSourcesConfigured = !discoveringAddons && addons.length === 0 && debrids.length === 0;

  if (pendingPreselect) {
    return (
      <SubtitleSelectStep
        src={pendingPreselect}
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
        triedCount={autoCandidates.length}
        onBrowseManually={() => {
          setAutoCancelled(true);
          setAutoExhausted(false);
        }}
      />
    );
  }

  return (
    <main
      ref={mainRef}
      data-tv-focus-scope
      className="absolute inset-0 z-50 overflow-y-auto bg-canvas"
    >
      <BackdropLayer src={backdropSrc} />

      <div
        aria-hidden
        data-tauri-drag-region={fs ? "false" : "true"}
        className="absolute inset-x-0 top-0 z-10 h-20"
      />

      <div className="relative mx-auto flex min-h-full w-full max-w-5xl flex-col gap-12 px-12 pb-32 pt-32">
        <PickerHeader
          meta={metaForDisplay}
          episode={episode}
          onBack={backToDetail}
          onRefresh={refresh}
          refreshing={loading}
        />

        {!isDownload && localMatch && (
          <LocalStreamCard
            entry={localMatch}
            onPlay={() => openPlayerGated(localPlayerSrc(localMatch))}
          />
        )}

        {hostSourceForMedia && <HostSourceBanner source={hostSourceForMedia} />}

        {isDownload && (
          <div className="rounded-2xl border border-edge-soft bg-elevated/60 px-5 py-3.5 text-[13.5px] text-ink-muted">
            Choose a source to save offline. You can track progress on the Downloads page.
          </div>
        )}

        {stubBanner && (
          <div className="rounded-2xl border border-amber-300/30 bg-amber-400/10 px-5 py-4 text-[13.5px] text-amber-100">
            {stubBanner}
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
              onClick={() => openSettings()}
              className="rounded-md border border-amber-300/40 px-3 py-1 text-[12px] font-semibold text-amber-100 transition-colors hover:bg-amber-300/10"
            >
              Open Settings
            </button>
          </div>
        )}

        {!addonsSettled && (!filteredPicker || filteredPicker.all.length === 0) && (
          <CinematicLoader meta={metaForDisplay} />
        )}

        {allCount > 0 && (!pipelineDone || discoveringAddons) && (
          <div className="flex items-center gap-2 rounded-xl border border-edge-soft/60 bg-canvas/55 px-4 py-2.5 text-[12.5px] text-ink-muted">
            <Loader2 size={14} className="animate-spin text-accent" />
            Showing available results while the remaining sources finish.
          </div>
        )}

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

        {debrids.length > 0 && filteredPicker && filteredPicker.all.length > 0 && <CachedTip />}

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
            isAnime={isAnimeMetaId}
          />
        ) : (
          <>
            {!loading && result && <SourceDiagnostic result={result} debrids={debrids} />}

            {!loading && currentPick && (
              <PrimaryCard
                meta={metaForDisplay}
                episode={episode}
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
              />
            )}
          </>
        )}

        {resolveError && engineWarming && (
          <div className="flex items-center gap-3 rounded-2xl border border-edge-soft/60 bg-elevated/40 px-5 py-4 text-[13.5px] text-ink-muted">
            <Loader2 size={16} className="shrink-0 animate-spin text-ink-subtle" />
            <span>{resolveError}</span>
          </div>
        )}
        {resolveError && !engineWarming && (
          <div className="rounded-2xl border border-danger/30 bg-danger/15 px-5 py-4 text-[13.5px] text-ink">
            {resolveError}
          </div>
        )}
      </div>
      {(settings.pickerLayout === "stremio" || isDownload) &&
        filteredPicker &&
        filteredPicker.all.length > 0 && <PickerScrollTop scrollRef={mainRef} />}
    </main>
  );
}

function PickerScrollTop({ scrollRef }: { scrollRef: React.RefObject<HTMLElement | null> }) {
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
  return (
    <button
      type="button"
      onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t("Scroll to top")}
      className="animate-in fade-in slide-in-from-bottom-3 fixed bottom-7 end-7 z-[60] flex h-14 items-center gap-2.5 rounded-full bg-accent px-6 text-canvas shadow-[0_16px_40px_-10px_rgba(0,0,0,0.7)] transition-transform duration-200 hover:scale-105 active:scale-95"
    >
      <ArrowUp size={24} strokeWidth={2.6} />
      <span className="text-[16px] font-bold">{t("Top")}</span>
    </button>
  );
}
