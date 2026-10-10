import { useEffect, type RefObject } from "react";
import type { PlayerBridge } from "@/lib/player/bridge";
import { anime4kChain, type Anime4kMode, type Anime4kTier } from "@/lib/player/anime4k-modes";
import { metaIsAnime } from "@/lib/player/anime-src";
import { shaderCompanionProps, splitShaderChainAroundUpscaler } from "@/lib/player/shader-chain";
import { useSettings, type Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";

export type Anime4kChoice = "auto" | "off" | Anime4kMode;

function autoActive(settings: Settings, src: PlayerSrc): boolean {
  return settings.playerAnime4k &&
    (!settings.playerAnime4kAnimeOnly || !!src.isAnime || metaIsAnime(src.meta));
}

type Anime4kDims = { srcWidth: number; displayWidth: number };

const SECONDARY_TO_PRIMARY: Partial<Record<Anime4kMode, Anime4kMode>> = {
  AA: "A",
  BB: "B",
  CA: "C",
};

/**
 * Pixel width the video is actually presented at. mpv's `dwidth` already
 * accounts for window size, panscan and aspect overrides, so it is the right
 * target to compare the source against. The screen width is only a fallback
 * before mpv has reported a display size.
 */
function displayWidthPx(fallbackVideoWidth: number): number {
  if (fallbackVideoWidth > 0) return fallbackVideoWidth;
  if (typeof window === "undefined") return 0;
  const dpr = window.devicePixelRatio || 1;
  return Math.round((window.screen?.width ?? window.innerWidth ?? 0) * dpr);
}

/**
 * Drops the second restore pass when the window cannot show the extra detail.
 * It compares the native source against the presented size, so fullscreen
 * playback on a display the size of the source keeps the requested mode
 * instead of being silently downgraded.
 */
function gatedMode(mode: Anime4kMode, dims?: Anime4kDims): Anime4kMode {
  if (!dims) return mode;
  const { srcWidth, displayWidth } = dims;
  if (srcWidth <= 0 || displayWidth <= 0) return mode;
  // Only step down when the source already fills the target: there is no
  // headroom left for a doubler to resolve anything into.
  if (srcWidth >= displayWidth) return SECONDARY_TO_PRIMARY[mode] ?? mode;
  return mode;
}

function gatedTier(settings: Settings): Anime4kTier {
  if (settings.mpvQuality === "performance") return "fast";
  return settings.playerAnime4kTier as Anime4kTier;
}

export function anime4kShadersFor(
  settings: Settings,
  src: PlayerSrc,
  c: Anime4kChoice,
  dims?: Anime4kDims,
): string[] {
  if (!settings.playerAnime4k || c === "off") return [];
  const tier = gatedTier(settings);
  if (c === "auto") {
    if (!autoActive(settings, src)) return [];
    return anime4kChain(
      settings.playerAnime4kFolder,
      gatedMode(settings.playerAnime4kMode as Anime4kMode, dims),
      tier,
    );
  }
  return anime4kChain(settings.playerAnime4kFolder, gatedMode(c, dims), tier);
}

/**
 * Full `glsl-shaders` chain for the current configuration. Also used at mpv
 * start so the first frames render with the same chain the runtime effect
 * would apply.
 */
export function fullShaderChain(
  settings: Settings,
  src: PlayerSrc,
  choice: Anime4kChoice,
  dims?: Anime4kDims,
): string[] {
  const { before, after } = splitShaderChainAroundUpscaler(settings);
  return [...before, ...anime4kShadersFor(settings, src, choice, dims), ...after];
}

export function useAnime4k(
  bridgeRef: RefObject<PlayerBridge | null>,
  srcKey: string,
  src: PlayerSrc,
  videoWidth = 0,
  videoSourceWidth = 0,
  bridgeReady = true,
) {
  const { settings, update } = useSettings();
  const choice = (settings.playerAnime4kOverride as Anime4kChoice) || "auto";
  const available = !!settings.playerAnime4kFolder;
  const dims: Anime4kDims = {
    srcWidth: videoSourceWidth,
    displayWidth: displayWidthPx(videoWidth),
  };
  // Depend on the resulting configuration so clock ticks and unrelated settings
  // don't recompile shaders, while folder, quality and override changes do.
  // Anime4K restores and upscales on its own, so the catalog shaders that feed
  // an upscale run in front of it and only finishers (sharpen, tonemap) follow.
  const shaderConfig = JSON.stringify({
    chain: fullShaderChain(settings, src, choice, dims),
    props: shaderCompanionProps(settings),
  });

  useEffect(() => {
    if (!bridgeReady) return;
    const { chain, props } = JSON.parse(shaderConfig) as {
      chain: string[];
      props: Record<string, string>;
    };
    bridgeRef.current?.setAnime4kShaders(chain);
    bridgeRef.current?.setShaderProps?.(props);
  }, [bridgeRef, bridgeReady, srcKey, shaderConfig]);

  const setMode = (c: string) => {
    update({ playerAnime4kOverride: c });
  };

  const displayMode: Anime4kChoice =
    choice === "auto" && autoActive(settings, src)
      ? (settings.playerAnime4kMode as Anime4kMode)
      : choice;

  return { mode: displayMode, setMode, available };
}
