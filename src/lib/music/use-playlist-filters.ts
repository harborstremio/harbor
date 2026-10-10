import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { DEFAULT_PLAYLIST_FILTERS, filterPlaylist, playlistSource, type PlaylistFilters, type PlaylistMetadata } from "./playlist-filters";
import { readArtistGenres, subscribeArtistGenres } from "./artist-genre-cache";
import { indexPlaylistGenres, type PlaylistGenreIndex } from "./playlist-genre-index";
import type { MusicTrack } from "./types";

const EMPTY: MusicTrack[] = [];
const VIEW_KEY = "harbor.music.playlistView";
const NO_GENRES: PlaylistGenreIndex = new Map();
function initialFilters(): PlaylistFilters {
  let view: PlaylistFilters["view"] = "list";
  try { if (localStorage.getItem(VIEW_KEY) === "compact") view = "compact"; } catch { /* Storage can be unavailable. */ }
  return { ...DEFAULT_PLAYLIST_FILTERS, view };
}

export function usePlaylistFilters(id: string, tracks: MusicTrack[] = EMPTY, metadata: PlaylistMetadata = {}) {
  const fresh = () => ({ ...initialFilters(), ...(metadata.recentFirst ? { sort: "added" as const } : {}) });
  const [state, setState] = useState(() => ({ id, filters: fresh() }));
  const filters = state.id === id ? state.filters : fresh();
  const update = (change: Partial<PlaylistFilters>) => setState(current => ({ id, filters: { ...(current.id === id ? current.filters : fresh()), ...change } }));
  // Playback enriches track objects without changing their genre membership.
  const genreKey = useMemo(() => JSON.stringify([id, tracks.map(track => [track.id, track.artist])]), [id, tracks]);
  const [indexed, setIndexed] = useState<{ key: string; genres: PlaylistGenreIndex } | null>(null);
  const [pendingGenres, setPendingGenres] = useState<MusicTrack[] | null>(null);
  useEffect(() => {
    if (metadata.genreTracks || !tracks.length) return;
    let abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pendingTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const schedule = (delay: number) => {
      if (timer !== undefined) return;
      timer = setTimeout(() => {
        timer = undefined;
        abort.abort();
        abort = new AbortController();
        const signal = abort.signal;
        clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { if (!signal.aborted) setPendingGenres(tracks); }, 180);
        void readArtistGenres().then(known => indexPlaylistGenres(tracks, known, signal)).then(genres => {
          if (stopped || signal.aborted) return;
          setIndexed(previous => {
            if (!genres.size && previous?.key !== genreKey) return previous;
            // Existing pills stay in place as newly cached genres become available.
            const ordered = previous?.key === genreKey
              ? new Map([...previous.genres.keys(), ...genres.keys()].filter(id => genres.has(id)).map(id => [id, genres.get(id)!]))
              : genres;
            return { key: genreKey, genres: ordered };
          });
        }).finally(() => {
          if (signal.aborted) return;
          clearTimeout(pendingTimer);
          setPendingGenres(current => current === tracks ? null : current);
        });
      }, delay);
    };
    // Paint first, then coalesce cached metadata updates. Never fetch artist profiles.
    schedule(200);
    const unsubscribe = subscribeArtistGenres(() => schedule(500));
    return () => { stopped = true; clearTimeout(timer); clearTimeout(pendingTimer); abort.abort(); unsubscribe(); };
  }, [tracks, metadata.genreTracks, genreKey]);
  useEffect(() => { try { localStorage.setItem(VIEW_KEY, filters.view); } catch { /* Optional preference. */ } }, [filters.view]);
  const query = useDeferredValue(filters.query);
  const genres = metadata.genreTracks ?? (indexed?.key === genreKey ? indexed.genres : NO_GENRES);
  const { genre, source, content, sort, descending } = filters;
  const selectedGenres = genre === null ? undefined : genres;
  const visible = useMemo(() => filterPlaylist(tracks, { query, genre, source, content, sort, descending, view: "list" }, { ...metadata, genreTracks: selectedGenres }), [tracks, query, genre, source, content, sort, descending, metadata.addedAt, metadata.recentFirst, selectedGenres]);
  const genreIds = useMemo(() => [...genres.keys()], [genres]);
  const sources = useMemo(() => [...new Set(tracks.map(playlistSource))].filter(Boolean), [tracks]);
  const active = Boolean(filters.query || filters.genre !== null || filters.source !== "all" || filters.content !== "all");
  return { filters, update, tracks: visible, total: tracks.length, genreIds, sources, active,
    genresLoading: pendingGenres === tracks && !genres.size,
    filtering: query !== filters.query, canSortAdded: Boolean(metadata.recentFirst || metadata.addedAt !== undefined),
    reset: () => update({ query: "", genre: null, source: "all", content: "all" }) };
}
export type PlaylistFilterController = ReturnType<typeof usePlaylistFilters>;
