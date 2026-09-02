import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Captions, Check, Gauge, Languages, LoaderCircle } from "lucide-react";
import { AllAddonsIcon } from "@/components/icons/harbor-glyphs";
import type { SubtitleMenuProps } from "@/components/player/subtitle-menu/types";
import type { PlayerBridge, PlayerSnapshot } from "@/lib/player/bridge";
import { writePlayerPrefs } from "@/lib/player-prefs";
import { useSettings } from "@/lib/settings";
import type { SkipSegment } from "@/lib/skip-intro";
import type { SpoilerMask } from "@/lib/spoilers";
import type { ScoredStream } from "@/lib/streams/types";
import { rememberedChoiceFromLoad, type SubChoiceInput } from "@/lib/subtitles/subtitle-memory";
import type { EngineStats } from "@/lib/torrent/engine-stats";
import { useView, type PlayerSrc, type PlayEpisode } from "@/lib/view";
import { MEDIA_SERVER_QUALITIES } from "@/lib/media-server/quality";
import { switchMediaServerQuality } from "@/lib/media-server/playback";
import type { MediaServerQuality } from "@/lib/media-server/types";
import { useBpT } from "@/views/big-picture/bp-i18n";
import { BpConnecting } from "@/views/big-picture/player/bp-connecting";
import { pushBpBack } from "@/views/big-picture/bp-back";
import { BpLeaveConfirm } from "@/views/big-picture/player/bp-leave-confirm";
import { useBpPlayer } from "@/views/big-picture/player/bp-player-context";
import { BpPlayerAudio, BpPlayerSources } from "@/views/big-picture/player/bp-player-sources";
import { BpPlayerShell } from "@/views/big-picture/player/bp-player-shell";
import { BpPlayerSlot } from "@/views/big-picture/player/bp-player-slots";
import { BpPlayerSubtitles } from "@/views/big-picture/player/bp-player-subtitles";
import { BpResumePrompt } from "@/views/big-picture/player/bp-resume-prompt";
import type { PlayerOverlayLayersProps } from "./player-overlay-layers";
import { requestPlayerClose } from "./request-player-close";
import { SkipPillContainer } from "./skip-pill-container";

const RESUME_PANEL = "resume";

export type BpTenFootProps = {
  src: PlayerSrc;
  snap: PlayerSnapshot;
  engine: "html5" | "mpv";
  bridgeRef: RefObject<PlayerBridge | null>;
  snapRef: RefObject<PlayerSnapshot>;
  rememberSubChoice: (t: SubChoiceInput | null | undefined) => void;
  metaImdbId: string | null;
  metaReleaseDate: string | null;
  isLocalSrc: boolean;
  sourceFailed: boolean;
  loaderForceShow: boolean;
  engineStats: EngineStats | null;
  onCancelLoad: () => void;
  onLoaderRetry: () => void;
  onLoaderShowingChange: (showing: boolean) => void;
  currentUrl: string;
  currentInfoHash: string | null;
  currentFileIdx: number | null;
  onSwitchStream: (stream: ScoredStream) => void | Promise<void>;
  skipSegments: SkipSegment[];
  hasNextEpisode: boolean;
  hasNextEpDisplay: boolean;
  nextEp: PlayEpisode | null;
  nextEpMask?: SpoilerMask;
  pillsVisible: boolean;
  allowAutoSkip: boolean;
  onSkip: (sec: number) => void;
  onNextEpisode: () => void;
  onCancelAutoNext: () => void;
  pendingResumeSec: number | null;
  onResume: () => void;
  onStartOver: () => void;
};

/**
 * Everything Big Picture puts on screen during playback.
 *
 * It exists because BpPlayerShell reads its panels from its own children, and
 * those panels need the player's live state. Mounting the shell from
 * bp-shell.tsx put it in a tree that has none of it, so the shell rendered with
 * no children and every finished surface in views/big-picture/player was
 * unreachable code. This is the seam: player state in, ten-foot surfaces out.
 *
 * The mouse-era chrome is suppressed while this is up. See the tenFoot gates in
 * player-overlay-layers.tsx: two transports fading on two independent timers is
 * the failure this replaced.
 */
