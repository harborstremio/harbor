import assert from 'node:assert/strict';
import test from 'node:test';
import {validateDownloadBatch} from '../src/lib/games/transfers.ts';
const file=(filename:string)=>({filename,url:'https://example.com/file'});
test('multipart queue keeps exact Unicode part names and supports the queue capacity',()=>{
 const files=Array.from({length:200},(_,i)=>file(`Garden 日本.part${i+1}.rar`));
 const original=structuredClone(files);validateDownloadBatch(files);assert.deepEqual(files,original);
});
test('duplicate or unsafe names require individual destination choice, never silent renaming',()=>{
 for(const name of ['../x','a/b','a\\b','a:stream','nul.zip','LPT1.rar','.','..','name.','trailing ',' leading','.harbor-hidden','a\0b','é'.repeat(128)]){
  assert.throws(()=>validateDownloadBatch([file('ok.rar'),file(name)]),/transfer_batch_names/);
 }
 assert.throws(()=>validateDownloadBatch([file('Part01.rar'),file('part01.rar')]),/transfer_batch_names/);
});
test('empty or oversized selection cannot open a directory picker',()=>{
 assert.throws(()=>validateDownloadBatch([]),/transfer_limit/);
 assert.throws(()=>validateDownloadBatch(Array.from({length:201},(_,i)=>file(`${i}.rar`))),/transfer_limit/);
});
