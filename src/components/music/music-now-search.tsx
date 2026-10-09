import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Loader2, Play, Plus, Search, X } from "@/components/icons/music-icons";
import { Poster } from "@/components/poster";
import { MusicTrackPlaybackMark } from "./music-now-playing-mark";
import { useT } from "@/lib/i18n";
import { searchTyped } from "@/lib/music/catalog";
import { enqueueMusic, playMusic } from "@/lib/music/player";
import { rankMusicSearch } from "@/lib/music/search-ranking";
import { searchMusicVideoPage } from "@/lib/music/video-pages";
import {
  dedupeSearchTracks,
  filterSearchMode,
  mergeSearchTracks,
  moveSearchCursor,
  nextSearchLimit,
  searchTrackKey,
  NOW_SEARCH_PAGE,
  type NowSearchMode,
} from "@/lib/music/now-search";
import type { MusicTrack } from "@/lib/music/types";
import { MusicMediaBadge } from "./music-media-badge";
import "./music-now-search.css";

const MODES: NowSearchMode[] = ["songs", "videos"];

async function fetchSearchMode(
  value: string,
  limit: number,
): Promise<MusicTrack[]> {
  const found = await searchTyped(value, limit);
  const ranked = rankMusicSearch(found, value);
  return (ranked?.tracks ?? found.tracks) as MusicTrack[];
}

