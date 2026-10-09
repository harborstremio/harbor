import test from 'node:test';
import assert from 'node:assert/strict';
import {archiveDestinationParts, archiveError, archiveFolder, archiveSetupSource, downloadArchive, mergeArchiveJob, type ArchiveJob} from '../src/lib/games/archives.ts';
import {rememberSetupContext, registeredArchiveGame} from '../src/lib/games/setup-context.ts';
import {emptyLaunchConfig, type CustomGame} from '../src/lib/games/custom-library.ts';
import {downloadSetup, downloadSetupGroup, downloadSetupSummary} from '../src/lib/games/download-setup.ts';
import type {DownloadItem} from '../src/lib/games/download-presentation.ts';
import type {SetupJob} from '../src/lib/games/setup.ts';
const item={kind:'torrent',record:{id:'torrent',profile:'alice',destination:'D:/Downloads/Game',status:'complete',name:'Game'}} as DownloadItem;
const job:ArchiveJob={id:'archive',profile:'alice',originSource:'D:/Downloads/Game',source:'D:/Downloads/Game/part.zip',name:'Game',destination:'D:/Games/Game',status:'running',startedAt:10,updatedAt:11};
const receipt={source:job.source,destination:job.destination,sha256:'a'.repeat(64),files:2,bytes:100};

test('archive and ISO review keep clean destination names and actionable decoder errors',()=>{
 assert.equal(archiveFolder('D:\\Downloads\\Game 雨.7Z'),'Game 雨');
 assert.equal(archiveFolder('D:\\Downloads\\Game 雨.RAR'),'Game 雨');
 assert.equal(archiveFolder('D:\\Downloads\\Game 雨.ISO'),'Game 雨');
 assert.equal(archiveFolder('/home/player/Game.iso.backup'),'Game.iso.backup');
 assert.equal(archiveError('archive_multipart'),'games.archive.archive_multipart');
 assert.equal(archiveFolder('/home/player/Game.part1.rar'),'Game','multipart destination uses the set name');
 assert.equal(archiveError('archive_decoder'),'games.archive.archive_decoder');
 assert.equal(archiveError('archive_password_or_checksum'),'games.archive.archive_password_or_checksum');
});
test('completed download stays active/visible while extracting; failures need attention',()=>{
 assert.equal(downloadSetupGroup(item,undefined,job),'active');
 assert.deepEqual(downloadSetupSummary([item],()=>undefined,[job]),{total:1,active:1,queued:0,paused:0,failed:0});
 for(const status of ['failed','interrupted'] as const){const failed={...job,status};assert.equal(downloadSetupGroup(item,undefined,failed),'attention');assert.equal(downloadSetupSummary([item],()=>undefined,[failed]).failed,1);}
});
test('origin/profile/path ownership selects the latest extraction without counting earlier failures',()=>{
 const old={...job,id:'old',status:'failed' as const,startedAt:1},foreign={...job,profile:'bob',startedAt:99};
 assert.equal(downloadArchive(item,'alice',[old,job,foreign])?.id,job.id);
 assert.equal(downloadArchive({...item,record:{...item.record,status:'downloading'}} as DownloadItem,'alice',[job]),undefined);
 assert.equal(downloadArchive(item,'bob',[job]),undefined);
 assert.deepEqual(downloadSetupSummary([item],()=>undefined,[old,job]),{total:1,active:1,queued:0,paused:0,failed:0});
});
test('only a matching completed receipt supplies the next setup location and original identity',()=>{
 assert.equal(archiveSetupSource(job),undefined);
 assert.equal(archiveSetupSource({...job,status:'complete'}),undefined);
 assert.equal(archiveSetupSource({...job,status:'complete',receipt:{...receipt,destination:'D:/Other'}}),undefined);
 const complete={...job,status:'complete' as const,receipt,game:{id:'igdb:42',name:'Game'}};
 assert.deepEqual(archiveSetupSource(complete),{source:job.destination,originSource:job.originSource,name:'Game',game:complete.game});
 const setup={id:'setup',profile:'alice',source:job.destination,status:'running',startedAt:20,updatedAt:20} as SetupJob;
 assert.equal(downloadSetup(item,'alice',[setup],[],[],{},[complete])?.job.id,'setup');
 assert.equal(downloadSetup(item,'alice',[{...setup,startedAt:1}],[],[],{},[complete]),undefined,'new extraction must not inherit an earlier setup result');
 assert.equal(downloadSetup(item,'alice',[setup],[],[],{},[job]),undefined);
});
test('durable terminal records resist old progress and independent extraction jobs join the count',()=>{
 const finished={...job,status:'complete' as const,updatedAt:40,receipt};
 assert.equal(mergeArchiveJob([finished],{...job,updatedAt:50},'alice')[0].status,'complete');
 assert.equal(mergeArchiveJob([job],finished,'bob')[0].status,'running');
 const detached={...job,id:'standalone',originSource:'D:/Other/archive.zip'};
 assert.deepEqual(downloadSetupSummary([],()=>undefined,[detached]),{total:1,active:1,queued:0,paused:0,failed:0});
});

test('portable readiness requires an explicitly registered executable for this extraction',()=>{
 const complete={...job,status:'complete' as const,receipt};
 const game={id:'portable-game',name:'Game',config:{...emptyLaunchConfig(),executable:'D:/Games/Game/Game.exe'}} as CustomGame;
 assert.equal(registeredArchiveGame(complete,[game]),undefined);
 rememberSetupContext('alice',`archive:${job.id}`,{source:job.destination,name:'Game'},game.config.executable);
 assert.equal(downloadSetup(item,'alice',[],[game],[],{},[complete])?.phase,'ready');
 assert.equal(registeredArchiveGame({...complete,id:'new-extraction'},[game]),undefined);
 assert.equal(registeredArchiveGame({...complete,status:'running'},[game]),undefined);
 assert.equal(registeredArchiveGame(complete,[]),undefined);
 assert.equal(registeredArchiveGame(complete,[{...game,config:{...game.config,executable:'D:/Other/Game.exe'}}]),undefined);
});

test('retry retains valid parent paths on Windows, macOS and Linux',()=>{
 assert.deepEqual(archiveDestinationParts('D:\\Game'),{parent:'D:\\',name:'Game'});
 assert.deepEqual(archiveDestinationParts('D:/Games/Game'),{parent:'D:/Games',name:'Game'});
 assert.deepEqual(archiveDestinationParts('/Game'),{parent:'/',name:'Game'});
 assert.deepEqual(archiveDestinationParts('/home/player/Games/Game/'),{parent:'/home/player/Games',name:'Game'});
 assert.deepEqual(archiveDestinationParts('\\\\server\\share\\Game'),{parent:'\\\\server\\share',name:'Game'});
});
