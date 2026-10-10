import assert from 'node:assert/strict';
import test from 'node:test';
import { downloadDestination, downloadLocationKey, recentDownloadFolders } from '../src/lib/games/download-locations.ts';
import type { GameTransfer } from '../src/lib/games/transfers.ts';

test('quick destinations join Windows, extended, POSIX and root paths without changing filenames',()=>{
 assert.equal(downloadDestination('D:\\','game.zip'),'D:\\game.zip');
 assert.equal(downloadDestination('\\\\?\\D:\\Games\\','game.zip'),'\\\\?\\D:\\Games\\game.zip');
 assert.equal(downloadDestination('/','game.zip'),'/game.zip');
 assert.equal(downloadDestination('/Volumes/Games','game.zip'),'/Volumes/Games/game.zip');
 assert.equal(downloadDestination('/home/me/Downloads'),'/home/me/Downloads');
 assert.equal(downloadLocationKey('D:\\GAMES\\'),downloadLocationKey('\\\\?\\d:\\games'));
 assert.notEqual(downloadLocationKey('/Games'),downloadLocationKey('/games'));
});
test('recent locations are profile scoped, deduplicated and bounded without mutating records',()=>{
 const records=[{profile:'me',destination:'D:\\Games\\a.zip',createdAt:1},{profile:'me',destination:'d:\\games\\b.zip',createdAt:3},{profile:'other',destination:'Z:\\Private\\c.zip',createdAt:9},{profile:'me',destination:'W:\\Temp\\d.zip',createdAt:10,status:'canceled'},{profile:'me',destination:'E:\\Downloads\\e.zip',createdAt:2},{profile:'me',destination:'F:\\Downloads\\f.zip',createdAt:0}] as GameTransfer[];
 const before=JSON.stringify(records);
 assert.deepEqual(recentDownloadFolders(records,'me'),['d:\\games','E:\\Downloads']);
 assert.equal(JSON.stringify(records),before);
});
