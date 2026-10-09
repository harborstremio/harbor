import assert from "node:assert/strict";
import test from "node:test";
import { pathDrive, installationDrive, libraryDrives } from "../src/lib/games/library-drives.ts";
import { filterUnifiedLibrary, unifiedLibrary, unifiedLibraryDefaults } from "../src/lib/games/unified-library.ts";
import { emptyLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { EMPTY_EMULATION } from "../src/lib/games/emulation.ts";
import { emptyLaunchConfig } from "../src/lib/games/custom-library.ts";
import { launchHealthObservation } from "../src/lib/games/custom-launch-health.ts";

function library() {
  const config={...emptyLaunchConfig(),executable:"E:/Games/Copy/game.exe"};
  return unifiedLibrary({
    installed:[{appId:42,name:"Steam game",installPath:"D:/Games/steamapps/common/Game",libraryPath:"D:/Games",sizeBytes:100,lastPlayed:0,state:"installed"}],steamKnown:true,launchersKnown:true,
    custom:[{id:"copy",name:"Local copy",config,linked:null,artwork:null,pinned:false,hidden:false,addedAt:0,lastPlayed:0,measuredSeconds:0}],customHealth:{copy:launchHealthObservation(config)},
    retro:EMPTY_EMULATION(),preferences:emptyLibraryPreferences(),
    account:{steamId:"123",name:"Account",avatar:"",updatedAt:1,libraryVisible:true,games:[{appId:43,name:"Cloud game",minutes:0,recentMinutes:0,lastPlayed:0}]},
    launchers:{supported:true,clients:[{launcher:"gog",installed:true}],warnings:[],games:[{id:"gog:123",productId:"123",launcher:"gog",name:"GOG game",installPath:"\\\\Server\\Games\\Game",state:"missing",launchMode:"play"}]},
    shortcuts:[{id:"steam-shortcut:123:2147483649",accountId:123,appId:2147483649,runGameId:"1",name:"Shortcut",executable:'"C:\\Windows\\wrapper.exe"',startDirectory:'"d:\\Games\\Shortcut"',launchOptions:"",hidden:false,lastPlayed:0,tags:[],state:"ready",artwork:{}}],
  });
}

test("drive letters and extended Windows paths share stable roots; network shares stay distinct",()=>{
  for(const value of ['d:/Games/game.exe','D:\\Games\\game.exe','"d:\\Game with spaces\\game.exe"','\\\\?\\d:\\Games\\game.exe'])assert.deepEqual(pathDrive(value),{id:'D:',label:'D:\\'});
  assert.deepEqual(pathDrive('\\\\?\\UNC\\Server\\Games\\game.exe'),{id:'\\\\server\\games',label:'\\\\Server\\Games'});
  assert.equal(pathDrive('//server/GAMES/Game')?.id,pathDrive('\\\\SERVER\\games')?.id);
  assert.notEqual(pathDrive('//server/games/Game')?.id,pathDrive('//server/other/Game')?.id);
});
test("relative paths, URLs, device namespaces and POSIX folders do not invent Windows drives",()=>{
  for(const value of [undefined,null,'','game.exe','D:relative','https://server/game.exe','/mnt/games/file','/Volumes/Drive/game','\\\\.\\pipe\\game','\\\\?\\Volume{abc}\\game','\\\\server','\\\\server\\..','D:/bad\u0000file'])assert.equal(pathDrive(value),undefined,String(value));
});
test("each provider contributes its actual installation path; shortcut wrappers use the game working directory",()=>{
  const games=library();
  assert.equal(installationDrive(games.find(game=>game.source==='steam'&&game.quick)!)?.id,'D:');
  assert.equal(installationDrive(games.find(game=>game.source==='custom')!)?.id,'E:');
  assert.equal(installationDrive(games.find(game=>game.source==='gog')!)?.id,'\\\\server\\games');
  assert.equal(installationDrive(games.find(game=>game.source==='shortcut')!)?.id,'D:');
  assert.equal(installationDrive(games.find(game=>game.id==='steam:43')!),undefined);
  const retro={...games[0],quick:{...games[0].quick!,source:'retro' as const,local:{path:'R:/Roms/game.gba'}}} as never;
  assert.equal(installationDrive(retro)?.id,'R:');
});
test("drive filtering intersects source, availability and query while preserving unknown locations",()=>{
  const games=library(),defaults=unifiedLibraryDefaults();
  assert.equal(filterUnifiedLibrary(games,{...defaults,drive:'D:'}).length,2);
  assert.deepEqual(filterUnifiedLibrary(games,{...defaults,drive:'D:',source:'steam'}).map(game=>game.id),['steam:42']);
  assert.equal(filterUnifiedLibrary(games,{...defaults,drive:'D:',query:'Shortcut'}).length,1);
  assert.equal(filterUnifiedLibrary(games,{...defaults,drive:'\\\\server\\games',availability:'ready'}).length,0);
  assert.equal(filterUnifiedLibrary(games,{...defaults,drive:'\\\\server\\games',availability:'attention'}).length,1);
  assert.deepEqual(filterUnifiedLibrary(games,{...defaults,drive:'unassigned'}).map(game=>game.id),['steam:43']);
  assert.equal(filterUnifiedLibrary(games,{...defaults,drive:undefined}).length,games.length);
});
test("a move changes derived drive membership without modifying personal data or adding stale tags",()=>{
  const games=library(),before=structuredClone(games),copy=games.find(game=>game.quick?.source==='custom')!;
  const moved=games.map(game=>game===copy?{...game,quick:{...copy.quick!,custom:{...(copy.quick as any).custom,config:{...(copy.quick as any).custom.config,executable:'F:/Moved/game.exe'}}}}:game);
  assert.deepEqual(libraryDrives(games).map(drive=>drive.id),['\\\\server\\games','D:','E:']);
  assert.ok(!libraryDrives(moved).some(drive=>drive.id==='E:'));assert.ok(libraryDrives(moved).some(drive=>drive.id==='F:'));
  assert.equal(filterUnifiedLibrary(moved,{...unifiedLibraryDefaults(),drive:'E:'}).length,0);
  assert.deepEqual(games,before);
});
test("a selected removed drive stays selectable and empty, never silently widens the results",()=>{
  assert.deepEqual(libraryDrives([], 'W:'),[{id:'W:',label:'W:\\'}]);
  assert.deepEqual(libraryDrives([], '\\\\server\\share'),[{id:'\\\\server\\share',label:'\\\\server\\share'}]);
  assert.deepEqual(libraryDrives([], 'unassigned'),[]);
  assert.equal(filterUnifiedLibrary(library(),{...unifiedLibraryDefaults(),drive:'W:'}).length,0);
});
