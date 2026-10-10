import type { MusicTrack } from "./types";
/** Vocal and backing-track editions must not silently substitute for each other. */
export function backingTrackVersion(track: Pick<MusicTrack, "title" | "version">): "instrumental" | "karaoke" | null {
  const label = `${track.title} ${track.version ?? ""}`;
  if (/\b(?:karaoke|sing[ -]?along)\b/i.test(label)) return "karaoke";
  if (/\b(?:instrumental|backing[ -]?track|no[ -]?vocals|without vocals|vocal[ -]?removed)\b/i.test(label)) return "instrumental";
  return null;
}
export function compatibleVocalVersion(requested: MusicTrack, candidate: MusicTrack): boolean {
  return backingTrackVersion(requested) === backingTrackVersion(candidate);
}
/** A file on disk is already the song; a connector's stream url is only where it played last. */
const directFile = (url: string | undefined) => /^(?:file|blob|data):/i.test(url ?? "");

export function shouldResolvePreferredSource(track: MusicTrack, preferred: string | null, explicit: boolean, failed: boolean): boolean {
  return Boolean(preferred && !explicit && !failed && !directFile(track.playbackUrl) && track.mediaKind !== "video" && track.connectorId !== "local" && track.connectorId !== preferred);
}
