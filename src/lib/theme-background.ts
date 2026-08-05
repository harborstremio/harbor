import type { ThemeBackground } from "@/lib/theme";

type WithBackground = { background?: ThemeBackground } | null | undefined;

export function isThemeOwnedBackground(current: string | null, preset: WithBackground): boolean {
  if (!current) return false;
  return current === preset?.background?.image;
}

export function nextBackgroundImage(
  current: string | null,
  previous: WithBackground,
  next: WithBackground,
): string | null {
  if (isThemeOwnedBackground(current, previous)) return next?.background?.image ?? null;
  return current ?? next?.background?.image ?? null;
}
