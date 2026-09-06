import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, RotateCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadEBookListeningProgress,
  saveEBookListeningProgress,
} from "@/lib/ebook/audiobook-state";
import {
  sourceEBookAudiobookStream,
  type EBookAudioChapter,
} from "@/lib/ebook/providers";

const time = (seconds: number) => {
  if (!Number.isFinite(seconds)) return "0:00";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, "0")}`;
};

export function EBookAudiobookPlayer({
  profile,
  bookId,
  bookTitle,
  cover,
  sourceRoute,
  chapters,
  initialChapter,
  onClose,
}: {
  profile: string;
  bookId: string;
  bookTitle: string;
  cover?: string;
  sourceRoute: string;
  chapters: EBookAudioChapter[];
  initialChapter: EBookAudioChapter;
  onClose: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedRef = useRef(0);
  const [chapter, setChapter] = useState(initialChapter);
  const [src, setSrc] = useState<string>();
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(initialChapter.duration ?? 0);
  const [rate, setRate] = useState(1);
  const [error, setError] = useState<string>();
  const boundsRef = useRef({ start: 0, end: Number.POSITIVE_INFINITY });

  useEffect(() => {
    let active = true;
    setSrc(undefined);
    setError(undefined);
    void sourceEBookAudiobookStream(sourceRoute, chapter.id)
      .then((stream) => {
        if (!active) return;
        if (!stream) throw new Error("Audio is unavailable");
        boundsRef.current = {
          start: stream.start ?? 0,
          end: stream.end ?? Number.POSITIVE_INFINITY,
        };
        setDuration(stream.duration ?? chapter.duration ?? 0);
        setSrc(stream.url);
      })
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "Audio is unavailable"));
    return () => { active = false; };
  }, [chapter, sourceRoute]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    const saved = loadEBookListeningProgress(profile, bookId);
    audio.currentTime = boundsRef.current.start + (saved?.chapterId === chapter.id ? saved.seconds : 0);
    void audio.play().catch(() => setPlaying(false));
  }, [bookId, chapter.id, profile, src]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = rate;
  }, [rate]);

  const persist = useCallback(() => {
    const audio = audioRef.current;
    if (audio)
      saveEBookListeningProgress(
        profile,
        bookId,
        chapter.id,
        Math.max(0, audio.currentTime - boundsRef.current.start),
      );
  }, [bookId, chapter.id, profile]);

  useEffect(() => {
    window.addEventListener("pagehide", persist);
    return () => {
      persist();
      window.removeEventListener("pagehide", persist);
    };
  }, [persist]);

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (audio)
      audio.currentTime =
        boundsRef.current.start + Math.max(0, Math.min(duration || audio.duration, seconds));
  };
  const index = chapters.findIndex((item) => item.id === chapter.id);

  return (
    <div className="fixed inset-x-8 bottom-6 z-[120] mx-auto max-w-5xl rounded-2xl border border-edge bg-surface/95 p-4 shadow-2xl backdrop-blur-xl">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const absolute = event.currentTarget.currentTime;
          const seconds = Math.max(0, absolute - boundsRef.current.start);
          setPosition(seconds);
          if (Math.abs(seconds - lastSavedRef.current) >= 5) {
            lastSavedRef.current = seconds;
            saveEBookListeningProgress(profile, bookId, chapter.id, seconds);
          }
          if (absolute >= boundsRef.current.end - 0.05) {
            event.currentTarget.pause();
            if (chapters[index + 1]) setChapter(chapters[index + 1]);
          }
        }}
        onDurationChange={(event) => {
          if (!Number.isFinite(boundsRef.current.end)) setDuration(event.currentTarget.duration);
        }}
        onEnded={() => chapters[index + 1] && setChapter(chapters[index + 1])}
      />
      <div className="flex items-center gap-4">
        {cover && <img src={cover} alt="" className="h-16 w-11 rounded object-cover" />}
        <div className="min-w-0 w-52">
          <p className="truncate text-sm font-semibold text-ink">{bookTitle}</p>
          <p className="truncate text-xs text-ink-muted">{chapter.title}</p>
        </div>
        <button type="button" aria-label="Previous audio chapter" disabled={index <= 0} onClick={() => setChapter(chapters[index - 1])} className="rounded-full p-2 hover:bg-elevated disabled:opacity-30"><ChevronLeft size={20} /></button>
        <button type="button" aria-label="Back 15 seconds" onClick={() => seek(position - 15)} className="rounded-full p-2 hover:bg-elevated"><RotateCcw size={19} /></button>
        <button
          type="button"
          aria-label={playing ? "Pause" : "Play"}
          disabled={!src}
          onClick={() => playing ? audioRef.current?.pause() : void audioRef.current?.play()}
          className="grid size-11 place-items-center rounded-full bg-accent text-canvas disabled:opacity-40"
        >{playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}</button>
        <button type="button" aria-label="Forward 15 seconds" onClick={() => seek(position + 15)} className="rounded-full p-2 hover:bg-elevated"><RotateCw size={19} /></button>
        <button type="button" aria-label="Next audio chapter" disabled={index < 0 || index >= chapters.length - 1} onClick={() => setChapter(chapters[index + 1])} className="rounded-full p-2 hover:bg-elevated disabled:opacity-30"><ChevronRight size={20} /></button>
        <span className="w-10 text-right text-xs text-ink-subtle">{time(position)}</span>
        <input
          aria-label="Audiobook position"
          type="range"
          min={0}
          max={duration || 1}
          value={Math.min(position, duration || 1)}
          onChange={(event) => seek(Number(event.target.value))}
          className="min-w-24 flex-1 accent-[var(--color-accent)]"
        />
        <span className="w-10 text-xs text-ink-subtle">{time(duration)}</span>
        <button type="button" onClick={() => {
          const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
          setRate(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
        }} className="min-w-10 rounded-full px-2 py-1 text-xs font-semibold hover:bg-elevated">{rate}×</button>
        <button type="button" aria-label="Close audiobook" onClick={() => { persist(); onClose(); }} className="rounded-full p-2 hover:bg-elevated"><X size={20} /></button>
      </div>
      {error && <p className="mt-2 text-center text-xs text-red-400">{error}</p>}
    </div>
  );
}
