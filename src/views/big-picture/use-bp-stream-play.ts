import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ResolvingSelection } from "@/views/play-picker/use-pick-handler";
import type { Meta } from "@/lib/cinemeta";
import { useActiveKid } from "@/lib/profiles";
import { useSettings } from "@/lib/settings";
import type { ScoredStream } from "@/lib/streams/types";
import { useTogether } from "@/lib/together/provider";
import { useView, type PlayEpisode, type PlayerSrc } from "@/lib/view";
import { isLivePlaybackSrc } from "@/lib/player/live-src";
import { playError, streamIdentity, type PickerError } from "@/views/play-picker/picker-utils";
import { useAutoCandidates } from "@/views/play-picker/use-auto-candidates";
import { useAutoFire } from "@/views/play-picker/use-auto-fire";
import { usePickHandler } from "@/views/play-picker/use-pick-handler";
import { useRoomInvite } from "@/views/play-picker/use-room-invite";
import type { BpStreams } from "./use-bp-streams";

const ANIME_ID_RE = /^(kitsu|mal|anilist|anidb):/;
const RESOLVE_TIMEOUT_MS = 150_000;
const AUTO_GIVEUP_MS = 45_000;

export type BpStreamPlay = {
  play: (s: ScoredStream) => void;
  openLocal: (src: PlayerSrc) => void;
  resolvingKey: string | null;
  error: PickerError | null;
  clearError: () => void;
  failed: (s: ScoredStream) => boolean;
  p2pConfirm: ScoredStream | null;
  confirmP2p: (remember: boolean) => void;
  cancelP2p: () => void;
  debridDown: boolean;
  dismissDebridDown: () => void;
  preselect: PlayerSrc | null;
  startPreselect: (src: PlayerSrc) => void;
  cancelPreselect: () => void;
  autoBusy: boolean;
  autoExhausted: boolean;
  autoAttemptIdx: number;
  autoTriedCount: number;
  cancelAuto: () => void;
  browseManually: () => void;
};

