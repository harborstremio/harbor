import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanupError, cleanupItems, cleanupPending, type CleanupRecord } from '../src/lib/games/archive-cleanup.ts';
import { archiveDestinationParts, type ArchiveJob } from '../src/lib/games/archives.ts';

const job={id:'job',profile:'one',name:'Game',source:'D:\\Game.zip',originSource:'D:\\Game.zip',destination:'D:\\Game',status:'complete',startedAt:1,updatedAt:2,receipt:{source:'D:\\Game.zip',destination:'D:\\Game',sha256:'a'.repeat(64),bytes:2048,files:1}} satisfies ArchiveJob;
const record={id:'cleanup',profile:'one',jobId:'job',parent:'D:\\',destination:'D:\\Game',stage:'D:\\.holding',files:[{path:'D:\\Game.zip',name:'Game.zip',bytes:1024,sha256:'a'.repeat(64)}],phase:'held',restoring:false,error:null,updatedAt:10} satisfies CleanupRecord;

test('only completed receipts are offered and other profiles never appear',()=>{
 const jobs=[job,{...job,id:'running',status:'running' as const},{...job,id:'legacy',receipt:undefined},{...job,id:'other',profile:'two'}];
 assert.deepEqual(cleanupItems(jobs,[{...record,profile:'two'}],'one').map(x=>[x.id,x.record]),[['job',undefined]]);
});
test('pending cleanup remains accessible without its extraction record and sorts first',()=>{
 const items=cleanupItems([{...job,id:'other'}],[record],'one');
 assert.equal(items[0].record?.id,'cleanup');assert.equal(items[0].name,'Game.zip');assert.equal(items[1].id,'other');
});
test('latest persisted operation replaces old state without dropping job identity',()=>{
 const latest={...record,id:'restored',phase:'restored' as const,updatedAt:20};
 const items=cleanupItems([job],[latest,record],'one');
 assert.equal(items.length,1);assert.equal(items[0].name,'Game');assert.equal(items[0].record?.id,'restored');
});
test('uncertain recycling never becomes resumable or a completed success',()=>{
 assert.equal(cleanupPending({...record,phase:'unconfirmed'}),false);
 for(const phase of ['staging','held','recycling'] as const)assert.equal(cleanupPending({...record,phase}),true);
});
test('missing receipts and old native commands have actionable errors',()=>{
 assert.equal(cleanupError('archive_cleanup_incomplete'),'games.cleanup.archive_cleanup_receipt');
 assert.equal(cleanupError('unknown command games_archive_cleanup_records'),'games.cleanup.unavailable');
 assert.equal(cleanupError('archive_cleanup_recycle'),'games.cleanup.archive_cleanup_recycle');
});
test('source folder retains Windows and POSIX roots',()=>{
 assert.equal(archiveDestinationParts('D:\\Game.zip').parent,'D:\\');
 assert.equal(archiveDestinationParts('/Game.zip').parent,'/');
});
