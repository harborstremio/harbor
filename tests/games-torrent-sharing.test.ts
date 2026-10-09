import test from 'node:test';
import assert from 'node:assert/strict';
import {torrentSharing,type GameTorrent} from '../src/lib/games/torrents.ts';
import {downloadGroup,downloadSummary,type DownloadItem} from '../src/lib/games/download-presentation.ts';
import {downloadCompletedAt,downloadHistoryHidden} from '../src/lib/games/download-history.ts';
const now=Date.now(),completed=now-9*86400000;
const item=(status:NonNullable<GameTorrent['sharing']>['status']):DownloadItem=>({kind:'torrent',record:{id:'seed',profile:'one',status:'complete',createdAt:completed-10000,updatedAt:now,completedAt:completed,sharing:{status,policy:{ratioMilli:1000,seconds:3600,uploadBps:65536},uploadedBytes:123,elapsedSeconds:20,error:status==='failed'?'torrent_seed_files':null}} as GameTorrent});
test('active sharing remains visible and counted without reclassifying verified payloads',()=>{
 for(const state of ['checking','seeding'] as const){const value=item(state);assert.equal(torrentSharing(value.record as GameTorrent),true);assert.equal(downloadGroup(value),'active');assert.equal(downloadHistoryHidden(value,{'torrent:seed':now},now),false);assert.deepEqual(downloadSummary([value]),{total:1,active:1,queued:0,paused:0,failed:0});assert.equal(value.record.status,'complete');}
});
test('sharing failure stays actionable, while stopped sharing returns to completed history',()=>{
 assert.equal(downloadGroup(item('failed')),'attention');assert.equal(downloadHistoryHidden(item('failed'),{},now),false);assert.equal(downloadSummary([item('failed')]).failed,1);
 for(const state of ['stopped','limitReached'] as const){assert.equal(downloadGroup(item(state)),'complete');assert.equal(downloadHistoryHidden(item(state),{},now),true);}
});
test('upload progress does not reset the original completion date or display retention',()=>{
 for(const state of ['checking','seeding','stopped','limitReached','failed'] as const)assert.equal(downloadCompletedAt(item(state),now),completed);
 const old=item('stopped');delete (old.record as GameTorrent).completedAt;assert.equal(downloadCompletedAt(old,now),now);
});
