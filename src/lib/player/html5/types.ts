import type { SubCue } from "@/lib/subtitles/parser";
import type { SubtitleLoadMetadata } from "@/lib/subtitles/types";

export type SubTrack = {
  id: string;
  url: string;
  originalUrl?: string;
  lang?: string;
  title?: string;
  external: boolean;
  cues: SubCue[] | null;
  loading: boolean;
  loadingPromise?: Promise<boolean>;
  metadata?: SubtitleLoadMetadata;
  cleanup?: () => void;
};

export type AudioTrackList = {
  length: number;
  [index: number]: { id?: string; label: string; language: string; enabled: boolean };
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
};