export function MusicNowSearch({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<NowSearchMode>("songs");
  const [limit, setLimit] = useState(NOW_SEARCH_PAGE);
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<MusicTrack[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [more, setMore] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nextLimit, setNextLimit] = useState<number | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [queued, setQueued] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const sentinelRef = useRef<HTMLLIElement>(null);
  const videoCursors = useRef(new Map<number, string | null>());

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const restart = useCallback(() => {
    videoCursors.current.clear();
    setLimit(NOW_SEARCH_PAGE);
    setCursor(-1);
    setNextLimit(null);
  }, []);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setResults(null);
      setBusy(false);
      setMore(false);
      setFailed(false);
      setNextLimit(null);
      return;
    }
    const initial = limit === NOW_SEARCH_PAGE;
    if (initial) {
      setBusy(true);
      setFailed(false);
    } else setMore(true);
    let live = true;
    const run = () => {
      const request = mode === "videos"
        ? searchMusicVideoPage(value, false, videoCursors.current.get(limit) ?? null)
        : fetchSearchMode(value, limit).then(tracks => ({ tracks, next: null }));
      void request
        .then(({ tracks: found, next }) => {
          if (!live) return;
          const page = filterSearchMode(found, mode);
          setResults((prev) =>
            initial || !prev ? dedupeSearchTracks(page) : mergeSearchTracks(prev, page),
          );
          if (mode === "videos") {
            const following = next ? limit + NOW_SEARCH_PAGE : null;
            if (following !== null) videoCursors.current.set(following, next);
            setNextLimit(following);
          } else setNextLimit(nextSearchLimit(limit, found.length));
          setFailed(false);
          setBusy(false);
          setMore(false);
        })
        .catch(() => {
          if (!live) return;
          if (initial) setResults([]);
          setFailed(true);
          setNextLimit(null);
          setBusy(false);
          setMore(false);
        });
    };
    if (!initial) {
      run();
      return () => {
        live = false;
      };
    }
    const id = setTimeout(run, 320);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [query, mode, limit, attempt]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || nextLimit === null || busy || more) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setLimit(nextLimit);
      },
      { root: listRef.current, rootMargin: "200px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextLimit, busy, more]);

  const play = (track: MusicTrack, index: number) => {
    setCursor(index);
    void playMusic(track, results ?? [track]).catch(() => {});
  };
  const enqueue = (track: MusicTrack) => {
    enqueueMusic(track);
    setQueued((prev) => (prev.includes(track.id) ? prev : [...prev, track.id]));
  };
  const focusRow = (index: number) => {
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-row="${index}"]`)
      ?.focus({ preventScroll: false });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (query) {
        setQuery("");
        restart();
        inputRef.current?.focus({ preventScroll: true });
      } else onClose();
      return;
    }
    const rows = results ?? [];
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (delta && rows.length) {
      event.preventDefault();
      const next = moveSearchCursor(cursor, delta, rows.length);
      setCursor(next);
      focusRow(next);
      return;
    }
    if (event.key === "Enter" && event.target === inputRef.current && cursor >= 0 && rows[cursor]) {
      event.preventDefault();
      play(rows[cursor], cursor);
    }
  };

  const modeLabel = (id: NowSearchMode) =>
    t(id === "videos" ? "music.now.videos" : "music.search.tracks");
  const empty = failed ? t("music.error.search") : t("music.searchEmpty");

  return (
    <div className="music-now-search" onKeyDown={onKeyDown}>
      <div className="music-now-search-bar" data-busy={busy || undefined}>
        {busy ? (
          <Loader2
            size={16}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : (
          <Search size={16} aria-hidden="true" />
        )}
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            restart();
          }}
          placeholder={t("music.searchPlaceholder")}
          aria-label={t("music.searchPlaceholder")}
          aria-controls="music-now-search-list"
        />
        <button type="button" onClick={onClose} aria-label={t("music.search.clear")}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="music-now-search-modes" role="group" aria-label={t("music.searchLabel")}>
        {MODES.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={mode === id}
            onClick={() => {
              if (mode === id) return;
              setMode(id);
              setResults(null);
              setFailed(false);
              restart();
            }}
          >
            {modeLabel(id)}
          </button>
        ))}
      </div>
      {results === null ? (
        <p className="music-now-search-hint">{t("music.searchPlaceholder")}</p>
      ) : results.length === 0 && nextLimit === null ? (
        <div className="music-now-search-hint">
          {busy ? (
            <span className="music-now-search-loading">
              <Loader2
                size={15}
                className="animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
              {t("music.loading")}
            </span>
          ) : (
            <>
              <p>{empty}</p>
              {failed ? (
                <button
                  type="button"
                  className="music-now-search-retry"
                  onClick={() => setAttempt((value) => value + 1)}
                >
                  {t("music.offline.retry")}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <ol className="music-now-search-list" id="music-now-search-list" ref={listRef}>
          {results.map((track, index) => {
            const added = queued.includes(track.id);
            return (
              <li
                key={`${searchTrackKey(track)}:${index}`}
                data-active={cursor === index || undefined}
              >
                <button
                  type="button"
                  data-row={index}
                  className="music-now-search-row"
                  onClick={() => play(track, index)}
                  onFocus={() => setCursor(index)}
                  aria-label={t("music.playTrack", { title: track.title, artist: track.artist })}
                >
                  <Poster
                    src={track.artwork}
                    seed={track.id}
                    ratio="square"
                    className="w-full [--poster-radius:0px]"
                    lazy
                  ><MusicTrackPlaybackMark track={track}/></Poster>
                  <span className="music-now-search-meta">
                    <strong>{track.title}</strong>
                    <span className="music-now-search-sub">
                      {track.artist}
                      <MusicMediaBadge kind={track.mediaKind} compact />
                    </span>
                  </span>
                  <span className="music-now-search-play" aria-hidden="true">
                    <Play size={14} />
                  </span>
                </button>
                <button
                  type="button"
                  className="music-now-search-add"
                  data-added={added || undefined}
                  onClick={() => enqueue(track)}
                  aria-label={t("music.card.addToQueue")}
                  title={t("music.card.addToQueue")}
                >
                  {added ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Plus size={16} aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
          {nextLimit !== null || more ? (
            <li className="music-now-search-sentinel" ref={sentinelRef}>
              {more ? (
                <span className="music-now-search-loading">
                  <Loader2
                    size={15}
                    className="animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  {t("music.loading")}
                </span>
              ) : null}
            </li>
          ) : null}
          {failed && results.length ? (
            <li className="music-now-search-sentinel">
              <button
                type="button"
                className="music-now-search-retry"
                onClick={() => setAttempt((value) => value + 1)}
              >
                {t("music.offline.retry")}
              </button>
            </li>
          ) : null}
        </ol>
      )}
    </div>
  );
}
