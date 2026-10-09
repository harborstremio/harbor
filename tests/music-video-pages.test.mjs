import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
function load(file,mocks){const source=fs.readFileSync(new URL(`../src/lib/music/${file}.ts`,import.meta.url),'utf8');const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});const mod={exports:{}};new Function('require','module','exports',outputText)(name=>{if(!(name in mocks))throw Error(name);return mocks[name]},mod,mod.exports);return mod.exports;}
const track=(id,title)=>({id:`youtube:${id}`,sourceId:id,connectorId:'youtube',title,artist:'Artist',artwork:'https://example.com/art.jpg',durationSeconds:120,durationLabel:'2:00'});
const api=invoke=>load('video-pages',{'@tauri-apps/api/core':{invoke},'./video-discovery':load('video-discovery',{'@tauri-apps/api/core':{invoke}})});
test('video pages retain more than twelve exact videos and follow cursors without repeating requests',async()=>{
 const calls=[];const pages=api(async(command,args)=>{calls.push({command,args});return {tracks:Array.from({length:24},(_,i)=>track(String(i).padStart(11,'x'),`Song ${i}`)),next:'next-provider-page'};});
 const one=await pages.searchMusicVideoPage(' Hip-hop ',false);assert.equal(one.tracks.length,24);assert.equal(one.next,'next-provider-page');
 await pages.searchMusicVideoPage('Hip-hop',false);assert.equal(calls.length,1);
 await pages.searchMusicVideoPage('Hip-hop',false,one.next);assert.equal(calls.length,2);assert.equal(calls[1].args.cursor,'next-provider-page');
});
test('video append preserves order and removes repeated provider identities and duplicate songs',()=>{
 const pages=api(async()=>({tracks:[],next:null}));const first=track('aaaaaaaaaaa','First'),next=track('bbbbbbbbbbb','Second');
 assert.deepEqual(pages.appendMusicVideos([first],[first,track('ccccccccccc','First (Official Video)'),next]),[first,next]);
});
test('failed video pages can be retried and repeated cursors end pagination',async()=>{
 let calls=0;const pages=api(async()=>{if(++calls===1)throw Error('offline');return {tracks:[track('aaaaaaaaaaa','Song')],next:'repeat'};});
 await assert.rejects(pages.searchMusicVideoPage('rap',false,'repeat'),/offline/);
 const result=await pages.searchMusicVideoPage('rap',false,'repeat');assert.equal(result.tracks.length,1);assert.equal(result.next,null);assert.equal(calls,2);
});
test('artist identity filters apply on every video page without hiding the provider continuation',async()=>{
 const calls=[];const pages=api(async(_command,args)=>{calls.push(args);return{tracks:[{...track('aaaaaaaaaaa','Song'),artist:'Nas'},{...track('bbbbbbbbbbb','Unrelated'),artist:'Shakira'}],next:args.cursor?null:'more'};});
 const one=await pages.searchMusicVideoPage('Nas music videos',false,null,false,'Nas');
 assert.deepEqual(one.tracks.map(t=>t.artist),['Nas']);assert.equal(one.next,'more');
 const two=await pages.searchMusicVideoPage('Nas music videos',false,one.next,false,'Nas');
 assert.deepEqual(two.tracks.map(t=>t.artist),['Nas']);assert.equal(calls.length,2);
});
