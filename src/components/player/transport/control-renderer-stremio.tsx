import {
  Camera,
  ChevronLeft,
  Info,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Replace,
  SkipBack,
  SkipForward,
  Tv,
} from "lucide-react";
import { realQualityLabel } from "@/lib/player/resolution-label";
import type { PlayerCapabilities, PlayerSnapshot } from "@/lib/player/bridge";
import type { SubtitleAddHandler } from "@/lib/player/subtitle-load";
import type { Meta } from "@/lib/cinemeta";
import {
  getCustomIcon,
  type CustomIconMap,
  type PlayerControlId,
  type TimeFormat,
  type VolumeStyle,
} from "@/lib/player-chrome";
import type { DownloadStatus } from "@/views/player/hooks/use-video-download";
import { useT } from "@/lib/i18n";
import { SubtitleMenu } from "../subtitle-menu";
import { AudioMenu } from "../audio-menu";
import { DownloadButton } from "./download-button";
import { Tooltip } from "./tooltip";
import { DvrButton } from "./dvr-button";
import { SpeedMenu } from "./speed-menu";
import { AspectMenu } from "./aspect-menu";
import { Anime4kMenu } from "./anime4k-menu";
import { HdrToggleStremioBtn } from "./hdr-toggle-btn";
import { RtxHdrToggleStremioBtn } from "./rtx-hdr-toggle-btn";
import type { Anime4kChoice } from "@/views/player/hooks/use-anime4k";
import { DrawToggle } from "./draw-toggle";
import { CastButton } from "./cast-button";
import { TimeStart } from "./time-display";
import { StremioBtn } from "./stremio-btn";
import { StremioVolume } from "./stremio-volume";
import { renderCustomIconControlStremio } from "./custom-icon-renderer";
import { WindowControlButtons } from "./window-control-buttons";
import { IdentifySongButton } from "@/components/identify-song-button";

function qualityInfoOn(): boolean {
  try {
    return (
      (JSON.parse(localStorage.getItem("harbor.settings") ?? "{}") as { showQualityInfo?: boolean })
        .showQualityInfo === true
    );
  } catch {
    return false;
  }
}

export type StremioRenderCtx = {
  snap: PlayerSnapshot;
  capabilities: PlayerCapabilities;
  drawMode: boolean;
  hideOthersDrawings: boolean;
  showDraw: boolean;
  isWatchTogether?: boolean;
  playing: boolean;
  showEpisodeNav: boolean;
  isLiveChannel: boolean;
  showRemaining: boolean;
  active: boolean;
  canPickAnother: boolean;
  hasPrevEp: boolean;
  hasNextEp: boolean;
  engine: "html5" | "mpv";
  useOverlayPopups?: boolean;
  editing?: boolean;
  customIcons?: CustomIconMap;
  previewStates?: Partial<Record<PlayerControlId, string>>;
  timeFormat?: TimeFormat;
  onCycleTimeFormat?: () => void;
  volumeStyle?: VolumeStyle;
  fullscreen?: boolean;
  title?: string;
  subtitle?: string;
  resolution?: string | null;
  quality?: string | null;
  titleClickable?: boolean;
  onBack?: () => void;
  onFullscreen?: () => void;
  onTitleClick?: () => void;
  meta?: Meta;
  metaImdbId?: string | null;
  metaTitle?: string | null;
  metaReleaseDate?: string | null;
  season?: number | null;
  episode?: number | null;
  download?: DownloadStatus;
  sleep?: import("@/views/player/hooks/use-sleep-timer").SleepTimerState;
  setShowRemaining: (fn: (r: boolean) => boolean) => void;
  setAudioMenuOpen: (v: boolean) => void;
  setSubtitleMenuOpen: (v: boolean) => void;
  setSpeedMenuOpen: (v: boolean) => void;
  setAspectMenuOpen: (v: boolean) => void;
  cropMode?: string;
  onCropMode?: (id: string) => void;
  setAnime4kMenuOpen: (v: boolean) => void;
  anime4kMode?: string;
  onAnime4kMode?: (id: string) => void;
  anime4kAvailable?: boolean;
  onPlayPause: () => void;
  onMute: () => void;
  onVolume: (v: number) => void;
  onAudio: (id: string) => void;
  onSubtitle: (id: string | null) => void;
  onSubDelay: (sec: number) => void;
  onAudioDelay: (sec: number) => void;
  onEnterSync?: () => void;
  onAddSubtitle: SubtitleAddHandler;
  onRate: (r: number) => void;
  onPiP: () => void;
  onCast: () => void;
  onToggleDraw: () => void;
  onToggleHideOthers: () => void;
  onClearDraw: () => void;
  onScreenshot: () => void;
  onPickAnother: () => void;
  onPrevEp: () => void;
  onNextEp: () => void;
  onDownloadStart?: () => void;
  onDownloadCancel?: () => void;
  onDownloadReveal?: () => void;
  onDownloadReset?: () => void;
  onOpenDvr?: () => void;
};

