import type { Meta } from "@/lib/cinemeta";
import type { LocalEntry } from "@/lib/local-library";

export type LocalEpisodesPayload = {
  title: string;
  tmdbId: number | null;
  imdbId: string | null;
  poster?: string | null;
  videos?: Meta["videos"];
  initialSeason?: number | null;
  highlightEpisode?: number | null;
  onPlayLocal: (entry: LocalEntry) => void;
  onStream?: () => void;
};

type LocalEpisodesState = { open: boolean; payload: LocalEpisodesPayload | null };

let state: LocalEpisodesState = { open: false, payload: null };
const subs = new Set<() => void>();

function emit(): void {
  for (const fn of subs) fn();
}

export function openLocalEpisodes(payload: LocalEpisodesPayload): void {
  state = { open: true, payload };
  emit();
}

export function closeLocalEpisodes(): void {
  if (!state.open) return;
  state = { open: false, payload: null };
  emit();
}

export function getLocalEpisodes(): LocalEpisodesState {
  return state;
}

export function subscribeLocalEpisodes(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
