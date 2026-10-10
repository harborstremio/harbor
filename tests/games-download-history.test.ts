import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPLETED_DOWNLOAD_RETENTION, downloadCompletedAt, downloadHistoryHidden, readDownloadDismissals } from '../src/lib/games/download-history.ts';
import type { DownloadItem } from '../src/lib/games/download-presentation.ts';

const now=Date.now();
const item=(status='complete',updatedAt=now-1000):DownloadItem=>({kind:'torrent',record:{id:'one',profile:'test',status,createdAt:now-COMPLETED_DOWNLOAD_RETENTION*2,updatedAt}} as DownloadItem);
test('completion uses the engine final timestamp, never the start time',()=>{
 assert.equal(downloadCompletedAt(item(),now),now-1000);
 assert.equal(downloadCompletedAt(item('downloading'),now),undefined);
 assert.equal(downloadCompletedAt(item('complete',now+1),now),undefined);
 assert.equal(downloadCompletedAt(item('complete',NaN),now),undefined);
 assert.equal(downloadCompletedAt(item('complete',0),now),undefined);
});
test('retention and dismissal only hide completed rows; newer downloads reappear',()=>{
 assert.equal(downloadHistoryHidden(item(),{},now),false);
 assert.equal(downloadHistoryHidden(item('complete',now-COMPLETED_DOWNLOAD_RETENTION),{},now),true);
 assert.equal(downloadHistoryHidden(item(),{'torrent:one':now},now),true);
 assert.equal(downloadHistoryHidden(item('complete',now),{'torrent:one':now-1000},now),false);
 for(const status of ['downloading','checking','failed','paused','queued'])assert.equal(downloadHistoryHidden(item(status),{'torrent:one':now},now),false);
 assert.equal(downloadHistoryHidden(item('complete',0),{},now),false);
});
test('invalid display preferences cannot hide records or cross transfer kinds',()=>{
 assert.deepEqual(readDownloadDismissals('{broken'),{});
 assert.deepEqual(readDownloadDismissals('{"torrent:one":100,"direct:one":200,"bad":50,"torrent:bad":-1}'),{'torrent:one':100,'direct:one':200});
 assert.equal(downloadHistoryHidden(item(),{'direct:one':now},now),false);
});


test('direct engine seconds keep fresh downloads visible for exactly 24 hours',()=>{
 const completed=Math.floor(now/1000)*1000;
 const direct={kind:'direct',record:{id:'direct-one',profile:'test',status:'complete',createdAt:completed/1000-100,updatedAt:completed/1000}} as DownloadItem;
 assert.equal(COMPLETED_DOWNLOAD_RETENTION,24*60*60*1000);
 assert.equal(downloadCompletedAt(direct,now),completed);
 assert.equal(downloadHistoryHidden(direct,{},completed+COMPLETED_DOWNLOAD_RETENTION-1),false);
 assert.equal(downloadHistoryHidden(direct,{},completed+COMPLETED_DOWNLOAD_RETENTION),true);
 assert.equal(downloadHistoryHidden(direct,{'direct:direct-one':completed+1},now),true);
 assert.equal(downloadHistoryHidden(direct,{'direct:direct-one':completed-1},now),false);
});
