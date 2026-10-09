import { createContext, useContext } from "react";
import type { GameSummary } from "@/lib/games/types";
import type { GameAccessValue } from "./game-access-context";

export type LibraryDestination = "all" | "steam" | "custom" | "retro" | "collections" | "mods";
export type GameAccessTarget = { game: GameSummary } | { library: LibraryDestination };

// Keep identity separate from the refreshable provider component.
export const GameAccessContext = createContext<GameAccessValue | null>(null);
export const useOptionalGameAccess = () => useContext(GameAccessContext);
export function useGameAccess() {
  const value = useOptionalGameAccess();
  if (!value) throw Error("Game access requires its provider");
  return value;
}