export function useBpStreamPlay(params: {
  meta: Meta;
  episode?: PlayEpisode;
  s: BpStreams;
  autoPlay?: boolean;
  resume?: boolean;
  intent?: "play" | "download";
  onPick?: (s: ScoredStream) => void | Promise<void>;
}): BpStreamPlay {
  const { meta, episode, s, autoPlay, resume, intent, onPick } = params;
  const { settings, update } = useSettings();
  const { openPlayer } = useView();
  const kid = useActiveKid();
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

  const [resolving, setResolving] = useState<ResolvingSelection | null>(null);
  const [error, setError] = useState<PickerError | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [failedStreams, setFailedStreams] = useState<Set<ScoredStream>>(new Set());
  const [preselect, setPreselect] = useState<PlayerSrc | null>(null);
  const [autoAttemptIdx, setAutoAttemptIdx] = useState(0);
  const [autoExhausted, setAutoExhausted] = useState(false);
  const [autoCancelled, setAutoCancelled] = useState(false);
  const autoFiredRef = useRef(false);
  const isAnimeMetaId = ANIME_ID_RE.test(meta.id);
  const seasonLock = settings.seasonSourceLock && (meta.type === "series" || isAnimeMetaId);
  const p2pAutoConsent = settings.p2pAutoConsent || !!kid;
  const season = isAnimeMetaId ? null : (episode?.season ?? null);
  const episodeNo = isAnimeMetaId ? null : (episode?.episode ?? null);

  const isLiveLike = isLivePlaybackSrc({ meta });
  // onPick means the caller owns playback (switch source), so auto-fire must not
  // reach past it into openPlayer and start a second session.
  const autoActive =
    !onPick &&
    intent !== "download" &&
    !!((autoPlay && !isLiveLike) || wasInvitedTo(inviteKey)) &&
    !autoCancelled &&
    !autoExhausted &&
    !roomGuestPick;

  const hasStrongAddon = useMemo(
    () => (s.addons ?? []).some((a) => /mediafusion|comet/i.test(a.manifest?.name ?? "")),
    [s.addons],
  );
  const isTorrentioStream = useCallback(
    (x: ScoredStream) => /torrentio/i.test(x.addonName ?? ""),
    [],
  );

  const filteredPicker = useMemo(
    () =>
      s.result
        ? { all: s.streams, allRaw: s.result.picker.all, primary: s.result.picker.primary }
        : null,
    [s.result, s.streams],
  );

  const autoCandidates = useAutoCandidates({
    filteredPicker,
    previousPlayback: s.previousPlayback,
    sourceEntry: s.sourceEntry,
    isCached: s.isCached,
    addons: s.addons,
    hasStrongAddon,
    isTorrentioStream,
    preferredLangs: s.preferredLangs,
    hostSource: hostSourceForMedia,
    prefer1080: !!kid,
    preferPacks: seasonLock,
    season,
    episode: episodeNo,
    expectedTitle: meta.name,
    expectedTitles: s.animeTitles,
    isAnime: s.isAnimeRequest,
    filterDisabled: s.filterDisabled,
  });

  const openPlayerGated = useCallback(
    (src: PlayerSrc) => {
      const applicable =
        settings.subtitlePreselect &&
        !inSession &&
        !src.autoFired &&
        !src.isLive &&
        !src.meta.id?.startsWith("iptv:") &&
        (src.meta.type === "movie" || src.meta.type === "series" || src.meta.type === "anime");
      if (!applicable) {
        openPlayer(src);
        return;
      }
      setResolving(null);
      setPreselect(src);
    },
    [settings.subtitlePreselect, inSession, openPlayer],
  );

  const { onPlay, abortResolve, debridDown, resetDebridDown, p2pConfirm, confirmP2p, cancelP2p } =
    usePickHandler({
      meta,
      imdbId: s.imdbId,
      imdbIdVerified: s.imdbIdVerified,
      episode,
      resume,
      debrids: s.debrids,
      isCached: s.isCached,
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
      autoActive,
      autoAttemptIdx,
      autoCandidatesLength: autoCandidates.length,
      autoFiredRef,
      setAutoAttemptIdx,
      setAutoExhausted,
      setFailedStreams,
      setResolveError: setError,
      setResolving,
    });

  useAutoFire({
    autoActive,
    autoCandidates,
    resolving,
    autoAttemptIdx,
    autoSettleReady: s.autoSettleReady,
    pipelineDone: s.done,
    firstResultAt: s.firstResultAt,
    isCached: s.isCached,
    p2pAutoConsent,
    preferredLangs: s.preferredLangs,
    hasStrongAddon,
    isTorrentioStream,
    expectHostSource,
    hostSource: hostSourceForMedia,
    season,
    episode: episodeNo,
    addonQuorum: s.addonQuorum,
    pipelineStartedAt: s.pipelineStartedAt,
    autoFiredRef,
    setAutoSettleReady: s.setAutoSettleReady,
    setAutoCancelled,
    onPlay,
  });

  // A debrid or addon that never answers would otherwise spin that row forever
  // with no way out.
  useEffect(() => {
    if (!resolving) return;
    const timer = window.setTimeout(() => {
      abortResolve();
      setResolving(null);
      setAutoCancelled(true);
      setError(playError("timeout"));
    }, RESOLVE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [resolving, abortResolve]);

  useEffect(() => {
    if (!autoActive) return;
    const timer = window.setTimeout(() => setAutoCancelled(true), AUTO_GIVEUP_MS);
    return () => window.clearTimeout(timer);
  }, [autoActive]);

  useEffect(() => {
    if (!autoPlay || !s.done) return;
    if (autoCandidates.length > 0 || autoExhausted || autoCancelled) return;
    setAutoExhausted(true);
  }, [autoPlay, s.done, autoCandidates.length, autoExhausted, autoCancelled]);

  const play = (stream: ScoredStream) => {
    setError(null);
    setAutoCancelled(true);
    if (!onPick) {
      onPlay(stream);
      return;
    }
    const key = streamIdentity(stream);
    setPendingKey(key);
    void Promise.resolve(onPick(stream)).finally(() =>
      setPendingKey((k) => (k === key ? null : k)),
    );
  };

  return {
    play,
    openLocal: openPlayerGated,
    resolvingKey: pendingKey ?? (resolving ? streamIdentity(resolving.stream) : null),
    error,
    clearError: () => setError(null),
    failed: (x) => failedStreams.has(x),
    p2pConfirm: p2pConfirm?.stream ?? null,
    confirmP2p: (remember: boolean) => {
      if (remember) update({ p2pAutoConsent: true });
      confirmP2p();
    },
    cancelP2p,
    debridDown,
    dismissDebridDown: resetDebridDown,
    preselect,
    startPreselect: (src) => {
      setPreselect(null);
      openPlayer(src);
    },
    cancelPreselect: () => setPreselect(null),
    // Scoped to auto only. A manual pick keeps the list on screen with the
    // spinner in its own row rather than blanking to a full-page loader.
    autoBusy: !error && autoActive && (!s.done || autoCandidates.length > 0 || resolving != null),
    autoExhausted,
    autoAttemptIdx,
    autoTriedCount: autoCandidates.length,
    cancelAuto: () => {
      abortResolve();
      setResolving(null);
      setAutoCancelled(true);
    },
    browseManually: () => {
      setAutoCancelled(true);
      setAutoExhausted(false);
    },
  };
}
