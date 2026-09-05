import { memo, type ComponentProps, type RefObject } from "react";
import { DrawCanvas, StrokesLayer, type Stroke } from "@/components/player/draw-canvas";
import { cropTransform } from "./hooks/use-video-fill";
import { StreamSwitcher } from "@/components/player/stream-switcher";
import { StreamCheckPill } from "@/components/player/stream-check-pill";
import { AdReportButton } from "@/components/player/ad-report-button";
import { XrayOverlay } from "@/components/player/xray/xray-overlay";
import { BufferingIndicator } from "@/components/player/buffering-indicator";
import { P2pStatusChip } from "@/components/player/p2p-status-chip";
import type { VolumeHudPosition, VolumeIndicatorState } from "@/components/player/volume-indicator";
import type { ParentalCategory } from "@/lib/providers/harbor-imdb";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { writePlayerPrefs } from "@/lib/player-prefs";
import type { PlayerSrc, PlayEpisode } from "@/lib/view";
import { BpTenFootLayer } from "./bp-ten-foot";
import { CastLayer } from "./cast-layer";
import { DragClickStage } from "./drag-click-stage";
import { LiveLayer } from "./live-layer";
import { LoaderLayer } from "./loader-layer";
import { PanelsLayer } from "./panels-layer";
import { RoomLayer } from "./room-layer";
import { ShellLayer } from "./shell-layer";
import { StageOverlays } from "./stage-overlays";
import { ToolsLayer } from "./tools-layer";
import { TextSyncOverlay } from "./text-sync-overlay";
import { Toaster } from "@/views/addons/toaster";
import type { ToastInfo } from "@/views/addons/addons-types";
import type { usePlayerCast } from "./hooks/use-player-cast";
import type { useTextSync } from "./hooks/use-text-sync";

type Room = ComponentProps<typeof RoomLayer>;
type Shell = ComponentProps<typeof ShellLayer>;
type Tools = ComponentProps<typeof ToolsLayer>;
type Panels = ComponentProps<typeof PanelsLayer>;
type Live = ComponentProps<typeof LiveLayer>;
type Switcher = ComponentProps<typeof StreamSwitcher>;
type Pill = ComponentProps<typeof StreamCheckPill>;
type Loader = ComponentProps<typeof LoaderLayer>;

