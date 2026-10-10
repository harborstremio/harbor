import {filterUnifiedLibrary, type UnifiedLibraryGame} from "./unified-library";
import {parseCollectionRules, type CollectionRules} from "./collection-rules";
import {customCollectionGame,romCollectionGame} from "./personal-collection-library";
import type {PersonalCollectionGame} from "./personal-collections";

/** Membership is derived, never copied into the persisted collection or matched by title. */
export function dynamicCollectionGames(rules:CollectionRules, library:UnifiedLibraryGame[]):PersonalCollectionGame[] {
  return filterUnifiedLibrary(library,{...parseCollectionRules(rules),sort:"recent"}).flatMap(item=>{
    if(item.quick?.source==="custom")return [customCollectionGame(item.quick.custom)];
    if(item.quick?.source==="retro")return [romCollectionGame(item.quick.local)];
    return item.game?[item.game]:[];
  });
}
