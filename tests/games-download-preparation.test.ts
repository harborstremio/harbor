import assert from 'node:assert/strict';
import test from 'node:test';
import { preparationOptions, preparationDraft, mergePreparation, downloadPreparation, preparationGroup, preparationOutput, preparationError, type PreparationChoice } from '../src/lib/games/download-preparation.ts';
import type { DownloadItem } from '../src/lib/games/download-presentation.ts';

const files=(...names:string[])=>names.map(path=>({path,selected:true}));
const choice={id:'choice',target:{profile:'one',engine:'direct',downloadId:'download',archive:'D:\\Game.zip',members:[]},identity:'a'.repeat(64),parent:'D:\\',name:'Game unpacked',status:'waiting',error:null,updatedAt:10} satisfies PreparationChoice;

test('archive families stay separate and direct members are explicit filenames',()=>{
 const options=preparationOptions(files('game.zip.002','bonus.zip','game.zip.001','game.zip.002','setup.exe','readme.txt'));
 assert.equal(options.length,2);
 assert.deepEqual(options[0],{archive:'game.zip.001',members:['game.zip.002'],complete:true});
 assert.equal(preparationDraft({enabled:true},options,'D:\\','direct'),null);
 assert.deepEqual(preparationDraft({enabled:true,archive:'game.zip.001'},options,'D:\\','direct',name=>name+' unpacked'),{archive:'game.zip.001',members:['game.zip.002'],parent:'D:\\',name:'game unpacked'});
 assert.equal(preparationDraft({enabled:false,archive:'game.zip.001'},options,'D:\\','direct'),null);
});
test('torrent review refuses known unselected parts and never supplies record IDs as paths',()=>{
 const source=[{path:'game/a.part1.rar',selected:true},{path:'game/a.part2.rar',selected:false},{path:'other/a.part1.rar',selected:true}];
 const options=preparationOptions(source);
 assert.equal(options.length,2);assert.equal(options[0].complete,false);
 assert.equal(preparationDraft({enabled:true,archive:options[0].archive},options,'/games','torrent'),null);
 source[1].selected=true;
 assert.deepEqual(preparationDraft({enabled:true,archive:options[0].archive},preparationOptions(source),'/games','torrent'),{archive:'game/a.part1.rar',parent:'/games',name:'a',members:[]});
});
test('unsafe destination names cannot be submitted; legitimate Unicode stays intact',()=>{
 const options=preparationOptions(files('星.zip'));
 for(const name of ['','..','../other','game.','game ','a/b','a\\b','a'.repeat(181),'.harbor-stage','bad\0name'])assert.equal(preparationDraft({enabled:true,name},options,'/games','direct'),null,name);
 assert.equal(preparationDraft({enabled:true},options,'/games','direct')?.name,'星');
});
test('all supported families are offered without consuming nonarchives',()=>{
 for(const file of ['A.zip','A.7z','A.tar','A.tar.gz','A.tgz','A.iso','A.rar','A.part01.rar','A.7z.001','A.zip.001'])assert.equal(preparationOptions(files(file)).length,1,file);
 assert.equal(preparationOptions(files('setup.exe','data.bin','readme.md')).length,0);
});
test('large torrent inventory keeps distinct paths and bounded naming work',()=>{
 const source=Array.from({length:50000},(_,i)=>({path:`folder${i}/game.zip`,selected:i%2===0}));
 const before=performance.now(),options=preparationOptions(source);
 assert.equal(options.length,25000);assert.ok(performance.now()-before<5000);
});
test('stale events and foreign profiles cannot overwrite the saved choice',()=>{
 const newer={...choice,status:'disabled' as const,updatedAt:20};
 assert.deepEqual(mergePreparation([newer],choice,'one'),[newer]);
 assert.deepEqual(mergePreparation([newer],{...choice,target:{...choice.target,profile:'two'}},'one'),[newer]);
 assert.equal(mergePreparation([choice],{...newer,id:'replacement'},'one').length,1);
});
test('retained atomic intake remains visible and pending/error work cannot hide as completed',()=>{
 const item={kind:'direct',record:{profile:'one',id:'download',preparation:choice}} as DownloadItem;
 assert.equal(downloadPreparation(item,[]),choice);
 const disabled={...choice,status:'disabled' as const,updatedAt:20};
 assert.equal(downloadPreparation(item,[disabled]),disabled);
 for(const status of ['waiting','queued','dispatching'] as const)assert.equal(preparationGroup('complete',{...choice,status}),'queue');
 assert.equal(preparationGroup('complete',{...choice,status:'failed'}),'attention');
 assert.equal(preparationGroup('complete',disabled),'complete');
 assert.equal(preparationGroup('canceled',choice),'canceled');
});
test('consumed choices retain an exact review destination after extraction history is dismissed',()=>{
 assert.equal(preparationOutput({...choice,parent:'D:\\Games',name:'Original files'}),'D:\\Games\\Original files');
 assert.equal(preparationOutput({...choice,parent:'/games',name:'長い名前'}),'/games/長い名前');
});
test('intake save failure copy does not imply files were already downloaded',()=>{
 assert.equal(preparationError(new Error('archive_store')),'games.preparation.storeError');
 assert.equal(preparationError('archive_store'),'games.preparation.storeError');
 assert.equal(preparationError('archive_missing_part'),'games.archive.archive_missing_part');
});
