import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ExternalLink, Heart, Play, RotateCcw, VideoOff } from "@/components/icons/music-icons";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { MusicArtistLink } from "./music-artist-link";
import { MusicWhereToBuy } from "./music-artist-overview";
import { openUrl } from "@/lib/window";
import { MusicAddToPlaylist } from "@/components/music/music-add-to-playlist";
import { MusicMediaBadge } from "./music-media-badge";
import { musicUpcoming, useMusicTransport } from "./music-queue";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { appendMusicVideos, searchMusicVideoPage } from "@/lib/music/video-pages";
import { searchTrackKey } from "@/lib/music/now-search";
import { prefetchMusicVideoStreams } from "@/lib/music/video";
import {
  getMusicState,
  playMusic,
  returnMusicToComputer,
  toggleMusicLiked,
  useMusicPlayer,
  waitForMusicAudioReady,
} from "@/lib/music/player";
import { getMusicSpeakerState } from "@/lib/music/casting";
import type { MusicTrack } from "@/lib/music/types";
import { MusicVideoSurface } from "./music-video-surface";
import { MusicVideoFullscreen } from "./music-video-fullscreen";
import {
  getMusicVideoFullscreen,
  subscribeMusicVideoFullscreen,
} from "@/lib/music/video-fullscreen";
import "./music-watch.css";

/**
 * Neither the native load nor the audio-ready gate is bounded, and the surface cannot offer its
 * own way out before this resolves because it is not registered yet, so the stage bounds them.
 */
const PREPARE_MS = 20_000;

