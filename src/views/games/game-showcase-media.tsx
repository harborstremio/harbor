import { useEffect, useState, type CSSProperties } from "react";
import type { GameDetail } from "@/lib/games/types";
import { gameHeroPreviewAllowed, gameHeroSources } from "@/lib/games/hero-art";
import { GameHeroVideo } from "./game-hero-video";

/* Hero storyboard, measured from the new artwork being ready:
 *    0ms  decoded artwork fades over the previous scene
 * 1200ms  start muted preview; reveal only after the playing event
 *30000ms  the showcase may advance if the user is not interacting
 */
export const HERO_TIMING = {
  artworkFade: 800, // Keep the previous art behind the new scene.
  videoStart: 1200, // Give the logo and still artwork a quiet first beat.
  videoFade: 800,   // Reveal a decoded, playing video over its still.
  nextGame: 30000,  // Allow time to read, inspect ratings, and watch the preview.
};

type Scene = { id: string; appId: number; art: string };

export function GameShowcaseMedia({ game, playing, onReady }: { game: GameDetail; playing: boolean; onReady: (id: string) => void }) {
  const [scenes, setScenes] = useState<Scene[]>([]);
  useEffect(() => {
    let current = true;
    const image = new Image();
    void (async () => {
      let art = "";
      for (const source of gameHeroSources(game)) {
        image.src = source;
        if (await image.decode().then(() => true, () => false)) { art = source; break; }
        if (!current) return;
      }
      if (current) {
        setScenes(previous => {
          const scene = { id: game.id, appId: game.steamId, art };
          return previous.at(-1)?.id === game.id ? [...previous.slice(0, -1), scene] : [...previous.slice(-1), scene];
        });
        onReady(game.id);
      }
    })();
    return () => { current = false; image.src = ""; };
  }, [game.id, game.steamId, game.libraryHero, game.hero, onReady]);

  return <div className="games-showcase-scenes" aria-hidden="true" style={{"--hero-scene-fade":`${HERO_TIMING.artworkFade}ms`,"--hero-video-fade":`${HERO_TIMING.videoFade}ms`} as CSSProperties}>
    {scenes.map((scene, index) => <div key={scene.id} className="games-home-scene" data-game={scene.id} onAnimationEnd={event => {
      if (event.target === event.currentTarget && index === scenes.length - 1) setScenes(previous => previous.slice(-1));
    }}>
      {scene.art && <img className="games-showcase-art is-active" src={scene.art} alt="" decoding="async" />}
      {gameHeroPreviewAllowed(scene.appId) && <GameHeroVideo appId={scene.appId} playing={playing && scene.id === game.id && index === scenes.length - 1} startDelayMs={HERO_TIMING.videoStart}/>}
    </div>)}
  </div>;
}
