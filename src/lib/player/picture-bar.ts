import { useSyncExternalStore } from "react";

export const PICTURE_DIALS = [
  { key: "brightness", label: "Brightness", min: -100, max: 100 },
  { key: "contrast", label: "Contrast", min: -100, max: 100 },
  { key: "saturation", label: "Saturation", min: -100, max: 100 },
  { key: "gamma", label: "Gamma", min: -100, max: 100 },
] as const;

let barOpen = false;
const listeners = new Set<() => void>();

export function openPictureBar(): void {
  if (barOpen) return;
  barOpen = true;
  listeners.forEach((l) => l());
}

export function closePictureBar(): void {
  if (!barOpen) return;
  barOpen = false;
  listeners.forEach((l) => l());
}

export function togglePictureBar(): void {
  barOpen = !barOpen;
  listeners.forEach((l) => l());
}

export function usePictureBarOpen(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => barOpen,
    () => false,
  );
}
