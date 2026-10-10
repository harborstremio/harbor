import type { CSSProperties } from "react";
import { useActiveHeroDockMode } from "@/lib/hero-dock-layout";
import { curatedArt, useCuratedArtVersion } from "@/lib/jl/sports/curated-art";
import { usePinnedWallpaper } from "@/lib/jl/sports/page-wallpaper";

/**
 * The Sports page's background while hero art is pinned as its wallpaper: the owner's wallpaper
 * slot (else their hero) by key, else the pinned photo, under a canvas veil so rows stay readable.
 * A video pinned as the wallpaper (the hero dock) takes precedence and needs the page clear.
 */
export function useSportsPageWallpaper(): CSSProperties | undefined {
  const pinned = usePinnedWallpaper();
  const dockMode = useActiveHeroDockMode();
  useCuratedArtVersion();
  if (!pinned || dockMode === "wallpaper") return undefined;
  const src = (pinned.key ? curatedArt(pinned.key, "wallpaper") : null) ?? pinned.url;
  if (!src) return undefined;
  const veil = "color-mix(in oklch, var(--color-canvas) 78%, transparent)";
  return {
    backgroundImage: `linear-gradient(${veil}, ${veil}), url(${JSON.stringify(src)})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundAttachment: "fixed",
  };
}
