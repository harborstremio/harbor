import { getMusicSourceCandidates, musicPlaybackSource } from "@/lib/music/sources";
import { replaceQueueTrack, selectableSources } from "@/lib/music/queue-source";
import { MusicTrackLabels } from "./music-track-labels";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  GripVertical,
  ListStart,
  MoreHorizontal,
  Pause,
  Play,
  Trash2,
  Volume2,
  X,
} from "@/components/icons/music-icons";
import { Poster } from "@/components/poster";
import { MusicTrackPlaybackMark } from "./music-now-playing-mark";
import { MusicServiceLogo } from "./music-service-logo";
import "./music-queue.css";
import { useT } from "@/lib/i18n";
import {
  playMusic,
  setMusicQueue,
  toggleMusicPlayback,
  useMusicPlayer,
} from "@/lib/music/player";
import { musicPriorityNext, setMusicPriorityNext, useMusicTransport } from "@/lib/music/transport";
import type { MusicSourceCandidate, MusicTrack } from "@/lib/music/types";

export {
  cycleMusicRepeat,
  musicUpcoming,
  toggleMusicShuffle,
  useMusicTransport,
  type MusicRepeatMode,
  type MusicTransport,
} from "@/lib/music/transport";

function QueueTrack({
  track,
  index,
  current,
  playing,
  draggable,
  onPlay,
  onArtist,
  onMove,
  onNext,
  onRemove,
  onSource,
  canUp,
  canDown,
  onDragStart,
  onDrop,
  onDragEnd,
  dragging,
}: {
  track: MusicTrack;
  index: number;
  current?: boolean;
  playing?: boolean;
  draggable?: boolean;
  onPlay: () => void;
  onArtist: () => void;
  onMove: (direction: number) => void;
  onNext: () => void;
  onRemove: () => void;
  onSource: (candidate: MusicSourceCandidate) => void;
  canUp: boolean;
  canDown: boolean;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
  dragging: boolean;
}) {
  const t = useT();
  const [actions, setActions] = useState(false);
  const [sources, setSources] = useState<MusicSourceCandidate[] | null>(null);
  const [loadingSources, setLoadingSources] = useState(false);
  const more = useRef<HTMLButtonElement>(null);
  const showSources = () => {
    if (sources || loadingSources) {
      setSources((value) => (value ? null : value));
      return;
    }
    setLoadingSources(true);
    void getMusicSourceCandidates(track)
      .then((found) => setSources(selectableSources(found, track)))
      .catch(() => setSources([]))
      .finally(() => setLoadingSources(false));
  };
  const run = (action: () => void) => {
    action();
    setActions(false);
    requestAnimationFrame(() =>
      (more.current ?? document.getElementById("music-queue-title"))?.focus({
        preventScroll: true,
      }),
    );
  };
  return (
    <li
      className="music-queue-track"
      data-dragging={dragging || undefined}
      aria-current={current || undefined}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={(event) => {
        if (draggable) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={onDrop}
    >
      <div className="music-queue-track-main">
        <span
          className="music-queue-order"
          title={draggable ? t("music.queue.reorder", { title: track.title }) : undefined}
        >
          {current ? (
            <Volume2 size={16} aria-hidden />
          ) : (
            <>
              <span>{String(index + 1).padStart(2, "0")}</span>
              {draggable && <GripVertical size={15} aria-hidden />}
            </>
          )}
        </span>
        <div className="music-queue-play">
          <button
            type="button"
            onClick={onPlay}
            aria-label={
              current
                ? t(playing ? "music.pause" : "music.play")
                : t("music.playTrack", { title: track.title, artist: track.artist })
            }
            className="music-queue-cover"
          >
            <Poster
              src={track.artwork}
              seed={`track:${track.connectorId ?? ""}:${track.sourceId ?? track.id}`}
              ratio="square"
              className="w-full [--poster-radius:4px]"
            ><MusicTrackPlaybackMark track={track}/></Poster>
            <span className="music-queue-cover-play" aria-hidden>
              {playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </span>
          </button>
          <span className="music-queue-track-copy">
            <button type="button" className="truncate text-start" onClick={onPlay}>
              <strong title={track.title}>{track.title}</strong>
            </button>
            <span className="flex items-center gap-1">
              <MusicTrackLabels track={track} />
            </span>
            <button
              type="button"
              className="truncate text-start text-xs text-ink-muted hover:text-ink hover:underline"
              onClick={onArtist}
            >
              {track.artist}
            </button>
          </span>
        </div>
        <span className="music-queue-track-meta">
          <MusicServiceLogo source={musicPlaybackSource(track.connectorId)} size={16} />
          {track.durationSeconds > 0 && <span>{track.durationLabel}</span>}
        </span>
        {!current && (
          <button
            ref={more}
            type="button"
            className="music-queue-icon"
            aria-expanded={actions}
            aria-label={t("music.card.moreActions", { title: track.title })}
            onClick={() => setActions((value) => !value)}
          >
            <MoreHorizontal size={19} aria-hidden />
          </button>
        )}
      </div>
      {actions && (
        <div
          className="music-queue-actions"
          role="group"
          aria-label={t("music.card.moreActions", { title: track.title })}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setActions(false);
              more.current?.focus();
            }
          }}
        >
          <button type="button" onClick={() => run(onNext)}>
            <ListStart size={17} aria-hidden />
            {t("music.queue.playNext")}
          </button>
          <button
            type="button"
            disabled={!canUp}
            onClick={() => run(() => onMove(-1))}
            aria-label={t("music.queue.moveUp", { title: track.title })}
            title={t("music.queue.moveUp", { title: track.title })}
          >
            <ChevronUp size={18} aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canDown}
            onClick={() => run(() => onMove(1))}
            aria-label={t("music.queue.moveDown", { title: track.title })}
            title={t("music.queue.moveDown", { title: track.title })}
          >
            <ChevronDown size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={t("music.queue.remove", { title: track.title })}
            title={t("music.queue.remove", { title: track.title })}
          >
            <Trash2 size={17} aria-hidden />
          </button>
          <button
            type="button"
            aria-expanded={!!sources}
            onClick={showSources}
            aria-label={t("music.source.another")}
            title={t("music.source.another")}
          >
            <MusicServiceLogo source={musicPlaybackSource(track.connectorId)} size={17} />
          </button>
        </div>
      )}
      {actions && (loadingSources || sources) && (
        <div className="music-queue-sources" role="group" aria-label={t("music.source.another")}>
          {loadingSources && <span className="music-queue-sources-note">{t("music.loading")}</span>}
          {!loadingSources && sources?.length === 0 && (
            <span className="music-queue-sources-note">{t("music.source.none")}</span>
          )}
          {!loadingSources &&
            sources?.map((candidate) => (
              <button
                key={`${candidate.connectorId}:${candidate.track.id}`}
                type="button"
                onClick={() => run(() => onSource(candidate))}
              >
                <MusicServiceLogo
                  source={candidate.connectorId}
                  itemId={candidate.track.id}
                  size={16}
                />
                <span className="truncate">{candidate.connectorName}</span>
              </button>
            ))}
        </div>
      )}
    </li>
  );
}

