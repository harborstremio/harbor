import type { Meta } from "@/lib/cinemeta";

export type Progress = { ratio: number; watched: boolean; startedAt: number };

export type GridEpisode = {
  key: string;
  number: number;
  season: number;
  seasonLabel?: string;
  title: string;
  stills: string[];
  runtime: number | null;
  airDate: string | null;
  overview?: string;
  rating?: number;
  ratingIsImdb?: boolean;
  filler?: boolean;
  upcoming?: boolean;
  meta?: Meta;
  sourceMetaId?: string;
  play: (opts?: { resume?: boolean }) => void;
};
