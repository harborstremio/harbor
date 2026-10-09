import assert from 'node:assert/strict';
import test from 'node:test';
import { filterInstalled, gameSize, installedSummary, libraryName } from '../src/lib/games/installed.ts';
const games = [
 {appId:1,name:'Zelda',state:'installed',libraryPath:'W:/Steam',installPath:'W:/Steam/common/Zelda',sizeBytes:20,lastPlayed:99},
 {appId:2,name:'Alpha',state:'missing',libraryPath:'F:/Games',installPath:'F:/Games/common/Alpha',sizeBytes:30,lastPlayed:0},
 {appId:3,name:'Beta',state:'updating',libraryPath:'F:/Games',installPath:'F:/Games/common/Beta',sizeBytes:10,lastPlayed:5},
];
test('library search, drive and state filters compose without mutating the scan',()=>{
 assert.deepEqual(filterInstalled(games,'  beTA  ','updating','F:/Games','recent').map(g=>g.appId),[3]);
 assert.deepEqual(filterInstalled(games,'','installed','F:/Games','recent'),[]);
 assert.deepEqual(filterInstalled(games,'','all','all','name').map(g=>g.appId),[2,3,1]);
 assert.deepEqual(filterInstalled(games,'','all','all','size').map(g=>g.appId),[2,1,3]);
 assert.deepEqual(games.map(g=>g.appId),[1,2,3]);
});
test('native library paths display without extended-path prefixes; identity remains Steam-scoped',()=>{
 assert.equal(libraryName('\\\\?\\W:\\Steam\\'),'W:\\Steam');
 assert.equal(libraryName('/home/person/.steam/steam/'),'/home/person/.steam/steam');
 assert.equal(installedSummary(games[0]).id,'steam:1');
 assert.equal(gameSize(1024**3),'1 GB');
 assert.equal(gameSize(0),'—');
});