function BpTenFoot(props: BpTenFootProps) {
  const t = useBpT();
  const { src, snap, engine, bridgeRef, snapRef, rememberSubChoice } = props;
  const metaId = src.meta.id;
  const resuming = props.pendingResumeSec != null;

  const onSubtitle = useCallback(
    (id: string | null) => {
      bridgeRef.current?.setSubtitleTrack(id);
      rememberSubChoice(snapRef.current.subtitleTracks.find((x) => x.id === id));
    },
    [bridgeRef, snapRef, rememberSubChoice],
  );

  const onSubDelay = useCallback(
    (sec: number) => {
      bridgeRef.current?.setSubDelay(sec);
      writePlayerPrefs(metaId, { subDelaySec: sec });
    },
    [bridgeRef, metaId],
  );

  const onAddSubtitle = useCallback<SubtitleMenuProps["onAddSubtitle"]>(
    (url, lang, title, metadata) => {
      const p =
        bridgeRef.current?.addSubtitle(url, lang, title, true, metadata) ?? Promise.resolve(false);
      void p.then((ok) => {
        if (!ok) return;
        rememberSubChoice(rememberedChoiceFromLoad(url, lang, title, metadata));
      });
      return p;
    },
    [bridgeRef, rememberSubChoice],
  );

  const onAudio = useCallback(
    (id: string) => {
      bridgeRef.current?.setAudioTrack(id);
      const track = snapRef.current.audioTracks.find((x) => x.id === id);
      if (track?.lang) writePlayerPrefs(metaId, { audioLang: track.lang });
    },
    [bridgeRef, snapRef, metaId],
  );

  const onAudioDelay = useCallback(
    (sec: number) => {
      bridgeRef.current?.setAudioDelay(sec);
    },
    [bridgeRef],
  );

  const subtitleProps = useMemo<SubtitleMenuProps>(
    () => ({
      tracks: snap.subtitleTracks,
      selectedId: snap.subtitleTracks.find((x) => x.selected)?.id ?? null,
      delaySec: snap.subDelaySec,
      onSelect: onSubtitle,
      onDelay: onSubDelay,
      onAddSubtitle,
      metaImdbId: props.metaImdbId,
      metaTitle: src.meta.name ?? null,
      metaReleaseDate: props.metaReleaseDate,
      season: src.episode?.season ?? null,
      episode: src.episode?.episode ?? null,
    }),
    [
      snap.subtitleTracks,
      snap.subDelaySec,
      onSubtitle,
      onSubDelay,
      onAddSubtitle,
      props.metaImdbId,
      props.metaReleaseDate,
      src.meta.name,
      src.episode,
    ],
  );

  return (
    <>
      {/* The resume fork blocks everything, so it takes the shell over rather
          than sitting beside panels the viewer could still drive behind it. */}
      <BpPlayerShell src={src} forcePanel={resuming ? RESUME_PANEL : null}>
        <BpPlayerSlot area="stage">
          <SkipPillContainer
            tenFoot
            engine={engine}
            skipSegments={props.skipSegments}
            durationSec={snap.durationSec}
            hasNextEpisode={props.hasNextEpisode}
            hasNextEpDisplay={props.hasNextEpDisplay}
            nextEp={props.nextEp}
            nextEpMask={props.nextEpMask}
            visible={props.pillsVisible && !resuming}
            allowAutoSkip={props.allowAutoSkip}
            onSkip={props.onSkip}
            onNextEpisode={props.onNextEpisode}
            onCancelAutoNext={props.onCancelAutoNext}
          />
        </BpPlayerSlot>

        {resuming && (
          <BpPlayerSlot area="panel" id={RESUME_PANEL} shellNav>
            <BpResumePrompt
              resumeSec={props.pendingResumeSec ?? 0}
              totalSec={snap.durationSec}
              title={src.meta.name ?? src.title}
              subtitle={src.subtitle}
              onResume={props.onResume}
              onStartOver={props.onStartOver}
            />
          </BpPlayerSlot>
        )}

        {!resuming && (
          <BpPlayerSlot
            area="panel"
            id="subtitles"
            label={t("Subtitles")}
            icon={<Captions size={21} strokeWidth={2.2} />}
            shellNav
          >
            <SubtitlesPanel {...subtitleProps} />
          </BpPlayerSlot>
        )}

        {!resuming && (
          <BpPlayerSlot
            area="panel"
            id="audio"
            label={t("Audio")}
            icon={<Languages size={21} strokeWidth={2.2} />}
            shellNav
          >
            <AudioPanel
              tracks={snap.audioTracks}
              selectedId={snap.audioTracks.find((x) => x.selected)?.id ?? null}
              delaySec={snap.audioDelaySec}
              engine={engine}
              title={src.meta.name ?? src.title}
              onSelect={onAudio}
              onDelay={onAudioDelay}
            />
          </BpPlayerSlot>
        )}

        {!resuming && !src.isLive && (
          <BpPlayerSlot
            area="panel"
            id="sources"
            label={t("Sources")}
            icon={<AllAddonsIcon size={21} />}
            shellNav
          >
            <SourcesPanel
              meta={src.meta}
              episode={src.episode}
              currentUrl={props.currentUrl}
              currentInfoHash={props.currentInfoHash}
              currentFileIdx={props.currentFileIdx}
              onPick={props.onSwitchStream}
            />
          </BpPlayerSlot>
        )}

        {!resuming && src.homeServer && (
          <BpPlayerSlot
            area="panel"
            id="home-server-quality"
            label={t("Quality")}
            icon={<Gauge size={21} strokeWidth={2.2} />}
            shellNav
          >
            <HomeServerQualityPanel
              src={src}
              positionMs={Math.max(0, snap.positionSec * 1000)}
              playing={snap.status === "playing"}
            />
          </BpPlayerSlot>
        )}
      </BpPlayerShell>

      {/* Its own portal above the shell, and it declares data-bp-overlay, which
          is what stands the shell's key listener down so exactly one listener
          acts on arrows while it is up. */}
      <BpConnecting
        src={src}
        snap={snap}
        forceShow={props.loaderForceShow}
        failed={props.sourceFailed && !props.isLocalSrc}
        engineStats={props.engineStats}
        onCancel={props.onCancelLoad}
        onRetry={props.onLoaderRetry}
        onShowingChange={props.onLoaderShowingChange}
      />
      <BpLeaveConfirm />
    </>
  );
}

