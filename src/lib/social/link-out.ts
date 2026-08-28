import { useSyncExternalStore } from "react";
import { safeExternalUrl } from "./link-out-activation";

export type LinkOutJourney = { url: string; generation: number };
export type LinkOutOpenCallbacks = {
  onSuccess: () => void;
  onError: (error: unknown) => void;
  onSettled: () => void;
};

export function createLinkOutStore() {
  let current: LinkOutJourney | null = null;
  let nextGeneration = 0;
  const subscribers = new Set<() => void>();
  const emit = () => {
    for (const subscriber of subscribers) subscriber();
  };

  return {
    getSnapshot: () => current,
    subscribe(fn: () => void): () => void {
      subscribers.add(fn);
      return () => subscribers.delete(fn);
    },
    open(url: string): LinkOutJourney | null {
      const trimmed = (url || "").trim();
      if (!trimmed) return null;
      current = { url: trimmed, generation: ++nextGeneration };
      emit();
      return current;
    },
    close(): void {
      nextGeneration += 1;
      current = null;
      emit();
    },
    isCurrent(journey: LinkOutJourney): boolean {
      return current?.generation === journey.generation;
    },
  };
}

const linkOutStore = createLinkOutStore();

export function openLinkOut(url: string): void {
  const safeUrl = safeExternalUrl(url || "");
  if (!safeUrl) return;
  linkOutStore.open(safeUrl);
}

export function closeLinkOut(): void {
  linkOutStore.close();
}

export function isCurrentLinkOutJourney(journey: LinkOutJourney): boolean {
  return linkOutStore.isCurrent(journey);
}

export async function settleLinkOutOpen(
  isCurrent: (journey: LinkOutJourney) => boolean,
  journey: LinkOutJourney,
  opening: Promise<unknown>,
  callbacks: LinkOutOpenCallbacks,
): Promise<void> {
  try {
    await opening;
    if (!isCurrent(journey)) return;
    callbacks.onSettled();
    if (isCurrent(journey)) callbacks.onSuccess();
  } catch (error) {
    if (!isCurrent(journey)) return;
    callbacks.onError(error);
    if (isCurrent(journey)) callbacks.onSettled();
  }
}

export function useLinkOutJourney(): LinkOutJourney | null {
  return useSyncExternalStore(
    linkOutStore.subscribe,
    linkOutStore.getSnapshot,
    linkOutStore.getSnapshot,
  );
}

export function useLinkOut(): string | null {
  return useLinkOutJourney()?.url ?? null;
}
