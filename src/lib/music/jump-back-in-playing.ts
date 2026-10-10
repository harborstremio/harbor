import type { MusicPlaybackOrigin } from "./playback-origin";
/** Mark the queue's owner, not every playlist containing the same song. */
export function jumpBackInPlayingKey(origin: MusicPlaybackOrigin): string | null {
  if (!origin) return null;
  if (origin.kind === "library") return origin.id === "liked" ? "liked" : null;
  if (origin.kind === "playlist" || origin.kind === "similar") return `${origin.kind}:${origin.id}`;
  if (origin.kind === "catalog") return `${origin.item.kind}:${origin.item.id}`;
  return null;
}
