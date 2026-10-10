import assert from "node:assert/strict";
import test from "node:test";
import { changeLibraryPreferences, emptyLibraryPreferences, libraryPreferenceKey, libraryPreferenceVisible, parseLibraryPreferences, patchLibraryPreferences, readLibraryPreferences, romPreferenceId } from "../src/lib/games/library-preferences.ts";

test("library identities keep Steam and separate ROM copies independent",()=>{
 const rom=romPreferenceId(24,"W:\\Games\\Garden.gba"),other=romPreferenceId(24,"F:\\Games\\Garden.gba");
 let store=patchLibraryPreferences(emptyLibraryPreferences(),["steam:42",rom],{pinned:true});store=patchLibraryPreferences(store,[rom],{hidden:true});
 assert.equal(store.entries["steam:42"].hidden,false);assert.equal(store.entries[other],undefined);assert.equal(libraryPreferenceVisible(store.entries[rom],"visible"),false);assert.equal(libraryPreferenceVisible(store.entries[rom],"pinned"),false);assert.equal(libraryPreferenceVisible(store.entries[rom],"hidden"),true);
 store=patchLibraryPreferences(store,[rom],{hidden:false,pinned:false});assert.equal(store.entries[rom],undefined);
});
test("malformed preferences and active-scheme images cannot replace existing data",()=>{
 for(const raw of ['{broken','{"version":2,"entries":{}}','{"version":1,"entries":{"__proto__":{}}}',JSON.stringify({version:1,entries:{"steam:42":{pinned:true,hidden:false,cover:"javascript:alert(1)"}}})]){
  assert.throws(()=>parseLibraryPreferences(raw),/library_prefs_read/);
 }
 assert.throws(()=>patchLibraryPreferences(emptyLibraryPreferences(),["../other"],{hidden:true}));assert.throws(()=>patchLibraryPreferences(emptyLibraryPreferences(),Array.from({length:5001},(_,i)=>`steam:${i+1}`),{pinned:true}),/library_prefs/);
 assert.equal(patchLibraryPreferences(emptyLibraryPreferences(),["steam:42"],{cover:"W:/Art/日本.png"}).entries["steam:42"].cover,"W:/Art/日本.png");
});
test("concurrent profile writes merge and corrupt storage is preserved",async()=>{
 const values=new Map<string,string>();Object.defineProperty(globalThis,"localStorage",{configurable:true,value:{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)}});
 await Promise.all([changeLibraryPreferences("one",["steam:42"],{pinned:true}),changeLibraryPreferences("one",["steam:43"],{hidden:true})]);assert.equal(Object.keys(readLibraryPreferences("one").entries).length,2);assert.equal(Object.keys(readLibraryPreferences("two").entries).length,0);
 values.set(libraryPreferenceKey("one"),"corrupt original");await assert.rejects(changeLibraryPreferences("one",["steam:42"],{hidden:true}),/library_prefs_read/);assert.equal(values.get(libraryPreferenceKey("one")),"corrupt original");
});
