import test from 'node:test';import assert from 'node:assert/strict';
import {adError,adIntent,adRejected} from '../src/lib/games/cloud-ad-links.ts';
import {webIntent,webIntentKey} from '../src/lib/games/cloud-web-jobs.ts';

test('AllDebrid records retain bounded file metadata without credentials, passwords or signed URLs',()=>{
 const value={version:1,url:'https://host.test/file',title:'Game',remoteId:'123',createdAt:1,requestId:'request-123',file:{name:'Game.zip',expectedBytes:123}};
 assert.deepEqual(adIntent(webIntent({...value,key:'secret',password:'password',downloadUrl:'https://private.test/file',file:{...value.file,url:'https://private.test/file'}})),value);
 for(const file of [{name:'../private',expectedBytes:1},{name:'..',expectedBytes:null},{name:'x\n',expectedBytes:null},{name:'x',expectedBytes:-1},{name:'x',expectedBytes:NaN},{name:'x',expectedBytes:17*1024**4}])assert.throws(()=>webIntent({...value,file}),/web_storage/);
 for(const next of [{...value,file:undefined},{...value,requestId:undefined},{...value,remoteId:'not-numeric'},{...value,remoteId:'9007199254740992'}])assert.throws(()=>adIntent(webIntent(next)),/web_storage/);
 assert.equal(adIntent(null),null);
});
test('AllDebrid persistence is isolated from existing cloud jobs and each account/profile/source',async()=>{
 const args=['profile','key','https://host.test/file'] as const,id=await webIntentKey(...args,'ad');
 for(const provider of ['tb','pm'] as const)assert.notEqual(id,await webIntentKey(...args,provider));
 assert.notEqual(id,await webIntentKey('other',args[1],args[2],'ad'));
 assert.notEqual(id,await webIntentKey(args[0],'other',args[2],'ad'));
 assert.notEqual(id,await webIntentKey(args[0],args[1],args[2]+'?part=2','ad'));
});
test('only definitive rejections allow another request without ambiguous-request recovery',()=>{
 for(const code of ['cloud_password','cloud_auth_blocked','cloud_key','cloud_quota','cloud_unsupported','cloud_missing','cloud_rate_limit'])assert.equal(adRejected(Error(code)),true);
 for(const code of ['cloud_network','cloud_service','cloud_metadata','cloud_link','web_storage','private payload'])assert.equal(adRejected(Error(code)),false);
 assert.equal(adError('cloud_auth_blocked'),'games.sources.ad.blocked');assert.equal(adError('web_storage'),'games.sources.web.storage');assert.equal(adError('private payload'),null);
});
