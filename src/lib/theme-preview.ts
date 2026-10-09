import { useSyncExternalStore } from "react";
import type { ThemeLayout } from "./theme";
import type { NavCustomization } from "@/chrome/nav-items";

export type ThemePreviewState = {
  layout: ThemeLayout;
  bokeh: boolean;
  navCustomization?: NavCustomization;
};

let current: ThemePreviewState | null = null;
const listeners = new Set<() => void>();

export function setThemePreview(next: ThemePreviewState | null): void {
  current = next;
  for (const fn of listeners) fn();
}

export function getThemePreview(): ThemePreviewState | null {
  return current;
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useThemePreview(): ThemePreviewState | null {
  return useSyncExternalStore(subscribe, getThemePreview, getThemePreview);
}

export function usePreviewNavCustomization(saved: NavCustomization): NavCustomization {
  return useThemePreview()?.navCustomization ?? saved;
}
