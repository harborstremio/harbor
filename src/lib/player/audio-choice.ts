import type { TrackInfo } from "./bridge";

export type PlaybackAudioChoice = Pick<
  TrackInfo,
  "id" | "lang" | "title" | "codec" | "channels" | "channelCount"
>;

export function playbackAudioChoice(track: TrackInfo): PlaybackAudioChoice {
  return {
    id: track.id,
    lang: track.lang,
    title: track.title ?? track.label,
    codec: track.codec,
    channels: track.channels,
    channelCount: track.channelCount,
  };
}

export function selectPlaybackAudio(
  tracks: TrackInfo[],
  saved?: PlaybackAudioChoice,
): TrackInfo | null {
  if (!saved) return null;
  const normalize = (value?: string) => (value ?? "").trim().toLowerCase();
  // mpv may publish "aac" first and enrich it to "AAC (Advanced Audio
  // Coding)" after decoder initialization. The description is not an identity.
  const codec = (value?: string) =>
    normalize(value)
      .replace(/\s*\([^)]*\)/g, "")
      .replace(/[^a-z0-9]/g, "");
  const channelsMatch = (track: TrackInfo) => {
    if (track.channelCount !== saved.channelCount) return false;
    const current = normalize(track.channels);
    const previous = normalize(saved.channels);
    if (current === previous) return true;
    // An unselected mpv decoder can expose unknown2 until selection resolves
    // the same two channels to stereo. Only trust that placeholder when its
    // own count agrees with both snapshots; distinct known layouts stay distinct.
    const count = saved.channelCount;
    if (count == null || !Number.isInteger(count) || count <= 0) return false;
    return current === `unknown${count}` || previous === `unknown${count}`;
  };
  const matches = tracks.filter(
    (track) =>
      normalize(track.lang) === normalize(saved.lang) &&
      normalize(track.title ?? track.label) === normalize(saved.title) &&
      codec(track.codec) === codec(saved.codec) &&
      channelsMatch(track),
  );
  return matches.length === 1
    ? matches[0]
    : (matches.find((track) => track.id === saved.id) ?? null);
}
