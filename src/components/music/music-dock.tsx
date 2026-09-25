import { trackViewportBottom } from "@/lib/viewport-bottom";
import { isMusicLiked } from "@/lib/music/liked";
import { pushBackHandler } from "@/lib/back-intercept";
import { useModalExit } from "@/components/modal-shell";
import { artistCreditParts } from "@/lib/music/search-artists";
import { MusicArtistLink } from "./music-artist-link";
import { MusicDownloadButton } from "./music-download-button";
import { useRecordingProfile } from "@/lib/music/use-recording-profile";
import {
  useEffect,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type PointerEvent,
  type RefObject,
} from "react";
import {
  Heart,
  ChevronDown,
  ChevronUp,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SlidersHorizontal,
  Speaker,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { MusicQueue, cycleMusicRepeat, toggleMusicShuffle, useMusicTransport } from "./music-queue";
import { Poster } from "@/components/poster";
import { CastIcon } from "@/components/player/cast-icon";
import { Slider } from "@/components/slider";
import { useT } from "@/lib/i18n";
import {
  clearMusicError,
  closeMusicPlayer,
  getMusicState,
  isMusicVideoActive,
  nextMusic,
  previousMusic,
  playMusic,
  seekMusic,
  musicSimilarTracks,
  setMusicVolume,
  toggleMusicLiked,
  toggleMusicPlayback,
  useMusicPlayer,
} from "@/lib/music/player";
import { useView } from "@/lib/view";
import { MusicSourcePicker } from "./music-source-picker";
import { requestMusicConnection } from "./music-connections";
import { MusicServiceLogo } from "./music-service-logo";
import { MusicQualityBadge } from "./music-quality-badge";
import { useMusicTrackContextMenu } from "./music-track-menu";
import { useMusicDockLayout } from "@/lib/music/dock-layout";
import { MusicDockVisualizer } from "./music-dock-visualizer";
import { MusicDockOverflow, type MusicDockAction } from "./music-dock-overflow";
import { getMusicPlaybackOrigin, musicTitleTarget } from "@/lib/music/playback-origin";
import { requestMusicPlaylist } from "@/lib/music/navigation";
import { MusicNowPlaying } from "./music-now-playing";
import { useMusicAppearance, useMusicArtworkColor } from "@/lib/music/appearance";
import { requestMusicExplore, requestMusicPanel } from "@/lib/music/navigation";
import { musicSourceName } from "@/lib/music/recovery";
import { musicVolumeCeiling, useMusicAudioSettings } from "@/lib/music/audio-settings";
import { getMusicSpeakerState, subscribeMusicSpeakerState } from "@/lib/music/casting";
import "./music-dock.css";

const DOCK_HEIGHT = 76;
const TAB_HEIGHT = 32;
const SETTLE_MS = 1200;

const MUSIC_TIME_FONT = {
  fontFamily: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
} as const;

const ICON_BUTTON =
  "music-dock-icon grid h-11 w-11 shrink-0 place-items-center text-ink-muted transition-colors duration-200 ease-out";
const ICON_BUTTON_ON = `${ICON_BUTTON} music-dock-icon-on`;

function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function approachThumb(event: PointerEvent<HTMLElement>, fraction: number) {
  if (event.pointerType !== "mouse") return;
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  const rtl = getComputedStyle(element).direction === "rtl";
  const x = rect.left + rect.width * (rtl ? 1 - fraction : fraction);
  const y = rect.top + rect.height / 2;
  const proximity = Math.max(0, 1 - Math.hypot(event.clientX - x, event.clientY - y) / 56);
  element.style.setProperty("--dock-thumb-approach", proximity.toFixed(3));
}

function useDockInset(
  ref: RefObject<HTMLElement | null>,
  visible: boolean,
  collapsed: boolean,
): number {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const dock = ref.current;
    const root = dock?.parentElement;
    if (!dock || !root || !visible) return;
    let sizeObserver: ResizeObserver | null = null;
    const attach = () => {
      sizeObserver?.disconnect();
      sizeObserver = null;
      let rail: HTMLElement | null = null;
      for (const child of Array.from(root.children)) {
        if (child === dock) break;
        if (child instanceof HTMLElement && child.tagName === "ASIDE") rail = child;
      }
      if (!rail) {
        setInset(0);
        return;
      }
      const measured = rail;
      setInset(measured.offsetWidth);
      sizeObserver = new ResizeObserver(() => setInset(measured.offsetWidth));
      sizeObserver.observe(measured);
    };
    attach();
    const treeObserver = new MutationObserver(attach);
    treeObserver.observe(root, { childList: true });
    return () => {
      treeObserver.disconnect();
      sizeObserver?.disconnect();
    };
  }, [ref, visible, collapsed]);
  return inset;
}

