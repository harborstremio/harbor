import assert from "node:assert/strict";
import test from "node:test";
import { canOrderTransfer, compareTransferQueue, isTransferActive, type GameTransfer } from "../src/lib/games/transfers.ts";
const item=(id:string,status:GameTransfer["status"],queueOrder:number,createdAt=1)=>({id,status,queueOrder,createdAt} as GameTransfer);
test("display follows actual queue order with running transfers first and finished history last",()=>{
 const records=[item("complete-old","complete",1),item("queued-later","queued",8),item("paused","paused",4),item("running","downloading",5),item("queued-next","queued",2),item("complete-new","complete",6,8)];
 assert.deepEqual(records.sort(compareTransferQueue).map(r=>r.id),["running","queued-next","paused","queued-later","complete-new","complete-old"]);
});
test("only pending transfers can be reordered and legacy display remains deterministic",()=>{
 for(const status of ["queued","paused","failed"] as const)assert.equal(canOrderTransfer(status),true);
 for(const status of ["connecting","retrying","downloading","checking","pausing","canceling","canceled","complete"] as const)assert.equal(canOrderTransfer(status),false);
 assert.ok(compareTransferQueue({...item("b","queued",1,1),queueOrder:undefined},{...item("a","queued",1,2),queueOrder:undefined})<0);
});
test("reconnecting files stay active ahead of the pending queue and remain controllable",()=>{
 assert.equal(isTransferActive("retrying"),true);
 assert.ok(compareTransferQueue(item("retry","retrying",5),item("next","queued",1))<0);
});
