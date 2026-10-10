import assert from "node:assert/strict";
import test from "node:test";
import { LAUNCHER_NAMES, type GameLauncher, type LauncherGame } from "../src/lib/games/launchers.ts";
import { UNIFIED_SOURCES, filterUnifiedLibrary, unifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { parseCollectionRules } from "../src/lib/games/collection-rules.ts";
import { emptyLibraryPreferences, patchLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";

const products: Record<GameLauncher, string> = {
  battlenet:"wow", ea:"offer.123", ubisoft:"1770", epic:"namespace:catalog:application",
  gog:"1207664643", riot:"valorant:live", rockstar:"rdr2", rsi:"star-citizen:live", bsg:"eft",
  itch:"123:01234567-89ab-4cde-8123-456789abcdef",
};
const games: LauncherGame[] = (Object.keys(LAUNCHER_NAMES) as GameLauncher[]).map(launcher => ({
  id:`${launcher}:${products[launcher]}`,launcher,productId:products[launcher],name:"Shared title",
  installPath:`W:/review/${launcher}`,state:"installed",launchMode:"client",
}));
function input() {
  return { installed:[],steamKnown:true,custom:[],retro:EMPTY_EMULATION(),launchersKnown:true,
    preferences:emptyLibraryPreferences(),launchers:{supported:true,clients:games.map(game=>({launcher:game.launcher,installed:true})),games,warnings:[]} };
}

test("every detected launcher is individually filterable and valid in persisted collection rules", () => {
  const library = unifiedLibrary(input());
  assert.equal(library.length, games.length, "matching names must not merge installations");
  for (const game of games) {
    assert.ok(UNIFIED_SOURCES.includes(game.launcher));
    const rules = parseCollectionRules({...unifiedLibraryDefaults(),source:game.launcher});
    assert.deepEqual(filterUnifiedLibrary(library,{...unifiedLibraryDefaults(),...rules}).map(item=>item.id),[game.id]);
  }
  assert.throws(()=>parseCollectionRules({...unifiedLibraryDefaults(),source:"unknown-provider"}));
});

test("new launcher preferences persist by exact copy and source filters never borrow another launcher's state", () => {
  const data=input();
  data.preferences=patchLibraryPreferences(data.preferences,["rsi:star-citizen:live"],{pinned:true,playStatus:"playing"});
  const library=unifiedLibrary(data);
  assert.equal(library.find(game=>game.source==="rsi")?.favorite,true);
  assert.equal(library.find(game=>game.source==="bsg")?.favorite,false);
  assert.equal(library.find(game=>game.source==="rsi")?.playStatus,"playing");
  assert.deepEqual(filterUnifiedLibrary(library,{...unifiedLibraryDefaults(),source:"bsg",playStatus:"playing"}),[]);
});

test("unknown or missing new-launcher installs remain discoverable without claiming ready-to-play", () => {
  const data=input();
  data.launchers.games=games.filter(game=>["rsi","bsg"].includes(game.launcher));
  data.launchers.games=[{...data.launchers.games[0],state:"missing"},data.launchers.games[1]];
  assert.equal(unifiedLibrary(data).find(game=>game.source==="rsi")?.state,"unavailable");
  assert.equal(unifiedLibrary(data).find(game=>game.source==="bsg")?.state,"client");
  assert.ok(unifiedLibrary({...data,launchersKnown:false}).every(game=>game.state==="unknown"));
});
