import type { SportsGame } from "@/lib/sports/espn-types";

export type BpSportsMode = "for-you" | "live" | "schedule" | "hot" | "explore";

export type BpSportsRowModel = {
  key: string;
  title: string;
  description?: string;
  games: SportsGame[];
};

export type BpSportsSubject = { game: SportsGame | null; group: string };

export type BpSportsSelect = (game: SportsGame) => void;
