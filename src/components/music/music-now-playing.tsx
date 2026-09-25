import { isMusicLiked } from "@/lib/music/liked";
import { artistCreditParts } from "@/lib/music/search-artists";
import { MusicArtistLink } from "./music-artist-link";
import { MusicDownloadButton } from "./music-download-button";
import { MusicListeningDetails } from "./music-listening-details";
import { useRecordingProfile } from "@/lib/music/use-recording-profile";
import type { MusicArtistRef, MusicTrack } from "@/lib/music/types";
import {
  type CSSProperties,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowUpRight,
  AudioLines,
  BarChart3,
  Heart,
  ListMusic,
  Maximize,
  Mic2,
  Palette,
  Search,
  SlidersHorizontal,
  Speaker,
  Video,
  Wallpaper,
} from "lucide-react";
import { Poster } from "@/components/poster";
import { useMusicTrackContextMenu } from "./music-track-menu";
import { useUpNextSuggestions } from "@/lib/music/up-next";
import { MusicUpNextRow } from "./music-up-next-row";
import { MusicVideoSurface } from "./music-video-surface";
import { MusicVideoFullscreen } from "./music-video-fullscreen";
import {
  exitMusicVideoFullscreen,
  getMusicVideoFullscreen,
  subscribeMusicVideoFullscreen,
  toggleMusicVideoFullscreen,
} from "@/lib/music/video-fullscreen";
import { MusicNowSearch } from "./music-now-search";
import { musicUpcoming } from "./music-queue";
import { CastIcon } from "@/components/player/cast-icon";
import { useT } from "@/lib/i18n";
import { pushBackHandler } from "@/lib/back-intercept";
import {
  useMusicPlayer,
  seekMusic,
  toggleMusicLiked,
  isMusicVideoActive,
} from "@/lib/music/player";
import { loadTrackLyrics, lyricIndexAt, type LyricLine } from "@/lib/music/lyrics";
import {
  LYRIC_OFFSET_STEP,
  getLyricOffset,
  setLyricOffset,
  shiftedLyricTime,
} from "@/lib/music/lyric-offset";
import { karaokeScrollTop } from "@/lib/music/karaoke-scroll";
import { MusicKaraoke } from "./music-karaoke";
import { loadMusicAudioDevices, useMusicAudioSettings } from "@/lib/music/audio-settings";
import { setMusicAppearance, useMusicAppearance } from "@/lib/music/appearance";
import { musicSourceName } from "@/lib/music/recovery";
import type { MusicExploreRequest } from "@/lib/music/navigation";
import { MusicServiceLogo } from "./music-service-logo";
import { MusicQualityBadge } from "./music-quality-badge";
import { MusicSignalDetails, MusicLevelMeter } from "./music-signal-details";
import { useMusicAudioMeter } from "@/lib/music/audio-meter";
import { getMusicSpeakerState } from "@/lib/music/casting";
import { musicTrackQuality } from "@/lib/music/quality";
import "./music-now-playing.css";

