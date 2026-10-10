import { loadGameFranchise, type GameFranchise, type GameFranchisePage } from "./franchises";
import { preloadGameArt } from "./preload-art";

export type PreparedWorld = { world: GameFranchise; page: GameFranchisePage };

/** Hold the current scene until the next hero and visible posters decode. */
export async function prepareGameWorld(world: GameFranchise, slots: number, signal: AbortSignal): Promise<PreparedWorld> {
  const page=await loadGameFranchise(world.id,0,signal);
  signal.throwIfAborted();
  const [hero]=await Promise.all([
    preloadGameArt(world.hero,signal),
    ...page.games.slice(0,Math.max(1,Math.min(24,slots))).map(async game=>{
      if(!await preloadGameArt(game.portrait??game.capsule,signal))await preloadGameArt(game.capsule,signal);
    }),
  ]);
  signal.throwIfAborted();
  if(!hero)throw Error("World artwork unavailable");
  return {world,page};
}