function getStremioState(id: PlayerControlId, ctx: StremioRenderCtx): string | undefined {
  const preview = ctx.previewStates?.[id];
  if (preview) return preview;
  switch (id) {
    case "play-pause":
      return ctx.playing ? "playing" : "paused";
    case "fullscreen":
      return ctx.fullscreen ? "fullscreen" : "windowed";
    case "draw-toggle":
      return ctx.drawMode ? "active" : "inactive";
    case "dvr":
      return ctx.isLiveChannel ? "recording" : "idle";
    case "cast":
      return ctx.capabilities.chromecast ? "connected" : "idle";
    case "pip":
      return "inactive";
    case "download":
      return ctx.download?.kind ?? "idle";
  }
  return undefined;
}

export function RenderedStremioControl({
  id,
  ctx,
}: {
  id: PlayerControlId;
  ctx: StremioRenderCtx;
}) {
  const tr = useT();
  const state = getStremioState(id, ctx);
  const iconUrl = getCustomIcon(ctx.customIcons, id, state);
  if (iconUrl) {
    const custom = renderCustomIconControlStremio(id, ctx, iconUrl);
    if (custom !== undefined) return <>{custom}</>;
  }
  switch (id) {
    case "back":
      if (!ctx.onBack) return null;
      return (
        <Tooltip label={tr("Back")} side="bottom">
          <StremioBtn onClick={ctx.onBack} ariaLabel={tr("Back")}>
            <ChevronLeft size={30} strokeWidth={2} />
          </StremioBtn>
        </Tooltip>
      );
    case "title-info": {
      if (!ctx.title) return null;
      const showQuality = qualityInfoOn() && !!ctx.quality;
      const res = realQualityLabel(ctx.snap.videoWidth, ctx.snap.videoHeight) ?? ctx.resolution;
      if (ctx.titleClickable && ctx.onTitleClick) {
        return (
          <button
            type="button"
            onClick={ctx.onTitleClick}
            className="pointer-events-auto group flex min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-start text-white/90 transition-colors hover:bg-white/[0.05]"
          >
            <span className="flex min-w-0 flex-col">
              <span className="flex min-w-0 items-center gap-2 truncate">
                <h1 className="truncate text-[19px] font-medium leading-tight">{ctx.title}</h1>
                {ctx.subtitle && (
                  <span className="shrink-0 text-[13px] font-normal text-white/55">
                    {ctx.subtitle}
                  </span>
                )}
                {!showQuality && res && (
                  <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-white/80">
                    {res}
                  </span>
                )}
              </span>
              {showQuality && (
                <span className="truncate text-[12px] font-normal tabular-nums text-white/55">
                  {ctx.quality}
                </span>
              )}
            </span>
            <Info
              size={13}
              strokeWidth={2.1}
              className="shrink-0 opacity-40 transition-opacity group-hover:opacity-90"
            />
          </button>
        );
      }
      return (
        <div className="pointer-events-none min-w-0 truncate text-white/90">
          <h1 className="truncate text-[19px] font-medium leading-tight">{ctx.title}</h1>
          {showQuality ? (
            <>
              {ctx.subtitle && <p className="truncate text-[13px] text-white/55">{ctx.subtitle}</p>}
              <p className="truncate text-[12px] tabular-nums text-white/50">{ctx.quality}</p>
            </>
          ) : (
            (ctx.subtitle || res) && (
              <p className="flex items-center gap-1.5 text-[13px] text-white/55">
                {ctx.subtitle && <span className="truncate">{ctx.subtitle}</span>}
                {res && (
                  <span className="shrink-0 rounded-md bg-white/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white/80">
                    {res}
                  </span>
                )}
              </p>
            )
          )}
        </div>
      );
    }
    case "play-pause":
      return (
        <Tooltip label={ctx.playing ? tr("Pause") : tr("Play")}>
          <StremioBtn
            onClick={ctx.onPlayPause}
            ariaLabel={ctx.playing ? tr("Pause") : tr("Play")}
            playPause
          >
            {ctx.playing ? (
              <Pause size={32} strokeWidth={2} fill="currentColor" />
            ) : (
              <Play size={32} strokeWidth={2} fill="currentColor" />
            )}
          </StremioBtn>
        </Tooltip>
      );
    case "prev-episode":
      if (!ctx.showEpisodeNav) return null;
      return (
        <Tooltip label={tr("Previous episode")}>
          <StremioBtn
            onClick={ctx.onPrevEp}
            ariaLabel={tr("Previous episode")}
            disabled={!ctx.hasPrevEp}
          >
            <SkipBack size={26} strokeWidth={2} fill="currentColor" />
          </StremioBtn>
        </Tooltip>
      );
    case "next-episode":
      if (!ctx.showEpisodeNav) return null;
      return (
        <Tooltip label={tr("Next episode")}>
          <StremioBtn
            onClick={ctx.onNextEp}
            ariaLabel={tr("Next episode")}
            disabled={!ctx.hasNextEp}
          >
            <SkipForward size={26} strokeWidth={2} fill="currentColor" />
          </StremioBtn>
        </Tooltip>
      );
    case "seek-back":
    case "seek-forward":
      return null;
    case "volume":
      return (
        <StremioVolume
          snap={ctx.snap}
          onMute={ctx.onMute}
          onVolume={ctx.onVolume}
          capabilities={ctx.capabilities}
          style={ctx.volumeStyle ?? "slider"}
        />
      );
    case "time-start": {
      return (
        <TimeStart
          stremio
          durationSec={ctx.snap.durationSec}
          timeFormat={ctx.timeFormat}
          isLiveChannel={ctx.isLiveChannel}
          active={ctx.active}
          onCycle={ctx.editing ? undefined : ctx.onCycleTimeFormat}
        />
      );
    }
    case "time-end":
      return null;
    case "pick-another":
      if (!ctx.canPickAnother) return null;
      return (
        <Tooltip label={ctx.isLiveChannel ? tr("TV Guide") : tr("Switch stream")}>
          <StremioBtn
            onClick={ctx.onPickAnother}
            ariaLabel={ctx.isLiveChannel ? tr("TV Guide") : tr("Switch stream")}
          >
            {ctx.isLiveChannel ? (
              <Tv size={26} strokeWidth={1.9} />
            ) : (
              <Replace size={26} strokeWidth={1.9} />
            )}
          </StremioBtn>
        </Tooltip>
      );
    case "dvr":
      if (!ctx.isLiveChannel || !ctx.onOpenDvr) return null;
      return <DvrButton channelName={ctx.meta?.name ?? tr("Live")} onClick={ctx.onOpenDvr} />;
    case "download":
      if (ctx.isLiveChannel) return null;
      if (
        !ctx.download ||
        !ctx.onDownloadStart ||
        !ctx.onDownloadCancel ||
        !ctx.onDownloadReveal ||
        !ctx.onDownloadReset
      )
        return null;
      return (
        <DownloadButton
          status={ctx.download}
          onStart={ctx.onDownloadStart}
          onCancel={ctx.onDownloadCancel}
          onReveal={ctx.onDownloadReveal}
          onReset={ctx.onDownloadReset}
        />
      );
    case "speed-menu":
      if (ctx.isLiveChannel) return null;
      return (
        <SpeedMenu
          rate={ctx.snap.rate}
          onRate={ctx.onRate}
          sleep={ctx.sleep}
          onOpenChange={ctx.setSpeedMenuOpen}
        />
      );
    case "aspect-menu":
      if (ctx.engine === "html5" || !ctx.onCropMode) return null;
      return (
        <AspectMenu
          mode={ctx.cropMode ?? "fit"}
          onMode={ctx.onCropMode}
          onOpenChange={ctx.setAspectMenuOpen}
        />
      );
    case "anime4k-menu":
      if (ctx.engine === "html5" || !ctx.onAnime4kMode || !ctx.anime4kAvailable) return null;
      return (
        <Anime4kMenu
          mode={(ctx.anime4kMode as Anime4kChoice) ?? "auto"}
          onMode={ctx.onAnime4kMode}
          onOpenChange={ctx.setAnime4kMenuOpen}
        />
      );
    case "hdr-toggle":
      if (ctx.engine === "html5") return null;
      return <HdrToggleStremioBtn />;
    case "rtx-hdr-toggle":
      if (ctx.engine === "html5") return null;
      return <RtxHdrToggleStremioBtn meta={ctx.meta} />;
    case "cast":
      return <CastButton onClick={ctx.onCast} capabilities={ctx.capabilities} />;
    case "subtitle-menu":
      if (ctx.isLiveChannel && ctx.snap.subtitleTracks.length === 0) return null;
      return (
        <SubtitleMenu
          tracks={ctx.snap.subtitleTracks}
          selectedId={ctx.snap.subtitleTracks.find((t) => t.selected)?.id ?? null}
          delaySec={ctx.snap.subDelaySec}
          onSelect={ctx.onSubtitle}
          onDelay={ctx.onSubDelay}
          onEnterSync={ctx.onEnterSync}
          onAddSubtitle={ctx.onAddSubtitle}
          metaImdbId={ctx.metaImdbId}
          metaTitle={ctx.metaTitle}
          metaReleaseDate={ctx.metaReleaseDate}
          season={ctx.season}
          episode={ctx.episode}
          useOverlayPopup={ctx.useOverlayPopups}
          onOpenChange={ctx.setSubtitleMenuOpen}
        />
      );
    case "audio-menu":
      if (ctx.engine === "html5") return null;
      return (
        <AudioMenu
          tracks={ctx.snap.audioTracks}
          selectedId={ctx.snap.audioTracks.find((t) => t.selected)?.id ?? null}
          delaySec={ctx.snap.audioDelaySec}
          engine={ctx.engine}
          onSelect={ctx.onAudio}
          onDelay={ctx.onAudioDelay}
          onOpenChange={ctx.setAudioMenuOpen}
          useOverlayPopup={ctx.useOverlayPopups}
        />
      );
    case "draw-toggle":
      if (!ctx.showDraw) return null;
      return (
        <DrawToggle
          active={ctx.drawMode}
          hideOthers={ctx.hideOthersDrawings}
          onToggle={ctx.onToggleDraw}
          onToggleHideOthers={ctx.onToggleHideOthers}
          onClear={ctx.onClearDraw}
        />
      );
    case "screenshot":
      return (
        <Tooltip label={tr("Screenshot")}>
          <StremioBtn onClick={ctx.onScreenshot} ariaLabel={tr("Screenshot")}>
            <Camera size={26} strokeWidth={1.9} />
          </StremioBtn>
        </Tooltip>
      );
    case "song-id":
      return <IdentifySongButton editing={ctx.editing} />;
    case "pip":
      if (!ctx.capabilities.pictureInPicture) return null;
      return (
        <Tooltip label={tr("Picture in Picture")}>
          <StremioBtn onClick={ctx.onPiP} ariaLabel={tr("Picture in Picture")}>
            <PictureInPicture2 size={26} strokeWidth={1.9} />
          </StremioBtn>
        </Tooltip>
      );
    case "fullscreen":
      if (!ctx.onFullscreen) return null;
      return (
        <Tooltip label={ctx.fullscreen ? tr("Exit fullscreen") : tr("Fullscreen")} side="bottom">
          <StremioBtn onClick={ctx.onFullscreen} ariaLabel={tr("Fullscreen")}>
            {ctx.fullscreen ? (
              <Minimize size={28} strokeWidth={2} />
            ) : (
              <Maximize size={28} strokeWidth={2} />
            )}
          </StremioBtn>
        </Tooltip>
      );
    case "window-controls":
      return <WindowControlButtons t={tr} />;
    default:
      return null;
  }
}