export function MusicNowPlaying({
  inset,
  dockRef,
  closing = false,
  onClose,
  onExplore,
  onAudio,
  onSpeakers,
  onSource,
  onQueue,
}: {
  inset: number;
  closing?: boolean;
  dockRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  onExplore: (
    kind: MusicExploreRequest["kind"],
    artist?: MusicArtistRef,
    track?: MusicTrack,
  ) => void;
  onAudio: () => void;
  onSpeakers: () => void;
  onSource: () => void;
  onQueue: () => void;
}) {
  const t = useT();
  const player = useMusicPlayer();
  const appearance = useMusicAppearance();
  const audio = useMusicAudioSettings();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"queue" | "signal" | "about" | "lyrics">("queue");
  const [searching, setSearching] = useState(false);
  const [karaoke, setKaraoke] = useState(false);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [lyricsState, setLyricsState] = useState<"loading" | "ready" | "empty">("loading");
  const lyricsRef = useRef<HTMLOListElement>(null);
  const [outputs, setOutputs] = useState<Array<{ name: string; description: string }>>([]);
  const current = player.current;
  const { profile: recording, display } = useRecordingProfile(current);
  const speaker = getMusicSpeakerState();
  const meter = useMusicAudioMeter(
    current,
    Boolean(
      current &&
      player.phase !== "resolving" &&
      (appearance.levels || panel === "signal") &&
      !isMusicVideoActive() &&
      !speaker.active &&
      current.connectorId !== "spotify",
    ),
  );
  const artMenu = useMusicTrackContextMenu(display, {
    onGoToArtist: () => onExplore("artist"),
    onGoToAlbum: display?.album ? () => onExplore("album") : undefined,
  });
  const video = current?.mediaKind === "video";
  const immersive = video && appearance.immersive;
  const artwork = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  hostRef.current ??= document.createElement("div");
  const host = hostRef.current;
  // One permanent host for the picture. Fullscreen moves this node between the artwork box and
  // the overlay stage instead of re-rendering the surface somewhere else, so the surface instance
  // survives the move and the media elements never reload.
  useLayoutEffect(() => {
    if (!video) return;
    host.style.borderRadius = "inherit";
    const place = () => {
      const parent = getMusicVideoFullscreen().stage ?? artwork.current;
      if (parent && host.parentElement !== parent) parent.appendChild(host);
    };
    place();
    const stop = subscribeMusicVideoFullscreen(place);
    return () => {
      stop();
      host.remove();
    };
  }, [video, host]);
  // Fullscreen belongs to this panel's picture: an audio track or a closed panel ends it, rather
  // than leaving the overlay covering the app with nothing behind it.
  useEffect(() => {
    if (!video) exitMusicVideoFullscreen();
    return exitMusicVideoFullscreen;
  }, [video]);

  useEffect(() => {
    if (!immersive) return;
    const leave = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setMusicAppearance({ immersive: false });
    };
    window.addEventListener("keydown", leave, true);
    return () => window.removeEventListener("keydown", leave, true);
  }, [immersive]);

  useEffect(() => {
    let alive = true;
    void loadMusicAudioDevices()
      .then((value) => {
        if (alive) setOutputs(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    const origin = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const obscured = [...(dock.parentElement?.children ?? [])].filter(
      (node): node is HTMLElement =>
        node instanceof HTMLElement &&
        node !== dock &&
        (node.tagName === "MAIN" ||
          (node.tagName !== "ASIDE" && Boolean(node.querySelector("main")))),
    );
    const wasInert = obscured.map((node) => node.inert);
    obscured.forEach((node) => {
      node.inert = true;
    });
    const raf = requestAnimationFrame(() => closeRef.current?.focus({ preventScroll: true }));
    const removeBack = pushBackHandler(() => {
      onClose();
      return true;
    });
    const keydown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const dialog =
        event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
      if (dialog && dialog !== dock) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
    };
    // Bubble after nested controls so their own Escape handling wins.
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(raf);
      removeBack();
      document.removeEventListener("keydown", keydown);
      obscured.forEach((node, index) => {
        node.inert = wasInert[index];
      });
      if (
        origin?.isConnected &&
        (dock.contains(document.activeElement) || document.activeElement === document.body)
      )
        origin.focus({ preventScroll: true });
    };
  }, [dockRef, onClose]);

  const [lyricOffset, setLyricOffsetState] = useState(0);
  useEffect(() => {
    setLyricOffsetState(getLyricOffset(current));
  }, [current]);
  const nudgeLyrics = useCallback(
    (delta: number) => {
      setLyricOffsetState(setLyricOffset(current, getLyricOffset(current) + delta));
    },
    [current],
  );
  const activeLyric = lyricIndexAt(lyrics, shiftedLyricTime(player.currentTime, lyricOffset));
  useEffect(() => {
    if (panel !== "lyrics" || !current) return;
    let alive = true;
    setLyrics([]);
    setLyricsState("loading");
    const giveUp = window.setTimeout(() => {
      if (alive) setLyricsState((state) => (state === "loading" ? "empty" : state));
    }, 9000);
    void loadTrackLyrics(current).then((lines) => {
      if (!alive) return;
      window.clearTimeout(giveUp);
      setLyrics(lines ?? []);
      setLyricsState(lines && lines.length > 0 ? "ready" : "empty");
    });
    return () => {
      alive = false;
      window.clearTimeout(giveUp);
    };
  }, [panel, current]);
  useEffect(() => {
    if (panel !== "lyrics") return;
    const list = lyricsRef.current;
    if (!list) return;
    const line = activeLyric >= 0 ? list.children.item(activeLyric) : null;
    if (!(line instanceof HTMLElement)) {
      list.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const top = karaokeScrollTop({
      lineTop: line.offsetTop,
      lineHeight: line.clientHeight,
      viewHeight: list.clientHeight,
      maxScroll: list.scrollHeight - list.clientHeight,
      anchor: 0.5,
    });
    list.scrollTo({ top, behavior: calm ? "auto" : "smooth" });
  }, [panel, activeLyric, lyricsState]);

  const next = musicUpcoming(player.queue, player.queueIndex, 40);
  const suggested = useUpNextSuggestions(current, panel === "queue" && next.length === 0);

  if (!current || !display) return null;
  const liked = isMusicLiked(player.likedIds, current);
  const output = speaker.active
    ? speaker.device?.name
    : outputs.find((device) => device.name === audio.settings.device)?.description;
  const upNext = next.length ? next : suggested.tracks;
  const upNextQueue = next.length ? player.queue : [current, ...suggested.tracks];

  return (
    <>
      <div
        data-tauri-drag-region
        className="music-now-window-drag"
        style={{ insetInlineStart: inset }}
        aria-hidden="true"
      />
      <section
        className="music-now-playing"
        data-now-playing
        data-closing={closing ? "1" : undefined}
        data-immersive={immersive ? "1" : undefined}
        style={{ insetInlineStart: inset } as CSSProperties}
        aria-label={t("music.now.title")}
      >
        <header className="music-now-header">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="music-now-back"
            aria-label={t("music.now.collapse")}
          >
            <ArrowDown size={20} aria-hidden="true" />
            <span>{t("music.now.title")}</span>
          </button>
          <div className="music-now-options">
            <button
              type="button"
              aria-pressed={appearance.artworkColors}
              onClick={() => setMusicAppearance({ artworkColors: !appearance.artworkColors })}
              title={t("music.now.colors")}
            >
              <Palette size={17} aria-hidden="true" />
              <span>{t("music.now.colors")}</span>
            </button>
            <button
              type="button"
              aria-pressed={appearance.levels}
              onClick={() => setMusicAppearance({ levels: !appearance.levels })}
              title={t("music.quality.levels")}
            >
              <AudioLines size={17} aria-hidden="true" />
              <span>{t("music.quality.levels")}</span>
            </button>
            <button
              type="button"
              aria-pressed={appearance.dockVisualizer}
              onClick={() => setMusicAppearance({ dockVisualizer: !appearance.dockVisualizer })}
              title={t("music.now.visualizer")}
            >
              <BarChart3 size={17} aria-hidden="true" />
              <span>{t("music.now.visualizer")}</span>
            </button>
            {video && (
              <button
                type="button"
                aria-pressed={appearance.immersive}
                onClick={() => setMusicAppearance({ immersive: !appearance.immersive })}
                title={t("Immersive")}
              >
                <Wallpaper size={17} aria-hidden="true" />
                <span>{t("Immersive")}</span>
              </button>
            )}
            <button
              type="button"
              aria-pressed={karaoke}
              onClick={() => setKaraoke((open) => !open)}
              title={t("Karaoke")}
            >
              <Mic2 size={17} aria-hidden="true" />
              <span>{t("Karaoke")}</span>
            </button>
          </div>
        </header>
        <div className="music-now-layout">
          {artMenu.menu}
          <div className="music-now-art-column">
            <div
              ref={artwork}
              className="music-now-artwork"
              style={video && !immersive ? { aspectRatio: "16 / 9" } : undefined}
              onContextMenu={artMenu.onContextMenu}
            >
              {video ? (
                createPortal(<MusicVideoSurface track={current} expanded />, host)
              ) : (
                <Poster
                  src={display.artwork}
                  seed={`track:${current.connectorId}:${current.id}`}
                  ratio="square"
                  className="w-full [--poster-radius:0px]"
                />
              )}
            </div>
            {video && <MusicVideoFullscreen track={current} />}
            {appearance.levels && current.mediaKind !== "video" && (
              <div className="music-now-levels" data-now-levels>
                <MusicLevelMeter meter={meter} />
              </div>
            )}
          </div>
          <div className="music-now-content">
            <button type="button" onClick={onSource} className="music-now-source">
              <MusicServiceLogo source={current.connectorId ?? ""} itemId={current.id} size={22} />
              <span>{musicSourceName(current)}</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </button>
            <h1>{display.title}</h1>
            <div className="music-now-artist">
              <MusicArtistLink
                name={
                  artistCreditParts(current.artist).length > 1 ? current.artist : display.artist
                }
                track={current}
                onArtist={(name) => onExplore("artist", undefined, { ...display, artist: name })}
              />
              <ArrowUpRight size={18} aria-hidden="true" />
            </div>
            {display.album && (
              <button type="button" className="music-now-album" onClick={() => onExplore("album")}>
                {display.album}
                <ArrowUpRight size={14} aria-hidden="true" />
              </button>
            )}
            <div className="music-now-actions">
              <MusicDownloadButton track={current} className="music-now-video" />
              <button type="button" onClick={() => onExplore("videos")} className="music-now-video">
                <Video size={19} aria-hidden="true" />
                {t("music.now.videos")}
              </button>
              {video && (
                <button
                  type="button"
                  onClick={toggleMusicVideoFullscreen}
                  className="music-now-video"
                  title={t("Fullscreen")}
                >
                  <Maximize size={19} aria-hidden="true" />
                  {t("Fullscreen")}
                </button>
              )}
              <button
                type="button"
                onClick={() => toggleMusicLiked(current)}
                aria-pressed={liked}
                aria-label={t(liked ? "music.unsaveTrack" : "music.saveTrack")}
                className="music-now-save"
              >
                <Heart size={20} fill={liked ? "currentColor" : "none"} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setPanel("signal")}
                className="music-now-quality"
                aria-label={t("music.now.signal")}
              >
                {!isMusicVideoActive() && musicTrackQuality(current) ? (
                  <MusicQualityBadge track={current} showEvidence />
                ) : (
                  <>
                    <AudioLines size={17} />
                    <span>{t("music.now.signal")}</span>
                  </>
                )}
              </button>
            </div>
            <div className="music-now-tabs" role="tablist" aria-label={t("music.now.details")}>
              {(["queue", "about", "lyrics", "signal"] as const).map((id, index, ids) => (
                <button
                  key={id}
                  type="button"
                  id={`music-now-tab-${id}`}
                  role="tab"
                  aria-selected={panel === id}
                  aria-controls={searching ? undefined : `music-now-panel-${id}`}
                  tabIndex={panel === id ? 0 : -1}
                  onClick={() => {
                    setSearching(false);
                    setPanel(id);
                  }}
                  onKeyDown={(event) => {
                    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
                    const step =
                      event.key === "ArrowRight"
                        ? rtl
                          ? -1
                          : 1
                        : event.key === "ArrowLeft"
                          ? rtl
                            ? 1
                            : -1
                          : 0;
                    const target =
                      event.key === "Home"
                        ? ids[0]
                        : event.key === "End"
                          ? ids.at(-1)!
                          : step
                            ? ids[(index + step + ids.length) % ids.length]
                            : null;
                    if (target) {
                      event.preventDefault();
                      setSearching(false);
                      setPanel(target);
                      document.getElementById(`music-now-tab-${target}`)?.focus();
                    }
                  }}
                >
                  {t(
                    id === "queue"
                      ? "music.now.next"
                      : id === "about"
                        ? "music.artist.about"
                        : id === "lyrics"
                          ? "Lyrics"
                          : "music.now.signal",
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSearching(true)}
                className="music-now-all-queue"
                aria-pressed={searching}
                aria-label={t("music.searchPlaceholder")}
                title={t("music.searchPlaceholder")}
              >
                <Search size={17} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onQueue}
                className="music-now-all-queue"
                aria-label={t("music.transport.openQueue")}
              >
                <ListMusic size={17} aria-hidden="true" />
              </button>
            </div>

            {searching ? (
              <div className="music-now-search-slot">
                <MusicNowSearch onClose={() => setSearching(false)} />
              </div>
            ) : (
              <div
                role="tabpanel"
                id={`music-now-panel-${panel}`}
                aria-labelledby={`music-now-tab-${panel}`}
                className="music-now-panel"
              >
                {panel === "about" ? (
                  <MusicListeningDetails
                    track={display}
                    profile={recording}
                    onArtist={(artist) => onExplore("artist", artist)}
                  />
                ) : panel === "lyrics" ? (
                  lyricsState === "ready" ? (
                    <>
                      <div className="music-now-lyric-sync">
                        <span>{t("Lyric sync")}</span>
                        <button
                          type="button"
                          onClick={() => nudgeLyrics(-LYRIC_OFFSET_STEP)}
                          aria-label={t("Lyrics earlier")}
                          title={t("Lyrics earlier")}
                        >
                          -
                        </button>
                        <em>
                          {lyricOffset === 0
                            ? "0.00s"
                            : `${lyricOffset > 0 ? "+" : ""}${lyricOffset.toFixed(2)}s`}
                        </em>
                        <button
                          type="button"
                          onClick={() => nudgeLyrics(LYRIC_OFFSET_STEP)}
                          aria-label={t("Lyrics later")}
                          title={t("Lyrics later")}
                        >
                          +
                        </button>
                      </div>
                      <ol ref={lyricsRef} className="music-now-lyrics">
                        {lyrics.map((line, index) => (
                          <li
                            key={`${line.at}:${index}`}
                            data-active={index === activeLyric ? "1" : undefined}
                          >
                            {line.text ? (
                              <button type="button" onClick={() => seekMusic(line.at)}>
                                {line.text}
                              </button>
                            ) : (
                              <span className="music-now-lyric-rest" aria-hidden="true" />
                            )}
                          </li>
                        ))}
                      </ol>
                    </>
                  ) : (
                    <div className="music-now-empty">
                      <Mic2 size={23} aria-hidden="true" />
                      <p>
                        {t(
                          lyricsState === "loading" ? "Finding lyrics" : "No lyrics for this track",
                        )}
                      </p>
                    </div>
                  )
                ) : panel === "signal" ? (
                  <MusicSignalDetails
                    track={
                      isMusicVideoActive()
                        ? {
                            ...current,
                            quality: undefined,
                            sourceId: undefined,
                            playbackUrl: undefined,
                          }
                        : current
                    }
                    outputLabel={output}
                    transportCodec={speaker.active ? speaker.transportCodec : undefined}
                    audioSettings={speaker.active ? undefined : audio.settings}
                    meter={speaker.active ? undefined : meter}
                    showLevels={false}
                  />
                ) : (
                  <>
                    {upNext.length ? (
                      <ol className="music-now-next-list">
                        {upNext.map((track, index) => (
                          <MusicUpNextRow
                            key={`${track.connectorId}:${track.id}:${index}`}
                            track={track}
                            queue={upNextQueue}
                            onArtist={() => onExplore("artist", undefined, track)}
                          />
                        ))}
                      </ol>
                    ) : (
                      <div className="music-now-empty">
                        <ListMusic size={23} aria-hidden="true" />
                        <p>{suggested.loading ? t("music.now.queueBuilding") : t("music.now.queueEmpty")}</p>
                        <button type="button" onClick={() => onExplore("artist")}>
                          {t("music.now.exploreArtist")}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
            <div className="music-now-output">
              <button type="button" onClick={onSpeakers}>
                {speaker.active && speaker.device ? (
                  <span className="music-dock-device size-7">
                    <CastIcon device={speaker.device} size={28} />
                  </span>
                ) : (
                  <Speaker size={17} aria-hidden="true" />
                )}
                <span>{output ?? t("music.now.output")}</span>
              </button>
              <button type="button" onClick={onAudio}>
                <SlidersHorizontal size={17} aria-hidden="true" />
                {t("music.audio.title")}
              </button>
            </div>
          </div>
        </div>
        <MusicKaraoke open={karaoke} onClose={() => setKaraoke(false)} />
      </section>
    </>
  );
}
