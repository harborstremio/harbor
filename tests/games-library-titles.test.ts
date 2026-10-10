import assert from 'node:assert/strict';
import test from 'node:test';
import {defaultLibraryTitleRules,libraryTitle,libraryTitleChanges,normaliseLibraryTitle,parseLibraryTitleRules,reviewLibraryTitles} from '../src/lib/games/library-titles.ts';
import {changeLibraryPreferences,changeLibraryTitles,emptyLibraryPreferences,libraryPreferenceKey,parseLibraryPreferences,patchLibraryPreferences,patchLibraryTitles,readLibraryPreferences} from '../src/lib/games/library-preferences.ts';
import {quickLibrary,filterQuickLibrary} from '../src/lib/games/quick-library.ts';
import {unifiedLibrary,filterUnifiedLibrary,unifiedLibraryDefaults,type UnifiedLibraryInput} from '../src/lib/games/unified-library.ts';
import {EMPTY_EMULATION} from '../src/lib/games/emulation.ts';
import {emptyLaunchConfig} from '../src/lib/games/custom-library.ts';

const rules=()=>defaultLibraryTitleRules();
test('title cleanup preserves edition words, whitespace boundaries, punctuation and numeric ordinals',()=>{
  const expected=new Map([
    ['  GRAND THEFT AUTO V LEGACY  ','Grand Theft Auto V Legacy'],
    ['GRAND THEFT AUTO V ENHANCED','Grand Theft Auto V Enhanced'],
    ['THE LORD OF THE RINGS: THE RETURN OF THE KING','The Lord of the Rings: The Return of the King'],
    ["TOM CLANCY’S RAINBOW SIX SIEGE","Tom Clancy’s Rainbow Six Siege"],
    ['CRASH TEAM RACING NITRO-FUELED','Crash Team Racing Nitro-Fueled'],
    ['25TH ANNIVERSARY HD EDITION','25th Anniversary HD Edition'],
    ['「FINAL FANTASY xiv」','「Final Fantasy XIV」'],
    ['中文遊戲 日本語ゲーム','中文遊戲 日本語ゲーム'],
    ['chapter:the end of time','Chapter:The End of Time'],
  ]);
  for(const [name,result] of expected)assert.equal(normaliseLibraryTitle(name,rules()),result,name);
});
test('standalone dashes are optional and never modify hyphenated words or earlier repeated words',()=>{
  const r={...rules(),dashToColon:true};
  assert.equal(normaliseLibraryTitle('RACING - THE NITRO-FUELED EDITION',r),'Racing: The Nitro-Fueled Edition');
  assert.equal(normaliseLibraryTitle('GAME GAME - THE GAME',r),'Game Game: The Game');
  assert.equal(normaliseLibraryTitle('- GAME',r),'- Game');
  assert.equal(normaliseLibraryTitle('GAME - THE GAME',rules()),'Game - the Game');
});
test('ignored terms retain spelling; custom acronyms work first, after punctuation and through locale changes',()=>{
  const r={...rules(),ignored:'NieR eFootball mix',uppercase:'rpg VR'};
  assert.equal(normaliseLibraryTitle('rpg NieR: AUTOMATA and eFootball in vr mix',r),'RPG NieR: Automata and eFootball in VR mix');
  assert.equal(normaliseLibraryTitle('istanbul iii hd',{...rules(),locale:'tr'}),'İstanbul III HD');
  assert.equal(normaliseLibraryTitle('ÉTÉ: À LA MER',{...rules(),locale:'fr'}),'Été: À La Mer');
});
test('rule validation bounds user inputs and accepts only current stable game identities',()=>{
  const valid=(id:string)=>/^steam:\d+$/.test(id);
  assert.deepEqual(parseLibraryTitleRules({...rules(),existingIds:['steam:620','steam:620']},valid),{...rules(),existingIds:['steam:620']});
  for(const bad of [{...rules(),locale:'not a locale'},{...rules(),ignored:'a'.repeat(2001)},{...rules(),uppercase:'a\0b'},{...rules(),existingIds:['path:../../secret']},{...rules(),automatic:'yes'}])assert.throws(()=>parseLibraryTitleRules(bad,valid),/library_prefs_read/);
});
test('automatic rules affect future identities; explicit original/title wins and profiles use their own rules',()=>{
  const r={...rules(),automatic:true,existingIds:['steam:620']};
  assert.equal(libraryTitle('steam:620','PORTAL 2',undefined,r),'PORTAL 2');
  assert.equal(libraryTitle('steam:730','COUNTER-STRIKE 2',undefined,r),'Counter-Strike 2');
  assert.equal(libraryTitle('steam:730','COUNTER-STRIKE 2',{title:null},r),'COUNTER-STRIKE 2');
  assert.equal(libraryTitle('steam:730','COUNTER-STRIKE 2',{title:'My title'},r),'My title');
  assert.equal(libraryTitle('steam:730','COUNTER-STRIKE 2',undefined,rules()),'COUNTER-STRIKE 2');
});
test('review deduplicates identities, derives from provider titles and leaves unchanged rows explicit',()=>{
  const items=[{id:'steam:620',name:'User override',original:'PORTAL 2'},{id:'steam:730',name:'Counter-Strike 2',original:'COUNTER-STRIKE 2'}];
  const before=structuredClone(items),review=reviewLibraryTitles([...items,items[0]],rules());
  assert.equal(review.length,2);assert.deepEqual(review.map(row=>[row.next,row.changed]),[['Portal 2',true],['Counter-Strike 2',false]]);assert.deepEqual(items,before);
  assert.equal(reviewLibraryTitles(items,rules(),true)[0].next,'PORTAL 2');
});

