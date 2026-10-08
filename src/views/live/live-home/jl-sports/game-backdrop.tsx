import { useState } from "react";
import type { SportsGame } from "@/lib/sports/espn";
import { useGameFanart } from "./use-sports-extras";

/**
 * TheSportsDB fan art behind a game (the viewer's key), faded toward the text so it stays
 * readable. Renders nothing without a key or art, leaving the ESPN look as it was.
 */
export function GameBackdrop({ game, surface = "canvas" }: { game: SportsGame; surface?: "canvas" | "elevated" }) {
  const art = useGameFanart(game);
  const [failed, setFailed] = useState<string | null>(null);
  if (!art || failed === art) return null;
  const side =
    surface === "canvas"
      ? "from-canvas via-canvas/80 to-canvas/20"
      : "from-elevated via-elevated/85 to-elevated/40";
  const bottom = surface === "canvas" ? "from-canvas/90" : "from-elevated/95";
  return (
    <div aria-hidden className="animate-fade-in pointer-events-none absolute inset-0">
      <img
        src={art}
        alt=""
        draggable={false}
        loading="lazy"
        onError={() => setFailed(art)}
        className="h-full w-full object-cover opacity-50"
      />
      <div className={`absolute inset-0 bg-gradient-to-r rtl:bg-gradient-to-l ${side}`} />
      <div className={`absolute inset-0 bg-gradient-to-t via-transparent to-transparent ${bottom}`} />
    </div>
  );
}
