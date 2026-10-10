import test from 'node:test';
import assert from 'node:assert/strict';
import {canPreparePublicFile,publicFileSelection,publicBatchError} from '../src/lib/games/source-public-files.ts';
const file=(id,state='available')=>({id,name:id+'.7z.001',state,bytes:100,sha256:null,speedLimit:null});
test('selection preserves catalog order and excludes stale or unavailable IDs',()=>{
 const files=[file('part1'),file('part2','unknown'),file('private','restricted'),file('gone','missing')];
 assert.deepEqual(publicFileSelection({title:'Parts',files,selectedId:'part2'},new Set(['gone','part2','private','part1','stale'])).map(f=>f.id),['part1','part2']);
 for(const state of ['review','limited','restricted','missing'])assert.equal(canPreparePublicFile(file('a',state)),false);
});
test('batch failure is actionable, file-specific and cancellation stays quiet',()=>{
 assert.deepEqual(publicBatchError({code:'public_rate_limit',file:'Project.7z.003'}),{key:'games.sources.public.limited',file:'Project.7z.003'});
 assert.deepEqual(publicBatchError({code:'transfer_batch_names',file:'A.zip'}),{key:'games.download.transfer_batch_names',file:'A.zip'});
 assert.equal(publicBatchError({code:'public_batch_canceled'}),null);
 assert.equal(publicBatchError(Error('Command games_source_public_prepare_batch not found')).key,'games.sources.batch.restart');
 assert.equal(publicBatchError({code:'public_batch_limit'}).key,'games.sources.batch.limit');
 assert.deepEqual(publicBatchError({code:'secret error',file:'private\ncontent'}),{key:'games.sources.public.failed'});
});