// The adapter, so the overlay list stays a list. The back edge to
// PlayerOverlayLayersProps is type-only and erases at compile time.
export function BpTenFootLayer({ p }: { p: PlayerOverlayLayersProps }) {
  const { settings, update } = useSettings();
  const closeRef = useRef<() => void>(() => {});
  closeRef.current = () => {
    void requestPlayerClose({
      drawMode: p.drawMode,
      setDrawMode: (v) => p.setDrawMode(() => v),
      closePlayer: p.closePlayer,
      playerEscExitsFullscreen: false,
      playerConfirmLeave: settings.playerConfirmLeave,
      onRememberConfirmLeave: () => update({ playerConfirmLeave: false }),
    });
  };

  useEffect(
    () =>
      pushBpBack(() => {
        closeRef.current();
        return true;
      }),
    [],
  );

  return (
    <BpTenFoot
      src={p.src}
      snap={p.snap}
      engine={p.engine}
      bridgeRef={p.bridgeRef}
      snapRef={p.snapRef}
      rememberSubChoice={p.rememberSubChoice}
      metaImdbId={p.resolvedImdbId}
      metaReleaseDate={p.src.meta.releaseDate ?? null}
      isLocalSrc={p.isLocalSrc}
      sourceFailed={p.sourceFailed}
      loaderForceShow={p.swappingEp || p.swapResolvingKey != null}
      engineStats={p.engineStats ?? null}
      onCancelLoad={p.cancelToPicker}
      onLoaderRetry={p.onLoaderRetry}
      onLoaderShowingChange={p.setLoaderShowing}
      currentUrl={p.liveUrl}
      currentInfoHash={p.currentInfoHash ?? null}
      currentFileIdx={p.currentFileIdx ?? null}
      onSwitchStream={p.onSwitchStream}
      skipSegments={p.skipSegments}
      hasNextEpisode={p.hasNextEpisode}
      hasNextEpDisplay={p.hasNextEpDisplay}
      nextEp={p.nextEp}
      nextEpMask={p.nextEpMask}
      pillsVisible={p.pillsVisible}
      allowAutoSkip={p.allowAutoSkip}
      onSkip={p.seekTo}
      onNextEpisode={p.playNext}
      onCancelAutoNext={() => p.setAutoNextCancelled(true)}
      pendingResumeSec={p.pendingResumeSec}
      onResume={() => p.acknowledgeResume("resume")}
      onStartOver={() => p.acknowledgeResume("start-over")}
    />
  );
}

