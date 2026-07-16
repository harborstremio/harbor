import type { SubCue } from "@/lib/subtitles/parser";
import type { SubtitleLoadMetadata } from "../subtitle-load";

export type SubTrack = {
  id: string;
  url: string;
  lang?: string;
  title?: string;
  external: boolean;
  cues: SubCue[] | null;
  loading: boolean;
  metadata?: SubtitleLoadMetadata;
};

export type AudioTrackList = {
  length: number;
  [index: number]: { id?: string; label: string; language: string; enabled: boolean };
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};
