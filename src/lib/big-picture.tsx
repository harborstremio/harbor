import { useSyncExternalStore } from "react";
import type { StreamingService } from "@/lib/settings/types";

export type BigPictureRoute =
  | { kind: "home" }
  | { kind: "anime" }
  | { kind: "shows" }
  | { kind: "movies" }
  | { kind: "live" }
  | { kind: "discover" }
  | { kind: "search" }
  | { kind: "library" }
  | { kind: "detail"; metaId: string }
  | { kind: "person"; personId: number; name: string }
  | { kind: "collection"; collectionId: number; name: string; image: string | null }
  | { kind: "collections" }
  | { kind: "tmdb-collection"; collectionId: number; name: string; image: string | null }
  | { kind: "service"; service: StreamingService }
  // base, never addonId: two installs of one addon share an id and only the
  // transport URL tells their catalogs apart.
  | { kind: "addon"; addonId: string; name: string; base: string; logo?: string }
  | { kind: "settings" };

type State = {
  active: boolean;
  stack: BigPictureRoute[];
};

const HOME: BigPictureRoute = { kind: "home" };

let state: State = { active: false, stack: [HOME] };
const listeners = new Set<() => void>();

function emit(next: State): void {
  state = next;
  for (const fn of listeners) fn();
}

export function subscribeBigPicture(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function getBigPictureState(): State {
  return state;
}

export function isBigPictureActive(): boolean {
  return state.active;
}

export function enterBigPicture(): void {
  if (state.active) return;
  emit({ active: true, stack: [HOME] });
}

export function exitBigPicture(): void {
  if (!state.active) return;
  emit({ active: false, stack: [HOME] });
}

export function pushBigPicture(route: BigPictureRoute): void {
  if (!state.active) return;
  const top = state.stack[state.stack.length - 1];
  if (top && top.kind === route.kind && routeKey(top) === routeKey(route)) return;
  emit({ active: true, stack: [...state.stack, route] });
}

export function popBigPicture(): boolean {
  if (!state.active) return false;
  if (state.stack.length <= 1) return false;
  emit({ active: true, stack: state.stack.slice(0, -1) });
  return true;
}

export function replaceBigPicture(route: BigPictureRoute): void {
  if (!state.active) return;
  emit({ active: true, stack: [...state.stack.slice(0, -1), route] });
}

export function resetBigPictureToHome(): void {
  if (!state.active) return;
  if (state.stack.length === 1 && state.stack[0].kind === "home") return;
  emit({ active: true, stack: [HOME] });
}

export type BigPictureTabKind =
  | "home"
  | "discover"
  | "anime"
  | "shows"
  | "movies"
  | "live"
  | "search"
  | "library"
  | "collections"
  | "settings";

// Tabs never stack on themselves. Clicking one and shoulder-cycling to it must
// land on the same one-frame stack, or Back means two different things.
export function goBigPictureTab(kind: BigPictureTabKind): void {
  if (!state.active) return;
  if (kind === "home") {
    resetBigPictureToHome();
    return;
  }
  emit({ active: true, stack: [HOME, { kind }] });
}

export function routeKey(route: BigPictureRoute): string {
  if (route.kind === "detail") return `detail:${route.metaId}`;
  if (route.kind === "person") return `person:${route.personId}`;
  if (route.kind === "collection") return `collection:${route.collectionId}`;
  if (route.kind === "tmdb-collection") return `tmdb-collection:${route.collectionId}`;
  if (route.kind === "service") return `service:${route.service}`;
  if (route.kind === "addon") return `addon:${route.base}`;
  return route.kind;
}

export function useBigPicture(): State {
  return useSyncExternalStore(subscribeBigPicture, getBigPictureState, getBigPictureState);
}

export function useBigPictureRoute(): BigPictureRoute {
  const s = useBigPicture();
  return s.stack[s.stack.length - 1] ?? HOME;
}
