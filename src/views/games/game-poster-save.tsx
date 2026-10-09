import { Heart } from "lucide-react";
import { useT } from "@/lib/i18n";
import { gameIdentities } from "@/lib/games/recommendations";
import type { GameSummary } from "@/lib/games/types";
import { useOptionalGameAccess } from "./game-access";
import "./game-poster-save.css";

/** Keep this a sibling of the poster's open button, never a nested button. */
export function GamePosterSave({ game }: { game: GameSummary }) {
  const access = useOptionalGameAccess(), t = useT();
  if (!access) return null;
  const aliases = new Set(gameIdentities(game));
  const savedGame = access.saved.find(item => gameIdentities(item).some(id => aliases.has(id)));
  const label = t(savedGame ? "games.recommend.removeSaved" : "games.recommend.save", { name: game.name });
  return <button type="button" className="games-poster-save" aria-label={label} title={label} aria-pressed={!!savedGame}
    onClick={event => { event.stopPropagation(); access.save(savedGame ?? game); }}>
    <Heart size={16} fill={savedGame ? "currentColor" : "none"} aria-hidden="true"/>
  </button>;
}
