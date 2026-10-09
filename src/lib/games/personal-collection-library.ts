import type { CustomGame } from "./custom-library";
import { EMULATION_SYSTEMS, localGames, type EmulationStore, type LocalGame } from "./emulation";
import { romPreferenceId } from "./library-preferences";
import type { PersonalCollectionGame } from "./personal-collections";

export function customCollectionGame(game: CustomGame): PersonalCollectionGame {
  return {id:`custom:${game.id}`,name:game.name,capsule:game.linked?.capsule??"",portrait:game.linked?.portrait,platforms:game.linked?.platforms??[],local:{kind:"custom",id:game.id}};
}
export function romCollectionGame(game: LocalGame): PersonalCollectionGame {
  return {id:romPreferenceId(game.system,game.path),name:game.linked?.name??game.name,capsule:game.linked?.capsule??"",portrait:game.linked?.portrait,platforms:[EMULATION_SYSTEMS.find(s=>s.id===game.system)?.name??""],local:{kind:"rom",system:game.system,path:game.path}};
}
export type ResolvedCollectionGame = {game:PersonalCollectionGame;custom?:CustomGame;rom?:ReturnType<typeof localGames>[number]};

/** Resolve exact, profile-local references once; a catalog match or shared name never chooses a launch target. */
export function resolveCollectionLibrary(games: PersonalCollectionGame[], custom: CustomGame[], retro: EmulationStore): Record<string,ResolvedCollectionGame> {
  const pc=new Map(custom.map(game=>[game.id,game]));
  const roms=new Map(localGames(retro).map(game=>[romPreferenceId(game.system,game.path),game]));
  return Object.fromEntries(games.map(game=>{
    const current=game.local?.kind==="custom"?pc.get(game.local.id):undefined;
    const rom=game.local?.kind==="rom"?roms.get(game.id):undefined;
    // Missing entries keep their readable snapshot and membership, never another copy's launch target.
    return [game.id,{game:current?customCollectionGame(current):rom?romCollectionGame(rom):game,custom:current,rom}];
  }));
}