test('changing automatic rules for a selection preserves already formatted unselected names',()=>{
  const previous={...rules(),automatic:true,existingIds:['steam:620']};
  const items=[{id:'steam:620',name:'PORTAL 2',original:'PORTAL 2'},{id:'steam:999',name:'Final Fantasy XIV',original:'FINAL FANTASY xiv'}];
  const next={...previous,ignored:'FINAL FANTASY xiv',existingIds:items.map(item=>item.id)};
  const changes=libraryTitleChanges(items,reviewLibraryTitles(items.slice(0,1),next),{},next,false);
  const store=patchLibraryTitles({...emptyLibraryPreferences(),titleRules:previous},changes,next,previous);
  assert.equal(libraryTitle('steam:620','PORTAL 2',store.entries['steam:620'],store.titleRules),'Portal 2');
  assert.equal(libraryTitle('steam:999','FINAL FANTASY xiv',store.entries['steam:999'],store.titleRules),'Final Fantasy XIV');
  const disabled={...next,automatic:false,existingIds:[]};
  assert.deepEqual(libraryTitleChanges([{...items[1],name:'Final Fantasy XIV'}],[],store.entries,disabled,false),[]);
  assert.equal(libraryTitle('steam:1000','FINAL FANTASY xiv',undefined,next),'FINAL FANTASY xiv');
});
test('old preference data stays compatible; title commits preserve covers, status, pins and hidden state',()=>{
  const old={version:1 as const,entries:{'steam:620':{pinned:true,hidden:true,cover:'D:/art/portal.png',playStatus:'playing' as const}}};
  assert.deepEqual(parseLibraryPreferences(JSON.stringify(old)),old);
  const next=patchLibraryTitles(old,[{id:'steam:620',title:'Portal 2'}],rules(),undefined);
  assert.deepEqual(next.entries['steam:620'],{...old.entries['steam:620'],title:'Portal 2'});assert.deepEqual(old.entries['steam:620'],{pinned:true,hidden:true,cover:'D:/art/portal.png',playStatus:'playing'});
  const pinned=patchLibraryPreferences(next,['steam:620'],{pinned:false});assert.equal(pinned.entries['steam:620'].title,'Portal 2');assert.deepEqual(pinned.titleRules,rules());
});
test('all-source title identities, explicit original opt-outs and corrupt values are validated',()=>{
  for(const id of ['steam:620','igdb:123','custom:11111111-1111-4111-8111-111111111111','rom:7:D:/ROMs/title.rom']){
    const next=patchLibraryTitles(emptyLibraryPreferences(),[{id,title:null}],rules(),undefined);assert.equal(next.entries[id].title,null);assert.equal(patchLibraryPreferences(next,[id],{pinned:false}).entries[id].title,null);
  }
  for(const title of ['', ' '.repeat(5),'x'.repeat(501),'line\nline',5])assert.throws(()=>patchLibraryTitles(emptyLibraryPreferences(),[{id:'steam:620',title:title as string}],rules(),undefined));
  assert.throws(()=>patchLibraryTitles(emptyLibraryPreferences(),[{id:'invalid',title:'Title'}],rules(),undefined));
});
test('title and rule conflicts abort the whole change while unrelated preference edits merge',()=>{
  const start=patchLibraryTitles(emptyLibraryPreferences(),[{id:'steam:620',title:'Portal 2'}],rules(),undefined);
  assert.throws(()=>patchLibraryTitles(start,[{id:'steam:620',title:null}],rules(),rules()),/library_title_conflict/);
  assert.throws(()=>patchLibraryTitles(start,[],{...rules(),automatic:true},undefined),/library_title_conflict/);
  const unrelated=patchLibraryPreferences(start,['steam:620'],{pinned:true});
  const next=patchLibraryTitles(unrelated,[{id:'steam:620',title:null,expectedTitle:'Portal 2'}],rules(),rules());assert.equal(next.entries['steam:620'].pinned,true);
});
test('serialized writes persist/reload per profile and quota failures leave the entire previous document intact',async()=>{
  const data=new Map<string,string>();let failed=false;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{if(failed)throw Error('quota');data.set(key,value);}}});
  Object.defineProperty(globalThis,'window',{configurable:true,value:{dispatchEvent:()=>true}});
  await Promise.all([changeLibraryPreferences('title-a',['steam:620'],{pinned:true}),changeLibraryTitles('title-a',[{id:'steam:620',title:'Portal 2'}],rules(),undefined)]);
  assert.equal(readLibraryPreferences('title-a').entries['steam:620'].pinned,true);assert.equal(readLibraryPreferences('title-a').entries['steam:620'].title,'Portal 2');assert.deepEqual(readLibraryPreferences('title-b'),emptyLibraryPreferences());
  const raw=data.get(libraryPreferenceKey('title-a'));failed=true;
  await assert.rejects(changeLibraryTitles('title-a',[{id:'steam:620',title:null,expectedTitle:'Portal 2'}],rules(),rules()),/quota/);assert.equal(data.get(libraryPreferenceKey('title-a')),raw);
  failed=false;await changeLibraryTitles('title-a',[{id:'steam:620',title:null,expectedTitle:'Portal 2'}],rules(),rules());assert.equal(readLibraryPreferences('title-a').entries['steam:620'].title,null);
});