export function MusicWatch({
  track,
  queue,
  onClose,
  onVideoShowing,
  active = true,
}: {
  track: MusicTrack;
  queue: MusicTrack[];
  onClose: () => void;
  onVideoShowing?: (showing: boolean) => void;
  active?: boolean;
}) {
  const t = useT();
  const player = useMusicPlayer();
  useMusicTransport();
  const [preparationError, setPreparationError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [similar, setSimilar] = useState<MusicTrack[]>([]);
  const [similarBusy, setSimilarBusy] = useState(true);
  const [similarNext, setSimilarNext] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false), [moreError, setMoreError] = useState(false);
  const similarGeneration = useRef(0), moreLoading = useRef(false), moreButton = useRef<HTMLButtonElement>(null);
  const seenPages = useRef(new Set<string>());
  const [readySelection, setReadySelection] = useState("");
  const [videoShowing, setVideoShowing] = useState(false);
  const replay = useRef(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  hostRef.current ??= document.createElement("div");
  const host = hostRef.current;
  const selection = `${track.connectorId ?? ""}:${track.id}`;
  const showVideo = useCallback(
    (next: boolean) => {
      setVideoShowing(next);
      onVideoShowing?.(next);
    },
    [onVideoShowing],
  );
  // The surface keeps one home in the page. Fullscreen moves that home into the overlay rather
  // than rendering the surface somewhere else, so the instance, its controls and its lyrics survive.
  useLayoutEffect(() => {
    host.style.cssText = "position:absolute;inset:0;border-radius:inherit";
    const place = () => {
      const parent = getMusicVideoFullscreen().stage ?? stageRef.current;
      if (parent && host.parentElement !== parent) parent.appendChild(host);
    };
    place();
    const stop = subscribeMusicVideoFullscreen(place);
    return () => {
      stop();
      host.remove();
    };
  }, [host]);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setReadySelection("");
    setPreparationError(false);
    const current = getMusicState();
    // An explicit retry loads the track again rather than taking the already-current fast path,
    // which would hand the surface back the same state that just failed.
    const forced = replay.current;
    replay.current = false;
    // A video tile is an exact provider selection. Start that identity before
    // transferring controls; an unrelated song already playing must not win.
    const prepare = async () => {
      if (
        forced ||
        current.current?.id !== track.id ||
        current.current.connectorId !== track.connectorId ||
        current.current.mediaKind !== "video" ||
        current.phase === "error"
      )
        await playMusic(
          { ...track, mediaKind: "video" },
          (queue.length ? queue : [track]).map((item) => ({ ...item, mediaKind: "video" })),
        );
      else await waitForMusicAudioReady(track);
      if (cancelled) return;
      if (getMusicSpeakerState().active) await returnMusicToComputer();
    };
    // Surfaced rather than abandoned: a load that answers late still clears the message itself.
    const stuck = setTimeout(() => {
      if (!cancelled) setPreparationError(true);
    }, PREPARE_MS);
    void prepare()
      .then(() => {
        if (!cancelled) {
          setPreparationError(false);
          setReadySelection(selection);
        }
      })
      .catch(() => {
        if (!cancelled) setPreparationError(true);
      })
      .finally(() => clearTimeout(stuck));
    return () => {
      cancelled = true;
      clearTimeout(stuck);
    };
  }, [selection, active, retry]);

  const playing = readySelection === selection ? (player.current ?? track) : track;
  const playingId = playing.id;

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const generation = ++similarGeneration.current;
    moreLoading.current = false; seenPages.current.clear();
    setSimilarNext(null); setMoreBusy(false); setMoreError(false);
    setSimilarBusy(true);
    searchMusicVideoPage(`${playing.artist} music videos`, false)
      .then(({ tracks, next: cursor }) => {
        if (cancelled) return;
        const next = tracks.filter((item) => item.id !== playingId);
        setSimilar(next); setSimilarNext(cursor);
        // Warmed against the same predicate the surface resolves by, because video.ts cannot
        // import it back from video-session without a cycle.
        prefetchMusicVideoStreams(
          next.filter(
            (item) =>
              item.mediaKind === "video" && !!item.connectorId && item.connectorId !== "catalog",
          ),
        );
      })
      .catch(() => {
        if (!cancelled) setSimilar([]);
      })
      .finally(() => {
        if (!cancelled) setSimilarBusy(false);
      });
    return () => {
      cancelled = true;
      if (similarGeneration.current === generation) similarGeneration.current++;
    };
  }, [playingId, playing.artist, active]);

  const loadMoreVideos = useCallback(async () => {
    if (!active || !similarNext || moreLoading.current) return;
    const generation = similarGeneration.current, cursor = similarNext;
    moreLoading.current = true; setMoreBusy(true); setMoreError(false);
    try {
      const page = await searchMusicVideoPage(`${playing.artist} music videos`, false, cursor);
      if (similarGeneration.current !== generation) return;
      seenPages.current.add(cursor);
      setSimilar(previous => appendMusicVideos(previous, page.tracks.filter(item => item.id !== playingId)));
      setSimilarNext(page.next && !seenPages.current.has(page.next) ? page.next : null);
    } catch { if (similarGeneration.current === generation) setMoreError(true); }
    finally { if (similarGeneration.current === generation) { moreLoading.current = false; setMoreBusy(false); } }
  }, [active, similarNext, playing.artist, playingId]);
  useEffect(() => {
    const button = moreButton.current;
    if (!button || similarBusy || moreBusy || moreError || !active) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) void loadMoreVideos(); }, { rootMargin: "160px" });
    observer.observe(button);
    return () => observer.disconnect();
  }, [active, similarBusy, moreBusy, moreError, loadMoreVideos]);

  const liked = player.likedIds.includes(playingId);
  const queueUpNext = musicUpcoming(player.queue, player.queueIndex, 1)[0] ?? null;
  const related = queueUpNext
    ? similar.filter((item) => searchTrackKey(item) !== searchTrackKey(queueUpNext))
    : similar;
  const upNext = related.slice(0, 4);
  const moreVideos = related.slice(4);
  const replayTrack = () => {
    replay.current = true;
    setRetry((value) => value + 1);
  };

  return (
    <>
      <section className="relative z-10 flex flex-col gap-6 lg:flex-row">
        <div className="min-w-0 flex-1">
          <button
            type="button"
            data-music-inner-back
            onClick={onClose}
            className="mb-3 inline-flex items-center gap-1 text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t("music.watch.back")}
          </button>

          <div ref={stageRef} className="music-watch-stage">
            {preparationError ? (
              <div className="music-watch-stage-error" role="alert">
                <VideoOff className="size-6 text-ink-subtle" aria-hidden />
                <p>{t("music.videos.playbackError")}</p>
                <button
                  type="button"
                  data-music-watch-retry
                  className="music-watch-retry"
                  onClick={replayTrack}
                >
                  <RotateCcw className="size-4" aria-hidden />
                  {t("common.retry")}
                </button>
              </div>
            ) : (
              <>
                <div className="music-watch-stage-poster" aria-hidden>
                  <Poster
                    src={playing.artwork}
                    seed={playing.id}
                    ratio="landscape"
                    className="h-full w-full"
                  />
                </div>
                {createPortal(
                  <MusicVideoSurface
                    track={playing}
                    active={active && readySelection === selection && playing.mediaKind === "video"}
                    onShowing={showVideo}
                  />,
                  host,
                )}
              </>
            )}
          </div>
          {videoShowing && <MusicVideoFullscreen />}

          <h2 className="mt-4 text-[22px] font-medium leading-tight text-ink">{playing.title}</h2>
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <MusicArtistLink
              name={playing.artist}
              track={playing}
              className="text-[14px] text-ink-muted"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  void openUrl(
                    playing.connectorId === "youtube" && /^[\w-]{11}$/.test(playing.sourceId ?? "")
                      ? `https://www.youtube.com/watch?v=${playing.sourceId}`
                      : `https://www.youtube.com/results?search_query=${encodeURIComponent(`${playing.artist} ${playing.title} music video`)}`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-md bg-elevated px-3 py-2 text-[13px] text-ink hover:bg-raised"
              >
                <MusicServiceLogo source="youtube" size={18} />
                YouTube
                <ExternalLink className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => toggleMusicLiked(playing)}
                aria-pressed={liked}
                aria-label={liked ? t("music.unsaveTrack") : t("music.saveTrack")}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[13px] text-ink-muted ring-1 ring-white/10 transition-colors hover:text-ink"
              >
                <Heart className="size-4" fill={liked ? "currentColor" : "none"} aria-hidden />
              </button>
              <MusicAddToPlaylist track={playing} />
            </div>
          </div>
        </div>

        <aside className="music-watch-next">
          {queueUpNext && (
            <div className="music-watch-up-next">
              <h3 className="music-watch-next-heading">{t("music.row.upNext")}</h3>
              <VideoNext item={queueUpNext} queue={player.queue} badge />
            </div>
          )}
          <Rail title={t("music.videos.next")} tracks={upNext} queue={related} busy={similarBusy} />
        </aside>
      </section>
      <div className="relative z-10 mt-5">
        <MusicWhereToBuy item={{ ...playing, kind: "track" }} />
      </div>
      {(similarBusy || moreVideos.length > 0 || similarNext) && (
        <section className="music-watch-more relative z-10">
          <h3>{t("music.videos.more")}</h3>
          {similarBusy ? (
            <div role="status" aria-label={t("common.loading")}>
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <VideoNextSkeleton key={index} stacked />
              ))}
            </div>
          ) : (
            <div>
              {moreVideos.map((item) => (
                <VideoNext key={item.id} item={item} queue={related} />
              ))}
            </div>
          )}
          {moreError && <p role="alert" className="text-sm text-ink-muted">{t("music.videos.error")}</p>}
          {similarNext && <button ref={moreButton} type="button" className="music-watch-retry" disabled={moreBusy} onClick={() => { void loadMoreVideos(); }}>
            {t(moreError ? "common.retry" : moreBusy ? "common.loading" : "music.library.loadMore")}
          </button>}
        </section>
      )}
    </>
  );
}

