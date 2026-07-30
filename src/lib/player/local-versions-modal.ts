import type { LocalEntry } from "@/lib/local-library";

export type LocalVersionsPayload = {
  title: string;
  poster?: string | null;
  entries: LocalEntry[];
  onPlayLocal: (entry: LocalEntry) => void;
};

type LocalVersionsState = { open: boolean; payload: LocalVersionsPayload | null };

let state: LocalVersionsState = { open: false, payload: null };
const subs = new Set<() => void>();

function emit(): void {
  for (const fn of subs) fn();
}

export function openLocalVersions(payload: LocalVersionsPayload): void {
  state = { open: true, payload };
  emit();
}

export function closeLocalVersions(): void {
  if (!state.open) return;
  state = { open: false, payload: null };
  emit();
}

export function getLocalVersions(): LocalVersionsState {
  return state;
}

export function subscribeLocalVersions(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}