// Panel bodies render inside BpPlayerProvider, so they read closePanel from the
// shell rather than having it threaded down from the player.
function SubtitlesPanel(props: SubtitleMenuProps) {
  const { closePanel } = useBpPlayer();
  return <BpPlayerSubtitles {...props} onClose={closePanel} />;
}

function AudioPanel(props: Omit<Parameters<typeof BpPlayerAudio>[0], "onClose">) {
  const { closePanel } = useBpPlayer();
  return <BpPlayerAudio {...props} onClose={closePanel} />;
}

function SourcesPanel(props: Omit<Parameters<typeof BpPlayerSources>[0], "onClose">) {
  const { closePanel } = useBpPlayer();
  const openedWith = useRef(props.currentUrl);

  // The only success signal a swap gives. onSwitchStream returns void and
  // swallows a failed resolve, so closing when the promise settles would close
  // the list on failure too and look like nothing happened. liveUrl only moves
  // once the new stream is actually loaded.
  useEffect(() => {
    if (props.currentUrl !== openedWith.current) closePanel();
  }, [props.currentUrl, closePanel]);

  return <BpPlayerSources {...props} onClose={closePanel} />;
}

function HomeServerQualityPanel({
  src,
  positionMs,
  playing,
}: {
  src: PlayerSrc;
  positionMs: number;
  playing: boolean;
}) {
  const t = useBpT();
  const { closePanel } = useBpPlayer();
  const { replacePlayerSrc } = useView();
  const [switching, setSwitching] = useState<MediaServerQuality | null>(null);
  const [error, setError] = useState("");
  const select = async (quality: MediaServerQuality) => {
    if (quality === src.homeServer?.quality) {
      closePanel();
      return;
    }
    setSwitching(quality);
    setError("");
    try {
      replacePlayerSrc(await switchMediaServerQuality({ src, quality, positionMs, playing }));
      closePanel();
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : String(cause)} ${t("The current stream is still playing. Original remains available.")}`,
      );
    } finally {
      setSwitching(null);
    }
  };
  return (
    <div
      data-bp-dialog
      className="flex h-full flex-col justify-center gap-[clamp(14px,2vh,28px)] px-[var(--bp-gutter)]"
    >
      <div>
        <h2 className="font-display text-[clamp(24px,4vh,52px)] font-semibold text-ink">
          {t("Home server quality")}
        </h2>
        <p className="mt-2 text-[clamp(13px,1.8vh,20px)] text-ink-subtle">
          {t("Switch quality without losing your place.")}
        </p>
      </div>
      <div
        data-bp-scroll-y
        className="grid max-h-[58vh] grid-cols-2 gap-[clamp(8px,1vw,16px)] overflow-y-auto"
      >
        {MEDIA_SERVER_QUALITIES.map((quality, index) => {
          const active = quality.id === src.homeServer?.quality;
          return (
            <button
              key={quality.id}
              type="button"
              data-bp-focusable
              data-bp-chip
              data-bp-autofocus={index === 0 ? "true" : undefined}
              disabled={switching != null}
              onClick={() => void select(quality.id)}
              className={`flex min-h-[clamp(64px,8vh,92px)] items-center justify-between rounded-[var(--bp-r-md)] px-[clamp(18px,2vw,30px)] text-[clamp(15px,2.1vh,23px)] font-semibold ${active ? "bg-[var(--bp-on)] text-ink" : "border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-ink-subtle"}`}
            >
              <span>{t(quality.label)}</span>
              {switching === quality.id ? (
                <LoaderCircle className="animate-spin" size={22} />
              ) : active ? (
                <Check size={22} />
              ) : null}
            </button>
          );
        })}
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-[var(--bp-r-sm)] bg-red-950/80 px-5 py-4 text-[clamp(13px,1.7vh,19px)] text-red-100 ring-1 ring-red-400/30"
        >
          {error}
        </p>
      )}
    </div>
  );
}