export type PlayerOverlayLayersProps = {
  // Big Picture is driving: every mouse-era surface with a ten-foot replacement
  // is suppressed and BpTenFootLayer renders the replacement. Never both. Two
  // transports on two independent timers shipped that way once.
  tenFoot: boolean;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  src: PlayerSrc;
  adStreamRef: PlayerSrc["streamRef"];
  adUrl: string;
  subShowInPip: boolean;
  subAssNative: boolean;
  showStats: boolean;
  holdSpeedActive: boolean;
  subtitleOffsetSec: number | null;
  volumeIndicator: VolumeIndicatorState;
  volumeHudPosition: VolumeHudPosition;
  videoFillPill: string | null;
  subDropToast: string | null;
  pipMode: boolean;
  drawMode: boolean;
  cast: ReturnType<typeof usePlayerCast>;
  pickAnother: () => void;
  pickAnotherOrGuide: () => void;
  playPauseToggle: () => void;
  toggleFullscreen: () => void;
  onVolumeWheel: (deltaY: number) => void;
  onVolumeFeedback: (volume: number, muted: boolean) => void;
  isLocalSrc: boolean;
  sourceFailed: boolean;
  swappingEp: boolean;
  swapResolvingKey: string | null;
  closePlayer: () => void;
  cancelToPicker: () => void;
  engineStats: Loader["engineStats"];
  isP2pEngine: boolean;
  setLoaderShowing: (v: boolean) => void;
  onLoaderRetry: () => void;
  bridgeRef: RefObject<PlayerBridge | null>;
  strokes: Stroke[];
  hideOthersDrawings: boolean;
  clientId: string;
  selfName: string;
  selfColor: string;
  onDrawStart: (stroke: Stroke) => void;
  onDrawPoint: (id: string, x: number, y: number) => void;
  onDrawEnd: (id: string) => void;
  clearStrokes: () => void;
  showWaiting: boolean;
  pendingResumeSec: number | null;
  pendingSeekSec: number | null;
  skipSegments: Tools["skipSegments"];
  hasNextEpisode: boolean;
  hasNextEpDisplay: boolean;
  nextEp: PlayEpisode | null;
  nextEpMask: Tools["nextEpMask"];
  pillsVisible: boolean;
  allowAutoSkip: boolean;
  seekTo: (sec: number) => void;
  goToEpisode: (ep: PlayEpisode | null) => void;
  playNext: () => void;
  playPrev: () => void;
  hasPrevEpisodeNow: boolean;
  setAutoNextCancelled: (v: boolean) => void;
  showChrome: boolean;
  ab: Tools["ab"];
  frameGrabToast: Tools["frameGrabToast"];
  onScreenshot: () => void;
  gif: Tools["gif"];
  clip: Tools["clip"];
  loaderActive: boolean;
  playerShellId: string;
  shellSnap: PlayerSnapshot;
  snapRef: Shell["snapRef"];
  fullscreen: boolean;
  showDraw: boolean;
  metaId: string;
  setAnyMenuOpen: (v: boolean) => void;
  onSeekStep: (delta: number) => void;
  rememberSubChoice: Shell["rememberSubChoice"];
  cropMode: Shell["cropMode"];
  onCropMode: Shell["onCropMode"];
  anime4kMode: Shell["anime4kMode"];
  onAnime4kMode: Shell["onAnime4kMode"];
  anime4kAvailable: Shell["anime4kAvailable"];
  togglePipMode: () => void;
  setDrawMode: (fn: (d: boolean) => boolean) => void;
  wakeChrome: () => void;
  setHideOthersDrawings: (fn: (h: boolean) => boolean) => void;
  canPickAnother: boolean;
  resolvedImdbId: string | null;
  contentAdvisory: { categories: ParentalCategory[]; playKey: string; imdbId: string | null };
  tmdbKey: string | null;
  download: Shell["download"];
  liveOverlay: Live["liveOverlay"];
  setDvrOpen: (fn: (v: boolean) => boolean) => void;
  openDvr: (() => void) | undefined;
  sleep: Shell["sleep"];
  adjacentPrev: PlayEpisode | null;
  adjacentNext: PlayEpisode | null;
  canChangeEpisode: boolean;
  inRoom: boolean;
  participants: Room["participants"];
  hostClientId: Room["hostClientId"];
  syncState: Room["syncState"];
  avatarsVisible: boolean;
  presenceMap: Room["presenceMap"];
  participantLocations: Room["participantLocations"];
  now: number;
  avatarsCorner: Room["avatarsCorner"];
  avatarsHidden: boolean;
  chat: Room["chat"];
  sendChat: Room["sendChat"];
  chromeVisible: boolean;
  chatCorner: Room["chatCorner"];
  chatHidden: boolean;
  isHost: boolean;
  staleIds: Room["staleIds"];
  guestEscapeReady: boolean;
  onStart: () => void;
  onPlayWithoutSync: () => void;
  guestHostSource: Room["guestHostSource"];
  liveUrl: string;
  currentInfoHash?: string | null;
  currentFileIdx?: number | null;
  currentRef?: Switcher["currentRef"];
  switcherOpen: boolean;
  foreignNotice: Room["foreignNotice"];
  onDismissForeign: () => void;
  streamPillVariant: Pill["variant"] | null;
  mpvEmbedWindowsActive: boolean;
  setStreamCheckOpen: (v: boolean) => void;
  dismissStreamPill: () => void;
  dvrOpen: boolean;
  setSwitcherOpen: (fn: (v: boolean) => boolean) => void;
  onSwitchStream: Switcher["onPick"];
  debridSlugs: string[];
  isSeriesPlayback: boolean;
  episodePanelOpen: boolean;
  setEpisodePanelOpen: (v: boolean) => void;
  upNextButtonVisible: boolean;
  episodesCorner: Panels["episodesCorner"];
  episodesHidden: boolean;
  roomGuest: boolean;
  onHostAdvance: Panels["onHostAdvance"];
  watchedFor: Panels["watchedFor"];
  acknowledgeResume: (mode: "resume" | "start-over") => void;
  showHeaderWarning: boolean;
  showNoAudioWarning: boolean;
  onUseMpv: () => void;
  onDismissNoAudio: () => void;
  // Text-sync feature
  onEnterSync?: () => void;
  syncMode: ReturnType<typeof useTextSync>["syncMode"];
  syncApi: ReturnType<typeof useTextSync>;
  syncToast: ToastInfo | null;
  onSyncPlayPause: () => void;
  homeServerQualityControl?: Shell["homeServerQualityControl"];
};

