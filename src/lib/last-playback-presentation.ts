import type { ActualPlayback } from "./playback-history";
import { spoilerMaskFor, type SpoilerSettings } from "./spoilers";
import { isLocalUrl } from "./player/local-url";

function displayTitle(value: string | undefined, local = false): string | undefined {
  if (!value) return undefined;
  const name = local && isLocalUrl(value) ? value.split(/[\\/]/).pop() : value;
  if (!name || /[\\/]|https?:|magnet:|^[a-z]:/i.test(name)) return undefined;
  const clean = Array.from(name)
    .filter((character) => character.charCodeAt(0) > 31 && character.charCodeAt(0) !== 127)
    .join("")
    .trim();
  return clean ? (clean.length > 96 ? `${clean.slice(0, 93)}…` : clean) : undefined;
}

/** Resize only a known public image route; never rewrite signed or arbitrary source URLs. */
function shortcutArtwork(value: string | undefined): string | undefined {
  if (!value || !/^(https?:|asset:|data:image\/|blob:)/i.test(value)) return undefined;
  if (/^https:\/\/image\.tmdb\.org\/t\/p\/(?:original|w\d+|h\d+)\/[^?#]+$/.test(value))
    return value.replace(/\/t\/p\/[^/]+\//, "/t/p/w92/");
  return value;
}

/** Only resolved media artwork is used; local paths never become row text or image URLs. */
export function lastPlaybackPresentation(
  target: ActualPlayback,
  settings: SpoilerSettings,
  watched: boolean,
): { artwork?: string; title?: string; episode?: string } {
  const { meta, episode } = target.src;
  const mask = spoilerMaskFor(settings, { watched, isNextUp: false });
  const local = /^local[:-]/i.test(meta.id);
  const safeTitle =
    displayTitle(meta.name, local) ??
    (local && isLocalUrl(target.src.url)
      ? displayTitle(target.src.streamRef?.resolvedFilename ?? target.src.url, true)
      : undefined);
  const candidate = episode ? (mask.thumb ? undefined : episode.still) : meta.poster;
  const artwork = shortcutArtwork(candidate);
  return {
    artwork,
    title: safeTitle,
    episode: episode
      ? `S${episode.season} · E${episode.episode}${!mask.title && episode.name && !/[\\/]|https?:/i.test(episode.name) ? ` · ${episode.name}` : ""}`
      : undefined,
  };
}
