import assert from "node:assert/strict";import test from "node:test";
import{addCollectionGame,changePersonalCollections,collectionHasGame,createPersonalCollection,emptyPersonalCollections,parsePersonalCollections,personalCollectionsKey,readPersonalCollections,removeCollectionGame,removePersonalCollection,updatePersonalCollection}from"../src/lib/games/personal-collections.ts";
const game=(id:number,other={})=>({id:`steam:${id}`,steamId:id,name:`Game ${id}`,capsule:`https://shared.akamai.steamstatic.com/steam/apps/${id}/header.jpg`,platforms:["Windows"],...other});
const collection=()=>createPersonalCollection(emptyPersonalCollections(),"Long weekends","one",1);
test("collections retain original IGDB editions alongside Steam ports sharing their metadata",()=>{
 let store=createPersonalCollection(collection(),"Handheld","two",2);store=addCollectionGame(store,"one",game(10,{id:"igdb:11",igdbId:11}));store=addCollectionGame(store,"two",game(10,{igdbId:11}));assert.deepEqual(store.collections.find(c=>c.id==="one")?.gameIds,["igdb:11"]);assert.equal(Object.keys(store.games).length,2);assert.ok(collectionHasGame(store,store.collections[0],game(10)));assert.equal(store.games['igdb:11'].steamId,undefined);assert.equal(collectionHasGame(store,store.collections.find(c=>c.id==="one")!,game(10,{igdbId:11})),false);
 store=addCollectionGame(store,"one",game(12,{igdbId:11}));assert.deepEqual(store.collections.find(c=>c.id==="one")?.gameIds,["steam:12","igdb:11"]);assert.equal(Object.keys(store.games).length,3);
 store=addCollectionGame(store,"two",game(0,{steamId:undefined,id:"igdb:11",igdbId:11}));assert.equal(Object.keys(store.games).length,3);assert.ok(store.games['steam:10']);assert.ok(store.games['steam:12']);assert.deepEqual(parsePersonalCollections(JSON.stringify(store)).collections,store.collections);
});
test("removing a membership or collection retains every other reference and does not affect Saved",()=>{
 let store=addCollectionGame(createPersonalCollection(collection(),"Later","two"),"one",game(1));store=addCollectionGame(store,"two",game(1));const saved=[game(1)];store=removeCollectionGame(store,"one","steam:1");assert.ok(store.games['steam:1']);store=removePersonalCollection(store,"two");assert.deepEqual(store.games,{});assert.equal(saved.length,1);assert.equal(store.collections.length,1);
});
test("names, descriptions, limits and corrupted persisted references are validated",()=>{
 const store=collection();assert.throws(()=>createPersonalCollection(store," long WEEKENDS ","two"),/duplicate/);assert.throws(()=>updatePersonalCollection(store,"one",{name:" "}),/name/);assert.throws(()=>updatePersonalCollection(store,"one",{description:"x".repeat(241)}),/name/);
 const updated=updatePersonalCollection(store,"one",{name:"New name",pinned:true});assert.equal(updated.collections[0].pinned,true);assert.equal(parsePersonalCollections(JSON.stringify(updated)).collections[0].name,"New name");
 for(const raw of ["broken",JSON.stringify({...store,version:2}),JSON.stringify({...store,collections:[{...store.collections[0],gameIds:['steam:404']}]})])assert.throws(()=>parsePersonalCollections(raw),/read/);
});
test("serialized updates are profile-local and failed storage leaves prior data intact",async()=>{
 const memory=new Map<string,string>();let full=false;globalThis.localStorage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{if(full)throw Error('QuotaExceededError');memory.set(key,value);}}as Storage;
 await Promise.all([changePersonalCollections("a/b",s=>createPersonalCollection(s,"A","a")),changePersonalCollections("a/b",s=>createPersonalCollection(s,"B","b"))]);assert.equal(readPersonalCollections("a/b").collections.length,2);assert.equal(readPersonalCollections("a%2Fb").collections.length,0);assert.notEqual(personalCollectionsKey("a/b"),personalCollectionsKey("a%2Fb"));
 full=true;await assert.rejects(changePersonalCollections("a/b",s=>removePersonalCollection(s,"a")));assert.equal(readPersonalCollections("a/b").collections.length,2);
});
