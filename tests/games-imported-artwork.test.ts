import assert from "node:assert/strict";
import test from "node:test";
import { artworkImportPolicy, importedArtworkFor, importedArtworkIcon, libraryBackground, parseImportedArtwork, prepareImportedArtwork, reviewImportedArtwork } from "../src/lib/games/imported-artwork.ts";
import { igdbArtworkCatalog } from "../src/lib/games/igdb-artwork.ts";
import { libraryMetadataMatch, libraryMetadataPresentation } from "../src/lib/games/library-metadata.ts";
import { customLinkedGame, emptyCustomLibrary, emptyLaunchConfig, parseCustomLibrary, upsertCustomGame } from "../src/lib/games/custom-library.ts";
import { EMPTY_EMULATION, parseEmulation, parseLocalMatch } from "../src/lib/games/emulation.ts";
import { changeLibraryMetadata, emptyLibraryPreferences, parseLibraryPreferences, patchLibraryMetadata, readLibraryPreferences } from "../src/lib/games/library-preferences.ts";
import { resolveDetailEdition } from "../src/lib/games/detail-edition.ts";

const images=igdbArtworkCatalog({cover:{image_id:"cover",width:900,height:1200},artworks:[{image_id:"first",width:4000,height:2000},{image_id:"last",width:1800,height:900}],screenshots:[{image_id:"shot",width:1280,height:720}]});
const policy=artworkImportPolicy({}), choice=prepareImportedArtwork(42,images,policy);
const game={id:"igdb:42",igdbId:42,steamId:999,name:"Reviewed edition",capsule:"",platforms:["Windows"],importedArtwork:choice};
test("artwork import defaults preserve Harbor fallback and normalize damaged settings",()=>{
  assert.deepEqual(policy,{selection:"first",screenshots:true,coverIcon:false});
  assert.deepEqual(artworkImportPolicy({gameArtworkSelection:"unknown",gameArtworkScreenshots:"false",gameArtworkCoverIcon:"true"}),policy);
  assert.deepEqual(artworkImportPolicy({gameArtworkSelection:"manual",gameArtworkScreenshots:false,gameArtworkCoverIcon:true}),{selection:"manual",screenshots:false,coverIcon:true});
});
test("imported random image includes the last candidate and survives serialization without rerolling",()=>{
  assert.equal(choice.background?.imageId,"first");let rolls=0;
  const result=prepareImportedArtwork(42,images,{...policy,selection:"random"},()=>{rolls++;return .999;});
  assert.equal(result.background?.imageId,"last");assert.deepEqual(parseImportedArtwork(JSON.parse(JSON.stringify(result)),42),result);assert.equal(rolls,1);
});
test("screenshot fallback is explicit and cannot accidentally reenter through the catalog hero",()=>{
  const shots=images.filter(image=>image.kind!=="artwork");
  assert.equal(prepareImportedArtwork(42,shots,policy).background?.kind,"screenshot");
  const disabled=prepareImportedArtwork(42,shots,{...policy,screenshots:false});assert.equal(disabled.background,null);
  assert.equal(libraryBackground(null,"catalog-screenshot","native-hero"),"native-hero");assert.equal(libraryBackground(null,"catalog-screenshot",""),"");
  assert.equal(libraryBackground(undefined,"legacy-hero","native-hero"),"legacy-hero");assert.equal(libraryBackground("chosen","catalog","native"),"chosen");
});
test("optional cover icons use bounded icon rendition and stay absent without a cover",()=>{
  assert.equal(importedArtworkIcon(choice),undefined);
  const icons=prepareImportedArtwork(42,images,{...policy,coverIcon:true});assert.match(importedArtworkIcon(icons)!,/t_thumb_2x\/cover\.jpg$/);
  assert.equal(importedArtworkIcon(prepareImportedArtwork(42,[],{...policy,coverIcon:true})),undefined);
});
test("manual review remains bound to the prepared edition and keeps automatic cover/icon choices",()=>{
  const prepared=prepareImportedArtwork(42,images,{...policy,coverIcon:true});
  const reviewed=reviewImportedArtwork(prepared,{binding:"igdb:42",igdbId:42,background:images[2]});
  assert.equal(reviewed.background?.imageId,"last");assert.deepEqual(reviewed.cover,prepared.cover);assert.deepEqual(reviewed.icon,prepared.icon);
  assert.deepEqual(reviewImportedArtwork(prepared,null),prepared);
  assert.throws(()=>reviewImportedArtwork(prepared,{binding:"igdb:99",igdbId:42,background:images[2]}));
});
test("stored imports reject wrong editions and malformed assets without retaining arbitrary authority",()=>{
  for(const bad of [null,{...choice,igdbId:43},{...choice,background:undefined},{...choice,background:0},{...choice,cover:false},{...choice,icon:false},{...choice,background:{kind:"cover",imageId:"bad"}},{...choice,icon:{kind:"cover",imageId:"../file"}}])assert.throws(()=>parseImportedArtwork(bad,42));
  assert.deepEqual(parseImportedArtwork({...choice,steamId:456,executable:"bad"},42),choice);
  assert.throws(()=>parseImportedArtwork({igdbId:-1,background:null},-1));
  assert.equal(importedArtworkFor({...game,igdbId:43}),undefined);
});
test("metadata and chosen artwork survive all three store projections together without changing launch identity",()=>{
  const match=libraryMetadataMatch(game),preferences=parseLibraryPreferences(JSON.stringify(patchLibraryMetadata(emptyLibraryPreferences(),"steam:7",match)));
  assert.deepEqual(preferences.entries["steam:7"].metadata?.importedArtwork,choice);
  const local={id:"11111111-1111-4111-8111-111111111111",name:"Local",config:{...emptyLaunchConfig(),executable:"D:/Games/local.exe"},linked:customLinkedGame(game),artwork:null,pinned:false,hidden:false,addedAt:1,lastPlayed:0,measuredSeconds:0};
  const custom=parseCustomLibrary(JSON.stringify(upsertCustomGame(emptyCustomLibrary(),local))).games[0];
  assert.deepEqual(custom.linked?.importedArtwork,choice);assert.deepEqual(custom.config,local.config);assert.equal(custom.linked?.id,"igdb:42");
  const rom=parseEmulation({...EMPTY_EMULATION(),matches:{"24:d:/games/a.gba":parseLocalMatch(game)!}});assert.deepEqual(rom.matches["24:d:/games/a.gba"].importedArtwork,choice);assert.equal(rom.matches["24:d:/games/a.gba"].steamId,undefined);
  const native={id:"steam:7",steamId:7,name:"Native",capsule:"",platforms:[]};const presentation=libraryMetadataPresentation(native,match);assert.equal(presentation.steamId,7);assert.equal(presentation.id,"steam:7");assert.deepEqual(presentation.importedArtwork,choice);
  assert.deepEqual(resolveDetailEdition(game,null,null).portableGame.importedArtwork,choice);
  assert.equal(customLinkedGame({...game,importedArtwork:{...choice,igdbId:43}}),null);assert.equal(parseLocalMatch({...game,importedArtwork:{...choice,igdbId:43}}),null);
});
test("failed metadata write cannot save its artwork independently and retry preserves the reviewed choice",async()=>{
  const values=new Map<string,string>();let fail=true;
  Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{if(fail)throw Error("full");values.set(k,v);}}});
  await assert.rejects(changeLibraryMetadata("art-import","steam:7",libraryMetadataMatch(game)));assert.deepEqual(readLibraryPreferences("art-import").entries,{});
  fail=false;await changeLibraryMetadata("art-import","steam:7",libraryMetadataMatch(game));assert.deepEqual(readLibraryPreferences("art-import").entries["steam:7"].metadata?.importedArtwork,choice);assert.deepEqual(readLibraryPreferences("other").entries,{});
});