export function MusicQueue({
  open,
  onClose,
  onArtist,
}: {
  open: boolean;
  onClose: () => void;
  onArtist?: (track: MusicTrack) => void;
}) {
  const t = useT();
  const player = useMusicPlayer();
  const { shuffle } = useMusicTransport();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    heading.current?.focus({ preventScroll: true });
    const close = () => closeRef.current();
    const onDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !target?.isConnected ||
        target.closest("[data-music-queue]") ||
        target.closest("[data-music-dock]")
      )
        return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "Escape") return;
      event.stopImmediatePropagation();
      close();
    };
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey);
      if (
        panel.current?.contains(document.activeElement) ||
        document.activeElement === document.body
      )
        if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  const queue = player.queue;
  const playingAt = player.queueIndex;
  const firstUpcoming = Math.max(0, playingAt + 1);
  const upcoming = queue.slice(firstUpcoming);
  const history = playingAt > 0 ? queue.slice(0, playingAt) : [];
  const move = (from: number, to: number) => {
    if (from === to || from < firstUpcoming || to < firstUpcoming || to >= queue.length) return;
    const next = [...queue];
    const [track] = next.splice(from, 1);
    if (!track) return;
    next.splice(to, 0, track);
    setMusicQueue(next);
  };
  const playNext = (index: number) => {
    if (index === playingAt) return;
    const track = queue[index];
    if (!track) return;
    const next = queue.filter((_, at) => at !== index);
    const currentIndex = playingAt >= 0 ? playingAt - Number(index < playingAt) : -1;
    setMusicPriorityNext(track);
    next.splice(currentIndex + 1, 0, track);
    setMusicQueue(next);
  };
  const remove = (index: number) => {
    setMusicQueue(queue.filter((_, at) => at !== index));
    heading.current?.focus({ preventScroll: true });
  };
  const row = (track: MusicTrack, index: number, current = false) => (
    <QueueTrack
      key={`${track.connectorId ?? ""}:${track.id}`}
      track={track}
      index={index >= firstUpcoming ? index - firstUpcoming : index}
      current={current}
      playing={current && player.phase === "playing"}
      draggable={!current && index >= firstUpcoming}
      dragging={dragIndex === index}
      onPlay={
        current
          ? toggleMusicPlayback
          : () => void playMusic(track, queue.length ? queue : [track]).catch(() => {})
      }
      onArtist={() => {
        onClose();
        onArtist?.(track);
      }}
      onMove={(direction) => move(index, index + direction)}
      onNext={() => playNext(index)}
      onRemove={() => remove(index)}
      onSource={(candidate) => setMusicQueue(replaceQueueTrack(queue, index, candidate.track))}
      canUp={index > firstUpcoming}
      canDown={index >= firstUpcoming && index < queue.length - 1}
      onDragStart={(event) => {
        setDragIndex(index);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      }}
      onDrop={(event) => {
        event.preventDefault();
        if (dragIndex !== null) move(dragIndex, index);
        setDragIndex(null);
      }}
      onDragEnd={() => setDragIndex(null)}
    />
  );

  return createPortal(
    <div
      ref={panel}
      data-music-queue
      role="dialog"
      aria-labelledby="music-queue-title"
      className="music-queue-panel"
    >
      <header className="music-queue-header">
        <div>
          <h2 ref={heading} tabIndex={-1} id="music-queue-title">
            {t("music.transport.queue")}
          </h2>
          <p>{t("music.queue.count", { count: upcoming.length })}</p>
        </div>
        <button
          type="button"
          className="music-queue-icon"
          onClick={onClose}
          aria-label={t("music.queue.close")}
        >
          <X size={20} aria-hidden />
        </button>
      </header>
      <div className="music-queue-scroll">
        {player.current && (
          <section className="music-queue-current">
            <h3>{t("music.queue.nowPlaying")}</h3>
            <ol>{row(player.current, playingAt, true)}</ol>
          </section>
        )}
        <section className="music-queue-upcoming">
          <div className="music-queue-section-head">
            <h3>{t("music.row.upNext")}</h3>
            <button
              type="button"
              disabled={!upcoming.length}
              onClick={() => {
                setMusicPriorityNext(null);
                setMusicQueue(playingAt >= 0 ? queue.slice(0, playingAt + 1) : []);
              }}
            >
              {t("music.transport.clearQueue")}
            </button>
          </div>
          {shuffle && !musicPriorityNext() && (
            <p className="music-queue-note">{t("music.queue.shuffleNote")}</p>
          )}
          {upcoming.length ? (
            <>
              <p className="music-queue-note">{t("music.queue.dragHint")}</p>
              <ol>{upcoming.map((track, at) => row(track, firstUpcoming + at))}</ol>
            </>
          ) : (
            <p className="music-queue-empty">{t("music.queue.empty")}</p>
          )}
        </section>
        {history.length > 0 && (
          <details className="music-queue-history">
            <summary>
              {t("music.queue.previous")}
              <span>{history.length}</span>
            </summary>
            <ol>{history.map((track, index) => row(track, index))}</ol>
          </details>
        )}
      </div>
    </div>,
    document.body,
  );
}