function Rail({
  title,
  tracks,
  queue,
  busy,
}: {
  title: string;
  tracks: MusicTrack[];
  queue: MusicTrack[];
  busy: boolean;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <h3 className="music-watch-next-heading">{title}</h3>
      {busy && (
        <ul className="music-watch-next-list" role="status" aria-label={t("common.loading")}>
          {[0, 1, 2, 3].map((index) => (
            <li key={index}>
              <VideoNextSkeleton />
            </li>
          ))}
        </ul>
      )}
      {!busy && tracks.length === 0 && (
        <span className="py-2 text-[13px] text-ink-muted">{t("music.videos.empty")}</span>
      )}
      {!busy && tracks.length > 0 && (
        <ul className="music-watch-next-list">
          {tracks.map((item) => (
            <li key={item.id}>
              <VideoNext item={item} queue={queue} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function VideoNextSkeleton({ stacked = false }: { stacked?: boolean }) {
  return (
    <div
      className={`music-watch-video-next music-watch-next-skeleton${stacked ? " music-watch-next-skeleton-stacked" : ""}`}
      aria-hidden
    >
      <span className="music-watch-next-art" />
      <span className="music-watch-next-label">
        <span />
        <span />
      </span>
    </div>
  );
}

function VideoNext({
  item,
  queue,
  badge = false,
}: {
  item: MusicTrack;
  queue: MusicTrack[];
  badge?: boolean;
}) {
  const t = useT();
  const play = () =>
    void playMusic(
      { ...item, mediaKind: "video" },
      (queue.length ? queue : [item]).map((track) => ({ ...track, mediaKind: "video" })),
    ).catch(() => {});
  return (
    <div className="music-watch-video-next">
      <button
        type="button"
        className="music-watch-next-art"
        aria-label={t("music.videos.watch", { title: item.title })}
        onClick={play}
      >
        <Poster
          src={item.artwork}
          seed={item.id}
          ratio="landscape"
          className="h-full w-full"
          lazy
        />
        <Play size={18} fill="currentColor" aria-hidden />
        {item.durationLabel && <small>{item.durationLabel}</small>}
      </button>
      <span className="music-watch-next-label">
        <button type="button" className="text-start" onClick={play}>
          <strong>{item.title}</strong>
        </button>
        <span className="flex min-w-0 items-center gap-2">
          <MusicArtistLink
            name={item.artist}
            track={item}
            className="truncate text-xs text-ink-muted"
          />
          {badge && <MusicMediaBadge kind={item.mediaKind} compact />}
        </span>
      </span>
    </div>
  );
}
