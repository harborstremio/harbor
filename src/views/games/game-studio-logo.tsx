import type { GameConnection } from "@/lib/games/igdb-data";
import { GameArt } from "./game-art";
import { STUDIO_MARKS } from "@/lib/games/studio-artwork";

export function StudioLogo({ studio, className = "" }: { studio: GameConnection; className?: string }) {
  const source=STUDIO_MARKS[studio.id]??studio.image;
  return source ? <GameArt className={`${className}${[139,305,908,56,104,401,834,928,7263].includes(studio.id) ? " games-brand-light" : ""}`} src={source} fallback={studio.image} eager/> : null;
}
