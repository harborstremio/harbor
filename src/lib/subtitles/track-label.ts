import { languageName } from "./language.ts";

type SubtitleTrackLabelInput = {
  id?: string;
  lang?: string;
  title?: string;
  codec?: string;
  external?: boolean;
};

function hasUnknownLanguage(lang: string | undefined): boolean {
  const value = (lang ?? "").trim().toLowerCase();
  return value === "" || value === "und" || value === "unknown" || value === "undetermined";
}

export function subtitleTrackLanguageLabel(track: SubtitleTrackLabelInput): string {
  if (hasUnknownLanguage(track.lang)) return track.external ? "Unknown" : "Embedded";
  return languageName(track.lang!);
}

export function subtitleTrackTitle(track: SubtitleTrackLabelInput): string {
  const title = track.title?.trim();
  if (title && title !== track.lang) return title;
  if (track.external) return "External subtitle";
  const id = track.id?.trim();
  const codec = track.codec?.trim().toUpperCase();
  return [id ? `Embedded ${id}` : "Embedded track", codec].filter(Boolean).join(" · ");
}
