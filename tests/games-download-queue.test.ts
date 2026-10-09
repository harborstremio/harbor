import assert from "node:assert/strict";
import test from "node:test";
import {canOrderDownload,compareDownloadQueue,downloadQueueKey} from "../src/lib/games/download-queue.ts";
import type {DownloadItem} from "../src/lib/games/download-presentation.ts";

const item=(kind:DownloadItem["kind"],id:string,queueOrder?:number,createdAt=1,status="queued")=>({kind,record:{id,queueOrder,createdAt,status}} as DownloadItem);

test("mixed-engine priority follows native order without conflating equal engine IDs",()=>{
  const records=[item("direct","same",4),item("torrent","same",2),item("direct","next",1),item("torrent","later",3)];
  assert.deepEqual([...records].sort(compareDownloadQueue).map(downloadQueueKey),["direct:next","torrent:same","torrent:later","direct:same"]);
  assert.equal(records[0].record.queueOrder,4);
});

test("missing or invalid native priorities sort deterministically after known positions",()=>{
  const records=[item("torrent","b",undefined,3),item("direct","a",NaN,2),item("torrent","a",0,2),item("direct","b",Infinity,2),item("direct","valid",5,99)];
  assert.deepEqual(records.sort(compareDownloadQueue).map(downloadQueueKey),["direct:valid","direct:a","direct:b","torrent:a","torrent:b"]);
  for(const order of [-1,0,0.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1])assert.ok(compareDownloadQueue(item("direct","valid",1),item("torrent","invalid",order))<0);
});

test("only waiting, paused and failed work exposes ordering controls",()=>{
  for(const kind of ["direct","torrent"] as const){
    for(const status of ["queued","paused","failed"])assert.equal(canOrderDownload(item(kind,"id",1,1,status)),true);
    for(const status of ["connecting","retrying","downloading","checking","pausing","canceling","complete","canceled"])assert.equal(canOrderDownload(item(kind,"id",1,1,status)),false);
  }
});