export const PlayerOverlayLayers = memo(function PlayerOverlayLayers(p: PlayerOverlayLayersProps) {
  const roomAvatarTopLeft =
    p.inRoom && !p.avatarsHidden && p.participants.length > 0 && p.avatarsCorner === "top-left";
  const roomAvatarTopRight =
    p.inRoom && !p.avatarsHidden && p.participants.length > 0 && p.avatarsCorner === "top-right";
  const roomChatTopLeft = p.inRoom && !p.chatHidden && p.chatCorner === "top-left";
  const roomChatTopRight = p.inRoom && !p.chatHidden && p.chatCorner === "top-right";
  const topLeftOccupied = p.showStats || roomAvatarTopLeft || roomChatTopLeft;
  const topRightOccupied = roomAvatarTopRight || roomChatTopRight;
  const contentAdvisoryPosition = topLeftOccupied
    ? topRightOccupied
      ? "top-center"
      : "top-end"
    : "top-start";

  return (
    <>
      <StageOverlays
        snap={p.snap}
        engine={p.engine}
        pipMode={p.pipMode}
        subShowInPip={p.subShowInPip}
        subAssNative={p.subAssNative}
        showStats={p.showStats}
        holdSpeedActive={p.holdSpeedActive}
        subtitleOffsetSec={p.subtitleOffsetSec}
        volumeIndicator={p.volumeIndicator}
        volumeHudPosition={p.volumeHudPosition}
        videoFillPill={p.videoFillPill}
        subDropToast={p.subDropToast}
        contentAdvisory={p.contentAdvisory}
        contentAdvisoryPosition={contentAdvisoryPosition}
        onSubDelay={(s) => {
          p.bridgeRef.current?.setSubDelay(s);
          writePlayerPrefs(p.metaId, { subDelaySec: s });
        }}
        onEnterSync={p.onEnterSync}
        chromeVisible={p.showChrome}
      />
      <CastLayer
        cast={p.cast}
        src={p.src}
        durationSec={p.snap.durationSec}
        hasActiveSub={p.snap.subtitleTracks.some((t) => t.selected)}
        onPickAnother={p.pickAnother}
      />
      <DragClickStage
        drawMode={p.drawMode}
        pipMode={p.pipMode}
        onClick={p.playPauseToggle}
        onDoubleClick={p.toggleFullscreen}
        onWheelVolume={p.onVolumeWheel}
      />

      {p.tenFoot ? (
        <BpTenFootLayer p={p} />
      ) : (
        <LoaderLayer
          src={p.src}
          snap={p.snap}
          isLocalSrc={p.isLocalSrc}
          forceShow={p.swappingEp || p.swapResolvingKey != null}
          sourceFailed={p.sourceFailed}
          onCancel={p.cancelToPicker}
          engineStats={p.engineStats}
          onShowingChange={p.setLoaderShowing}
          onRetry={p.onLoaderRetry}
          onBrowseChannels={p.liveOverlay.isLive ? () => p.liveOverlay.setOpen(true) : undefined}
        />
      )}

      {!p.tenFoot && !p.pipMode && (
        <BufferingIndicator
          show={p.snap.buffering && (p.snap.status === "playing" || p.snap.status === "paused")}
        />
      )}

      {!p.pipMode && !p.cast.castDevice && (
        <StrokesLayer
          strokes={p.strokes}
          hideOthers={p.hideOthersDrawings}
          selfId={p.clientId}
          videoWidth={p.snap.videoWidth}
          videoHeight={p.snap.videoHeight}
          transform={cropTransform(p.cropMode ?? "fit")}
        />
      )}
      {p.drawMode && !p.pipMode && !p.cast.castDevice && p.bridgeRef.current && (
        <DrawCanvas
          enabled={p.drawMode}
          selfId={p.clientId}
          selfName={p.selfName}
          selfColor={p.selfColor}
          hideOthers={p.hideOthersDrawings}
          strokes={p.strokes}
          videoWidth={p.snap.videoWidth}
          videoHeight={p.snap.videoHeight}
          transform={cropTransform(p.cropMode ?? "fit")}
          onStrokeStart={p.onDrawStart}
          onStrokePoint={p.onDrawPoint}
          onStrokeEnd={p.onDrawEnd}
        />
      )}

      <ToolsLayer
        tenFoot={p.tenFoot}
        engine={p.engine}
        pipMode={p.pipMode}
        drawMode={p.drawMode}
        showWaiting={p.showWaiting}
        pendingResumeSec={p.pendingResumeSec}
        pendingSeekSec={p.pendingSeekSec}
        skipSegments={p.skipSegments}
        durationSec={p.snap.durationSec}
        hasNextEpisode={p.hasNextEpisode}
        hasNextEpDisplay={p.hasNextEpDisplay}
        nextEp={p.nextEp}
        nextEpMask={p.nextEpMask}
        pillsVisible={p.pillsVisible}
        allowAutoSkip={p.allowAutoSkip}
        onSkip={p.seekTo}
        onNextEpisode={p.playNext}
        onCancelAutoNext={() => p.setAutoNextCancelled(true)}
        showChrome={p.showChrome}
        ab={p.ab}
        frameGrabToast={p.frameGrabToast}
        gif={p.gif}
        clip={p.clip}
      />

      {!p.pipMode && !p.drawMode && (
        <AdReportButton
          meta={p.src.meta}
          src={{ ...p.src, streamRef: p.adStreamRef, url: p.adUrl }}
          visible={p.showChrome}
          skipSegments={p.skipSegments}
          durationSec={p.snap.durationSec}
          hasNextEp={p.hasNextEpDisplay}
        />
      )}

      {!p.pipMode && !p.drawMode && (
        <XrayOverlay
          meta={p.src.meta}
          visible={p.showChrome}
          isPaused={p.snap.status === "paused"}
          bridgeRef={p.bridgeRef}
        />
      )}

      {!p.loaderActive && !p.tenFoot && p.syncMode === "idle" && (
        <ShellLayer
          shellId={p.playerShellId}
          shellSnap={p.shellSnap}
          snapRef={p.snapRef}
          bridgeRef={p.bridgeRef}
          engine={p.engine}
          visible={p.showChrome}
          fullscreen={p.fullscreen}
          drawMode={p.drawMode}
          hideOthersDrawings={p.hideOthersDrawings}
          pipMode={p.pipMode}
          showDraw={p.showDraw}
          metaId={p.metaId}
          onMenuOpenChange={p.setAnyMenuOpen}
          onBack={p.closePlayer}
          onPlayPause={p.playPauseToggle}
          onSeek={p.seekTo}
          onSeekStep={p.onSeekStep}
          rememberSubChoice={p.rememberSubChoice}
          onEnterSync={p.onEnterSync}
          cropMode={p.cropMode}
          onCropMode={p.onCropMode}
          anime4kMode={p.anime4kMode}
          onAnime4kMode={p.onAnime4kMode}
          anime4kAvailable={p.anime4kAvailable}
          onPiP={() => p.togglePipMode()}
          onFullscreen={p.toggleFullscreen}
          openCastMenu={p.cast.openCastMenu}
          onToggleDraw={() => {
            p.setDrawMode((d) => !d);
            p.wakeChrome();
          }}
          onToggleHideOthers={() => p.setHideOthersDrawings((h) => !h)}
          onClearDraw={p.clearStrokes}
          onScreenshot={p.onScreenshot}
          onPickAnother={p.pickAnotherOrGuide}
          canPickAnother={p.canPickAnother}
          title={p.src.title}
          subtitle={p.src.subtitle}
          resolution={p.src.streamRef?.resolution}
          quality={p.src.streamRef?.quality}
          releaseName={p.src.streamRef?.title ?? p.src.streamRef?.parsedTitle}
          hoverTitle={p.src.meta.name}
          hoverSub={
            p.src.episode
              ? `S${p.src.episode.imdbSeason ?? p.src.episode.season} · E${String(p.src.episode.imdbEpisode ?? p.src.episode.episode).padStart(2, "0")}`
              : undefined
          }
          hasPrevEp={p.hasPrevEpisodeNow}
          hasNextEp={p.hasNextEpisode}
          onPrevEp={p.playPrev}
          onNextEp={p.playNext}
          metaImdbId={p.resolvedImdbId}
          metaTitle={p.src.meta.name ?? null}
          metaReleaseDate={p.src.meta.releaseDate ?? null}
          meta={p.src.meta}
          tmdbKey={p.tmdbKey}
          season={p.src.episode?.season ?? null}
          episode={p.src.episode?.episode ?? null}
          download={p.download}
          onOpenDvr={p.openDvr}
          sleep={p.sleep}
          onVolumeFeedback={p.onVolumeFeedback}
          homeServerQualityControl={p.homeServerQualityControl}
        />
      )}

      {!p.loaderActive && p.syncMode !== "idle" && (
        <TextSyncOverlay
          api={p.syncApi}
          playing={p.snap.status === "playing"}
          onPlayPause={p.onSyncPlayPause}
        />
      )}

      <Toaster toast={p.syncToast} />

      <RoomLayer
        inRoom={p.inRoom}
        pipMode={p.pipMode}
        drawMode={p.drawMode}
        participants={p.participants}
        clientId={p.clientId}
        hostClientId={p.hostClientId}
        syncState={p.syncState}
        avatarsVisible={p.avatarsVisible}
        presenceMap={p.presenceMap}
        participantLocations={p.participantLocations}
        now={p.now}
        avatarsCorner={p.avatarsCorner}
        avatarsHidden={p.avatarsHidden}
        chat={p.chat}
        sendChat={p.sendChat}
        chromeVisible={p.chromeVisible}
        chatCorner={p.chatCorner}
        chatHidden={p.chatHidden}
        showWaiting={p.showWaiting}
        isHost={p.isHost}
        staleIds={p.staleIds}
        guestEscapeReady={p.guestEscapeReady}
        onStart={p.onStart}
        onPlayWithoutSync={p.onPlayWithoutSync}
        onLeave={p.closePlayer}
        guestHostSource={p.guestHostSource}
        guestDurationSec={p.snap.durationSec}
        casting={!!p.cast.castDevice}
        currentUrl={p.liveUrl}
        switcherOpen={p.switcherOpen}
        onFindCloser={p.pickAnother}
        foreignNotice={p.foreignNotice}
        onDismissForeign={p.onDismissForeign}
      />

      {p.streamPillVariant && !p.switcherOpen && (
        <StreamCheckPill
          variant={p.streamPillVariant}
          visible
          compact={p.mpvEmbedWindowsActive}
          live={p.liveOverlay.isLive}
          onDismiss={
            p.streamPillVariant === "check"
              ? () => p.setStreamCheckOpen(false)
              : p.dismissStreamPill
          }
          onPickAnother={p.pickAnotherOrGuide}
        />
      )}

      <P2pStatusChip
        stats={p.engineStats}
        visible={p.isP2pEngine && p.showChrome && !p.pipMode && !p.drawMode}
      />

      <LiveLayer
        liveOverlay={p.liveOverlay}
        dvrOpen={p.dvrOpen}
        onCloseDvr={() => p.setDvrOpen(() => false)}
        srcUrl={p.src.url}
        channelName={p.src.meta.name ?? p.src.title}
      />
      <StreamSwitcher
        open={p.switcherOpen && !p.tenFoot}
        onClose={() => p.setSwitcherOpen(() => false)}
        onPick={p.onSwitchStream}
        resolvingKey={p.swapResolvingKey}
        currentUrl={p.liveUrl}
        currentInfoHash={p.currentInfoHash ?? null}
        currentFileIdx={p.currentFileIdx ?? null}
        currentRef={p.currentRef ?? null}
        debridSlugs={p.debridSlugs}
        meta={p.src.meta}
        episode={p.src.episode}
        imdbId={p.resolvedImdbId}
        hostSource={p.guestHostSource}
      />

      <PanelsLayer
        tenFoot={p.tenFoot}
        engine={p.engine}
        isSeriesPlayback={p.isSeriesPlayback}
        meta={p.src.meta}
        currentEpisode={p.src.episode}
        episodePanelOpen={p.episodePanelOpen}
        onOpenEpisodePanel={() => p.setEpisodePanelOpen(true)}
        onCloseEpisodePanel={() => p.setEpisodePanelOpen(false)}
        upNextButtonVisible={p.upNextButtonVisible}
        episodesCorner={p.episodesCorner}
        episodesHidden={p.episodesHidden}
        roomGuest={p.roomGuest}
        onHostAdvance={p.onHostAdvance}
        watchedFor={p.watchedFor}
        nextEp={p.adjacentNext}
        onRestart={() => p.seekTo(0)}
        pendingResumeSec={p.pendingResumeSec}
        durationSec={p.snap.durationSec}
        resumeTitle={p.src.meta.name ?? p.src.title}
        onResume={() => p.acknowledgeResume("resume")}
        onStartOver={() => p.acknowledgeResume("start-over")}
        showHeaderWarning={p.showHeaderWarning}
        showNoAudioWarning={p.showNoAudioWarning}
        onUseMpv={p.onUseMpv}
        onDismissNoAudio={p.onDismissNoAudio}
        onPickAnother={p.pickAnotherOrGuide}
      />
    </>
  );
});