test('all library identities share display titles without mutating launch, ownership or edition records',()=>{
  const customId='11111111-1111-4111-8111-111111111111';
  const data:UnifiedLibraryInput={
    installed:[{appId:42,name:'GAME HD',installPath:'D:/Games/Game',libraryPath:'D:/Games',sizeBytes:100,lastPlayed:0,state:'installed'}],steamKnown:true,
    account:{steamId:'123',name:'Account',avatar:'',libraryVisible:true,updatedAt:1,games:[{appId:42,name:'GAME HD',minutes:10,recentMinutes:0,lastPlayed:1},{appId:43,name:'GRAND THEFT AUTO V LEGACY',minutes:0,recentMinutes:0,lastPlayed:0}]},
    custom:[{id:customId,name:'CUSTOM GAME',config:emptyLaunchConfig(),linked:null,artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:0,measuredSeconds:0}],
    retro:{...EMPTY_EMULATION(),folders:[{id:'f',root:'D:/ROMs',system:24,games:[{path:'D:/ROMs/game.gba',name:'ROM GAME',system:24,available:true,format:'gba',discs:1,sizeBytes:100}],skipped:0,limited:false,scannedAt:1}]},
    shortcuts:[{id:'steam-shortcut:123:2147483648',accountId:123,appId:2147483648,runGameId:'9223372036854775808',name:'SHORTCUT GAME',executable:'D:/short.exe',startDirectory:'D:/',launchOptions:'--test',hidden:false,lastPlayed:0,tags:[],state:'ready',artwork:{}}],
    launchers:{supported:true,clients:[{launcher:'gog',installed:true}],warnings:[],games:[{id:'gog:123',launcher:'gog',productId:'123',name:'GOG GAME',installPath:'D:/Gog',state:'installed',launchMode:'play'}]},launchersKnown:true,
    steamImports:[{game:{id:'steam:44',steamId:44,name:'IMPORTED GAME',capsule:'',platforms:[]},addedAt:1}],preferences:emptyLibraryPreferences(),
  };
  const original=unifiedLibrary(data),changes=original.map((item,index)=>({id:item.id,title:`Display ${String(index).padStart(2,'0')}`}));
  data.preferences=patchLibraryTitles(data.preferences,changes,rules(),undefined);const before=structuredClone(data);
  const items=unifiedLibrary(data),quick=quickLibrary(data.installed,data.custom,data.retro,[],data.preferences,data.launchers,{shortcuts:data.shortcuts});
  for(const item of items){assert.equal(item.name,changes.find(change=>change.id===item.id)?.title);assert.equal(item.originalName,original.find(value=>value.id===item.id)?.name);}
  for(const item of quick)assert.equal(item.name,items.find(value=>value.id===item.id)?.name);
  assert.deepEqual(data,before);assert.equal(items.find(item=>item.id==='steam:42')?.owned?.minutes,10);assert.equal(items.find(item=>item.id==='steam:43')?.game?.name,'GRAND THEFT AUTO V LEGACY');
  assert.deepEqual(filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),query:'grand theft'}).map(item=>item.id),['steam:43']);
  assert.deepEqual(filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),query:'Display 00'}).map(item=>item.id),[changes[0].id]);
  assert.deepEqual(filterUnifiedLibrary(items,{...unifiedLibraryDefaults(),sort:'name'}).map(item=>item.name),changes.map(change=>change.title));
  assert.deepEqual(filterQuickLibrary(quick,{query:'SHORTCUT GAME',source:'all',group:'all',ready:false,sort:'name'}).map(item=>item.id),['steam-shortcut:123:2147483648']);
});
