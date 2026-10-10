import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Download, Library, Pause } from "lucide-react";
import { useT } from "@/lib/i18n";
import { gameAvailability, gameAvailabilityIndex, type GameAvailability } from "@/lib/games/availability";
import type { UnifiedLibraryGame } from "@/lib/games/unified-library";
import type { GameSummary } from "@/lib/games/types";
import type { GameTransfers } from "@/hooks/use-game-transfers";
import { GameArt } from "./game-art";
import "./game-availability.css";

const Context = createContext<ReadonlyMap<string, GameAvailability>>(new Map());
export function GameAvailabilityScope({ profile, library, downloads, children }: { profile: string; library: UnifiedLibraryGame[]; downloads: GameTransfers; children: ReactNode }) {
  const index = useMemo(() => gameAvailabilityIndex(profile, library, downloads.records, downloads.torrents.records), [profile, library, downloads.records, downloads.torrents.records]);
  return <Context.Provider value={index}>{children}</Context.Provider>;
}
export function useGameAvailabilityIndex() { return useContext(Context); }
/** Card status belongs to the artwork so it never changes caption or row height. */
export function GameAvailabilityCover({ game, src, fallback }: { game: GameSummary; src: string; fallback?: string }) {
  return <span className="games-availability-cover"><GameArt src={src} fallback={fallback}/><GameAvailabilityBadge game={game}/></span>;
}
export function GameAvailabilityBadge({ game, status, inline = false, iconOnly = !inline }: { game?: GameSummary; status?: GameAvailability; inline?: boolean; iconOnly?: boolean }) {
  const index = useGameAvailabilityIndex(), t = useT();
  const value = status ?? gameAvailability(index, game);
  if (!value) return null;
  const label = t("games.availability." + value);
  const Icon = value === "library" ? Library : value === "paused" ? Pause : Download;
  return <span className={"games-availability-badge" + (inline ? " is-inline" : "") + (iconOnly ? " is-mark" : "")} data-availability={value} title={label}>
    {value === "installed" ? <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4.5H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V12M9 17.5V21m6-3.5V21M7 21h10"/><path d="m14 5.5 2.5 2.5L21 3.5"/></svg> : <Icon size={13} aria-hidden="true"/>}
    <span className={iconOnly ? "sr-only" : undefined}>{label}</span>
  </span>;
}
