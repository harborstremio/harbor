import type { Meta } from "@/lib/cinemeta";

export type VoyageTheme = {
  id: string;
  label: string;
  tagline: string;
  type: "movie" | "series";
  genre?: string;
  accent: string;
  backdrop?: string;
  seeds?: string[];
};

export type VoyagePhase = "building" | "sailing";

export type Voyage = {
  id: string;
  themeId: string;
  themeLabel: string;
  tagline: string;
  accent: string;
  createdAt: number;
  targetLength: number;
  phase: VoyagePhase;
  pool: Meta[];
  routeIds: string[];
  playedIds: string[];
  headingIds: string[];
  seen: string[];
  recVotes?: Record<string, number>;
  enrichedPicks?: string[];
};

export type StoredVoyage = Omit<Voyage, "phase" | "playedIds"> & {
  phase?: VoyagePhase;
  playedIds?: string[];
};

export type VoyageState = {
  active: Voyage | null;
  streak: number;
  lastSail: string | null;
};