export function MusicDock() {
  const t = useT();
  const player = useMusicPlayer();
  const speaker = useSyncExternalStore(
    subscribeMusicSpeakerState,
    getMusicSpeakerState,
    getMusicSpeakerState,
  );
  const transport = useMusicTransport();
  useMusicAudioSettings();
  const { topKind, setView } = useView();
  const dockRef = useRef<HTMLElement | null>(null);
  const sourceButton = useRef<HTMLButtonElement | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeSource = useCallback(() => setSourceOpen(false), []);
  useEffect(() => {
    const recover = () => {
      setQueueOpen(false);
      setSourceOpen(true);
    };
    window.addEventListener("harbor:music-playback-source-required", recover);
    return () => window.removeEventListener("harbor:music-playback-source-required", recover);
  }, []);
  const closeExpanded = useCallback(() => setExpanded(false), []);
  const nowExit = useModalExit(closeExpanded, expanded);
  useEffect(() => trackViewportBottom(), []);
  const reopenAfterBack = useRef(false);
  const backRestore = useRef<(() => void) | null>(null);
  const armExpandRestore = useCallback(() => {
    backRestore.current?.();
    backRestore.current = pushBackHandler(() => {
      backRestore.current?.();
      backRestore.current = null;
      reopenAfterBack.current = true;
      return false;
    });
  }, []);
  useEffect(
    () => () => {
      backRestore.current?.();
      backRestore.current = null;
    },
    [],
  );
  useEffect(() => {
    if (reopenAfterBack.current) {
      reopenAfterBack.current = false;
      setExpanded(true);
      return;
    }
    setExpanded(false);
  }, [topKind]);
  const appearance = useMusicAppearance();
  const dockParts = useMusicDockLayout();
  const [similarPending, setSimilarPending] = useState(false);
  const { profile: recording, display } = useRecordingProfile(player.current);
  const artworkColor = useMusicArtworkColor(display?.artwork, appearance.artworkColors);
  const [scrub, setScrub] = useState<number | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const draggingRef = useRef(false);
  const audibleVolume = useRef(player.volume > 0 ? player.volume : 0.82);
  useEffect(() => {
    if (player.volume > 0) audibleVolume.current = player.volume;
  }, [player.volume]);

  const current = player.current;
  // Mirrors the secondary controls so a narrow dock loses none of them, only their icons.
  const overflowActions = (): MusicDockAction[] => {
    const out: MusicDockAction[] = [];
    if (dockParts.queue)
      out.push({
        id: "queue",
        label: t("music.transport.openQueue"),
        icon: <ListMusic size={17} />,
        run: openQueue,
        active: queueOpen,
      });
    if (dockParts.like)
      out.push({
        id: "like",
        label: t(liked ? "music.unsaveTrack" : "music.saveTrack"),
        icon: <Heart size={17} fill={liked ? "currentColor" : "none"} />,
        run: () => toggleMusicLiked(),
        active: liked,
      });
    if (dockParts.source)
      out.push({
        id: "source",
        label: t("music.source.another"),
        icon: (
          <MusicServiceLogo
            source={current?.connectorId ?? ""}
            itemId={current?.id ?? ""}
            size={17}
          />
        ),
        run: changeSource,
      });
    if (dockParts.cast || speaker.active)
      out.push({
        id: "cast",
        label: t("music.cast.title"),
        icon: <Speaker size={17} />,
        run: openSpeakers,
        active: speaker.active,
      });
    if (dockParts.audio)
      out.push({
        id: "audio",
        label: t("music.audio.title"),
        icon: <SlidersHorizontal size={17} />,
        run: openAudio,
      });
    return out;
  };

  useEffect(() => {
    draggingRef.current = false;
    setDragging(false);
    setScrub(null);
  }, [current?.id]);
  const visible = Boolean(current) && topKind !== "player" && topKind !== "picker";
  const inset = useDockInset(dockRef, visible, collapsed);
  const attachVolumeWheel = useCallback((node: HTMLSpanElement | null) => {
    if (!node) return;
    const adjust = (event: WheelEvent) => {
      if (event.ctrlKey || !(event.deltaY || event.deltaX)) return;
      event.preventDefault();
      event.stopPropagation();
      setMusicVolume(getMusicState().volume - Math.sign(event.deltaY || event.deltaX) * 0.05);
    };
    node.addEventListener("wheel", adjust, { passive: false });
    return () => node.removeEventListener("wheel", adjust);
  }, []);

  useEffect(() => {
    if (topKind !== "player") return;
    if (getMusicState().phase === "playing") toggleMusicPlayback();
  }, [topKind]);

  useEffect(() => {
    const root = document.documentElement;
    if (visible) {
      root.dataset.musicDockActive = "on";
      const fallback = collapsed ? TAB_HEIGHT : DOCK_HEIGHT;
      const publish = (height: number) => {
        root.style.setProperty("--harbor-music-dock", `${Math.max(0, Math.round(height))}px`);
        root.style.setProperty(
          "--harbor-dock-gap",
          `calc(var(--harbor-music-dock, 0px) + var(--harbor-viewport-bottom, 0px))`,
        );
      };
      publish(fallback);
      const node = dockRef.current;
      if (node) {
        publish(node.getBoundingClientRect().height || fallback);
        const observer = new ResizeObserver((entries) => {
          const measured = entries[0]?.contentRect.height ?? 0;
          publish(measured || fallback);
        });
        observer.observe(node);
        return () => {
          observer.disconnect();
          delete root.dataset.musicDockActive;
          root.style.removeProperty("--harbor-music-dock");
          root.style.removeProperty("--harbor-dock-gap");
        };
      }
    } else {
      setQueueOpen(false);
      setExpanded(false);
      setCollapsed(false);
      delete root.dataset.musicDockActive;
      root.style.removeProperty("--harbor-music-dock");
      root.style.removeProperty("--harbor-dock-gap");
    }
    return () => {
      delete root.dataset.musicDockActive;
      root.style.removeProperty("--harbor-music-dock");
      root.style.removeProperty("--harbor-dock-gap");
    };
  }, [visible, collapsed]);

  useEffect(() => {
    if (scrub === null || dragging) return;
    if (Math.abs(player.currentTime - scrub) < 1.5) {
      setScrub(null);
      return;
    }
    const id = window.setTimeout(() => setScrub(null), SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [scrub, dragging, player.currentTime]);

  const artMenu = useMusicTrackContextMenu(display, {
    onGoToArtist: () => {
      if (!display) return;
      setExpanded(false);
      setView("music");
      requestMusicExplore({ kind: "artist", track: display });
    },
    onGoToAlbum: () => {
      if (!display) return;
      setExpanded(false);
      setView("music");
      requestMusicExplore({ kind: "album", track: display, album: recording?.album });
    },
    onMoreLikeThis: () => {
      if (!display || similarPending) return;
      setSimilarPending(true);
      void musicSimilarTracks(display)
        .then((mix) => {
          setExpanded(false);
          setView("music");
          requestMusicExplore({ kind: "similar", track: display, queue: mix });
        })
        .catch(() => {})
        .finally(() => setSimilarPending(false));
    },
  });

  if (!visible || !current || !display) return null;

  const playing = player.phase === "playing";
  const resolving = player.phase === "resolving";
  const liked = isMusicLiked(player.likedIds, current);
  const duration = Math.max(player.duration || current.durationSeconds || 0, 1);
  const position = Math.max(0, Math.min(scrub ?? player.currentTime, duration));
  const percent = `${(position / duration) * 100}%`;
  const changeSource = () => {
    setQueueOpen(false);
    setSourceOpen((open) => !open);
  };
  const openSpeakers = () => {
    setExpanded(false);
    setView("music");
    requestMusicPanel("__speakers");
  };
  const openAudio = () => {
    setExpanded(false);
    setView("music");
    requestMusicPanel("__audio");
  };
  const openQueue = () => {
    setExpanded(false);
    setQueueOpen((open) => !open);
  };

  const commitScrub = (value: number) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    seekMusic(value);
  };

  const onPointerUp = (event: PointerEvent<HTMLInputElement>) => {
    commitScrub(Number(event.currentTarget.value));
  };

  const cancelScrub = () => {
    draggingRef.current = false;
    setDragging(false);
    setScrub(null);
  };

  const repeatLabel =
    transport.repeat === "one"
      ? t("music.transport.repeatOne")
      : transport.repeat === "all"
        ? t("music.transport.repeatAll")
        : t("music.transport.repeat");

  if (collapsed) {
    return (
      <aside
        ref={dockRef}
        data-music-dock
        data-music-dock-tab
        aria-label={t("music.player")}
        style={
          {
            insetInlineStart: inset,
            insetInlineEnd: 0,
            height: TAB_HEIGHT,
            bottom: "var(--harbor-viewport-bottom, 0px)",
          } as CSSProperties
        }
        className="pointer-events-none fixed bottom-0 z-[120] flex items-end"
      >
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={t("music.dock.show")}
          title={`${t("music.dock.show")} · ${display.title}`}
          className="music-dock-tab pointer-events-auto"
        >
          <ChevronUp size={15} aria-hidden="true" />
          <span className="music-dock-tab-title">{display.title}</span>
        </button>
      </aside>
    );
  }

  return (
    <aside
      ref={dockRef}
      data-music-dock
      data-art-colors={artworkColor ? "on" : undefined}
      role={expanded ? "dialog" : undefined}

      aria-label={t(expanded ? "music.now.title" : "music.player")}
      style={
        {
          insetInlineStart: inset,
          insetInlineEnd: 0,
          height: DOCK_HEIGHT,
          bottom: "var(--harbor-viewport-bottom, 0px)",
          ...(artworkColor
            ? { "--music-art-accent": artworkColor.color, "--music-art-ink": artworkColor.ink }
            : {}),
        } as CSSProperties
      }
      className="@container fixed bottom-0 z-[120] border-t border-edge bg-canvas text-ink"
    >
      {expanded && (
        <MusicNowPlaying
          inset={inset}
          dockRef={dockRef}
          closing={nowExit.closing}
          onClose={nowExit.close}
          onExplore={(kind, artist, track) => {
            armExpandRestore();
            setExpanded(false);
            setView("music");
            requestMusicExplore({
              kind,
              track: track ?? display,
              album: track ? undefined : recording?.album,
              artist,
            });
          }}
          onAudio={openAudio}
          onSpeakers={openSpeakers}
          onSource={changeSource}
          onQueue={openQueue}
        />
      )}
      <div
        className="music-dock-seek"
        data-dragging={dragging || undefined}
        onPointerMove={(event) => {
          approachThumb(event, position / duration);
          const rect = event.currentTarget.getBoundingClientRect();
          setHoverFrac(
            rect.width ? Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) : 0,
          );
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.removeProperty("--dock-thumb-approach");
          setHoverFrac(null);
        }}
      >
        <span className="music-dock-seek-track" aria-hidden="true">
          <span className="block h-full bg-ink" style={{ width: percent }} />
          <span
            className="music-dock-seek-thumb"
            style={{ insetInlineStart: `clamp(12px, ${percent}, calc(100% - 12px))` }}
          />
        </span>
        {hoverFrac !== null && !resolving && (
          <span
            className="music-dock-seek-tip"
            aria-hidden="true"
            style={{ insetInlineStart: `clamp(22px, ${hoverFrac * 100}%, calc(100% - 22px))` }}
          >
            {timeLabel(hoverFrac * duration)}
          </span>
        )}
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={position}
          disabled={resolving}
          aria-label={t("music.position")}
          aria-valuetext={`${timeLabel(position)} / ${timeLabel(duration)}`}
          onPointerDown={(event) => {
            if (event.button !== 0 || resolving) return;
            draggingRef.current = true;
            setDragging(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={onPointerUp}
          onPointerCancel={cancelScrub}
          onLostPointerCapture={() => {
            if (draggingRef.current) cancelScrub();
          }}
          onBlur={(event) => commitScrub(Number(event.currentTarget.value))}
          onChange={(event) => {
            const value = Number(event.currentTarget.value);
            setScrub(value);
            if (!draggingRef.current) seekMusic(value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer appearance-none bg-transparent opacity-0 disabled:cursor-default"
        />
      </div>

      <div className="grid h-full grid-flow-col auto-cols-auto grid-cols-[minmax(0,1fr)] items-center gap-1 px-3 pt-2 pb-2 @[700px]:gap-2 @[700px]:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            data-music-dock-hide
            className={`music-dock-hide ${ICON_BUTTON}`}
            aria-label={t("music.dock.hide")}
            title={t("music.dock.hide")}
            onClick={() => {
              setQueueOpen(false);
              setExpanded(false);
              setCollapsed(true);
            }}
          >
            <ChevronDown size={19} aria-hidden="true" />
          </button>
          <div className="music-dock-track flex min-w-0 flex-1 items-center gap-3 text-start">
            <button
              data-music-dock-art
              type="button"
              aria-expanded={expanded}
              aria-label={t(expanded ? "music.now.collapse" : "music.now.expand")}
              onClick={() => {
                setQueueOpen(false);
                setExpanded((open) => !open);
              }}
              onContextMenu={artMenu.onContextMenu}
              className="block size-11 shrink-0 overflow-hidden rounded-md bg-elevated"
            >
              <Poster
                src={display.artwork}
                seed={`track:${current.connectorId ?? ""}:${current.sourceId ?? current.id}`}
                ratio="square"
                className="w-full [--poster-radius:0px]"
              />
            </button>
            <div className="flex min-w-0 max-w-[28ch] flex-1 flex-col">
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setView("music");
                  const target = musicTitleTarget(getMusicPlaybackOrigin());
                  if (target.kind === "playlist")
                    requestMusicPlaylist(target.playlistId, display.id);
                  else if (target.kind === "similar")
                    void musicSimilarTracks(display)
                      .then((mix) =>
                        requestMusicExplore({ kind: "similar", track: display, queue: mix }),
                      )
                      .catch(() => {});
                  else
                    requestMusicExplore({ kind: "album", track: display, album: recording?.album });
                }}
                className="truncate text-start text-[13px] font-semibold text-ink"
                title={display.title}
              >
                {display.title}
              </button>
              <MusicArtistLink
                name={
                  artistCreditParts(current.artist).length > 1 ? current.artist : display.artist
                }
                track={current}
                className="text-[12px] text-ink-subtle"
                onArtist={(name) => {
                  setExpanded(false);
                  setView("music");
                  requestMusicExplore({ kind: "artist", track: { ...display, artist: name } });
                }}
              />
            </div>
            <MusicDockVisualizer
              track={current}
              enabled={appearance.dockVisualizer}
              playing={playing}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-0.5">
          <button
            type="button"
            onClick={toggleMusicShuffle}
            aria-pressed={transport.shuffle}
            aria-label={t("music.transport.shuffle")}
            className={`${dockParts.shuffle ? "hidden @[600px]:grid" : "hidden"} ${transport.shuffle ? ICON_BUTTON_ON : ICON_BUTTON}`}
          >
            <Shuffle size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => previousMusic()}
            aria-label={t("music.previous")}
            className={ICON_BUTTON}
          >
            <SkipBack size={18} fill="currentColor" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={toggleMusicPlayback}
            disabled={resolving}
            aria-label={playing ? t("music.pause") : t("music.play")}
            className="music-dock-play grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-canvas transition-opacity duration-200 ease-out disabled:opacity-55"
          >
            {resolving ? (
              <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
            ) : playing ? (
              <Pause size={20} fill="currentColor" aria-hidden="true" />
            ) : (
              <Play size={20} fill="currentColor" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => nextMusic()}
            aria-label={t("music.next")}
            className={ICON_BUTTON}
          >
            <SkipForward size={18} fill="currentColor" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={cycleMusicRepeat}
            aria-pressed={transport.repeat !== "off"}
            aria-label={repeatLabel}
            title={repeatLabel}
            className={`${dockParts.repeat ? "hidden @[600px]:grid" : "hidden"} ${transport.repeat === "off" ? ICON_BUTTON : ICON_BUTTON_ON}`}
          >
            {transport.repeat === "one" ? (
              <Repeat1 size={18} aria-hidden="true" />
            ) : (
              <Repeat size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={openQueue}
            aria-expanded={queueOpen}
            aria-label={t("music.transport.openQueue")}
            className={`${speaker.active ? "hidden @[700px]:grid" : ""} @[1050px]:hidden ${queueOpen ? ICON_BUTTON_ON : ICON_BUTTON}`}
          >
            <ListMusic size={18} aria-hidden="true" />
          </button>
          {speaker.active && speaker.device && (
            <button
              type="button"
              onClick={openSpeakers}
              aria-label={`${t("music.cast.title")} · ${speaker.device.name}`}
              title={speaker.device.name}
              className={`@[700px]:hidden ${ICON_BUTTON_ON}`}
            >
              <span className="music-dock-device size-8">
                <CastIcon device={speaker.device} size={32} />
              </span>
            </button>
          )}
        </div>

        <div className="hidden min-w-0 items-center justify-end gap-1 @[700px]:flex">
          {dockParts.quality && !isMusicVideoActive() && (
            <span className="hidden shrink-0 @[1320px]:inline-flex">
              <MusicQualityBadge track={current} />
            </span>
          )}
          {dockParts.source && (
            <button
              ref={sourceButton}
              data-dock-wide="1"
              type="button"
              onClick={changeSource}
              aria-haspopup="dialog"
              aria-expanded={sourceOpen}
              aria-label={t("music.source.another")}
              title={t("music.source.another")}
              className={ICON_BUTTON}
            >
              <MusicServiceLogo source={current.connectorId ?? ""} itemId={current.id} size={20} />
            </button>
          )}
          {dockParts.time && (
            <span
              style={MUSIC_TIME_FONT}
              className="hidden shrink-0 text-[15px] font-semibold tabular-nums text-ink @[820px]:block"
            >
              {timeLabel(position)}
              <span className="mx-1 text-ink-subtle">/</span>
              <span className="text-ink-subtle">{timeLabel(duration)}</span>
            </span>
          )}
          <button
            type="button"
            onClick={openQueue}
            aria-expanded={queueOpen}
            aria-label={t("music.transport.openQueue")}
            className={`${dockParts.queue ? "hidden @[1050px]:grid" : "hidden"} ${queueOpen ? ICON_BUTTON_ON : ICON_BUTTON}`}
          >
            <ListMusic size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => toggleMusicLiked()}
            aria-pressed={liked}
            aria-label={liked ? t("music.unsaveTrack") : t("music.saveTrack")}
            className={`${dockParts.like ? "hidden @[1150px]:grid" : "hidden"} ${ICON_BUTTON}`}
          >
            <Heart size={18} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setMusicVolume(player.volume > 0 ? 0 : audibleVolume.current)}
            disabled={speaker.active}
            aria-label={t(player.volume > 0 ? "music.mute" : "music.unmute")}
            aria-pressed={player.volume === 0}
            className={ICON_BUTTON}
          >
            {player.volume === 0 ? (
              <VolumeX size={18} aria-hidden="true" />
            ) : (
              <Volume2 size={18} aria-hidden="true" />
            )}
          </button>
          <span
            ref={attachVolumeWheel}
            className={`music-dock-volume hidden h-11 w-20 shrink-0 items-center ${dockParts.volume ? "@[900px]:flex" : ""}`}
            title={`${t("music.volume")} · ${Math.round(player.volume * 100)}%`}
            onPointerMove={(event) =>
              approachThumb(event, player.volume / musicVolumeCeiling(current.connectorId))
            }
            onPointerLeave={(event) =>
              event.currentTarget.style.removeProperty("--dock-thumb-approach")
            }
          >
            <Slider
              value={player.volume}
              min={0}
              max={musicVolumeCeiling(current.connectorId)}
              step={0.02}
              onChange={setMusicVolume}
              disabled={speaker.active}
              ariaLabel={t("music.volume")}
              className="block w-full"
            />
          </span>
          {(dockParts.cast || speaker.active) && (
            <button
              type="button"
              data-dock-wide="1"
              onClick={openSpeakers}
              aria-label={
                speaker.active && speaker.device
                  ? `${t("music.cast.title")} · ${speaker.device.name}`
                  : t("music.cast.title")
              }
              title={speaker.active ? speaker.device?.name : t("music.cast.title")}
              className={speaker.active ? ICON_BUTTON_ON : ICON_BUTTON}
            >
              {speaker.active && speaker.device ? (
                <span className="music-dock-device size-8">
                  <CastIcon device={speaker.device} size={32} />
                </span>
              ) : (
                <Speaker size={18} aria-hidden="true" />
              )}
            </button>
          )}
          {dockParts.download && <MusicDownloadButton track={current} className={ICON_BUTTON} />}
          {dockParts.audio && (
            <button
              type="button"
              data-dock-wide="1"
              onClick={openAudio}
              aria-label={t("music.audio.title")}
              title={t("music.audio.title")}
              className={ICON_BUTTON}
            >
              <SlidersHorizontal size={18} aria-hidden="true" />
            </button>
          )}
        </div>
        {current && (
          <MusicDockOverflow
            actions={overflowActions()}
            title={display?.title ?? current.title}
            className={`@[1150px]:hidden ${ICON_BUTTON}`}
          />
        )}
        <button
          type="button"
          data-music-dock-close
          disabled={closing}
          aria-label={t("music.player.close")}
          title={t("music.player.close")}
          className={ICON_BUTTON}
          onClick={() => {
            setClosing(true);
            void closeMusicPlayer()
              .then(() => {
                setSourceOpen(false);
                setQueueOpen(false);
                setExpanded(false);
              })
              .catch(() => {})
              .finally(() => setClosing(false));
          }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      {player.error && (
        <div
          role="alert"
          style={{ insetInlineStart: 16 }}
          className="absolute bottom-full mb-2 flex max-w-[min(540px,90vw)] flex-wrap items-center gap-2 rounded-lg bg-elevated px-4 py-2 text-[13px]"
        >
          <span className="min-w-0 flex-1 py-2 text-ink">
            {player.error.startsWith("music.cast.")
              ? t(player.error)
              : t("music.recovery.failed", { source: musicSourceName(current) })}
          </span>
          {player.error.startsWith("music.cast.") && (
            <button
              type="button"
              onClick={openSpeakers}
              className="rounded-md bg-raised px-3 py-2 font-semibold text-ink"
            >
              {t("music.cast.title")}
            </button>
          )}
          <button
            type="button"
            onClick={() => void playMusic(current, player.queue).catch(() => {})}
            className="rounded-md bg-raised px-3 py-2 font-semibold text-ink"
          >
            {t("common.retry")}
          </button>
          <button
            type="button"
            onClick={changeSource}
            className="rounded-md bg-ink px-3 py-2 font-semibold text-canvas"
          >
            {t("music.source.another")}
          </button>
          <button
            type="button"
            onClick={clearMusicError}
            aria-label={t("music.error.dismiss")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors duration-200 ease-out hover:bg-raised hover:text-ink"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      {artMenu.menu}
      <MusicQueue
        open={queueOpen}
        onClose={() => setQueueOpen(false)}
        onArtist={(track) => {
          setExpanded(false);
          setView("music");
          requestMusicExplore({ kind: "artist", track });
        }}
      />
      {sourceOpen && (
        <MusicSourcePicker
          anchor={sourceButton}
          key={`${current.connectorId}:${current.id}`}
          request={{
            track: current,
            queue: player.queue,
            forceChoice: true,
            failure: player.error ?? undefined,
            failedTrack: current,
          }}
          onClose={closeSource}
          onStarting={closeSource}
          onConnect={() => {
            setExpanded(false);
            setView("music");
            requestMusicConnection("spotify");
          }}
        />
      )}
    </aside>
  );
}
