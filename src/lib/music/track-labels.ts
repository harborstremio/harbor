import type { MusicTrack } from "./types";

export type MusicTrackLabel =
  | "explicit"
  | "radioEdit"
  | "clean"
  | "live"
  | "remix"
  | "instrumental";

/** Only version annotations count: a song named "Live" is not a live recording. */
export function musicTrackLabels(
  track: Pick<MusicTrack, "title" | "version" | "explicit">,
): MusicTrackLabel[] {
  const annotations = [
    track.version ?? "",
    ...(track.title.match(/\([^)]*\)|\[[^\]]*\]/g) ?? []),
    track.title
      .split(/\s[-–—]\s/)
      .slice(1)
      .join(" "),
  ].join(" ");
  const labels: MusicTrackLabel[] = [];
  if (track.explicit === true) labels.push("explicit");
  if (/\bradio\s+(edit|version)\b/i.test(annotations)) labels.push("radioEdit");
  if (track.explicit !== true && /\bclean(?:\s+(?:edit|version))?\b/i.test(annotations))
    labels.push("clean");
  if (/\blive\b/i.test(annotations)) labels.push("live");
  if (/\bremix\b/i.test(annotations)) labels.push("remix");
  if (/\binstrumental\b/i.test(annotations)) labels.push("instrumental");
  return labels;
}
