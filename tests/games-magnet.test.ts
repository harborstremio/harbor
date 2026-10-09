import assert from 'node:assert/strict';
import test from 'node:test';
import { MAGNET_MAX_BYTES, MAGNET_MAX_TRACKERS, normalizeMagnet } from '../src/lib/games/magnet.ts';
import { parseSourceManifest, sourceFilename, sourceUrl } from '../src/lib/games/sources.ts';
import { validateSourceStore } from '../src/lib/games/source-store-validation.ts';

const hash='a'.repeat(40);
test('repeated canonical trackers retain strict identity, length and unsafe-link validation',()=>{
 const tracker='https://tracker.example/announce?label=日本語&space=a b';
 const canonical=normalizeMagnet(`magnet:?xt=urn:btih:${hash}&tr=${encodeURIComponent(tracker)}`)!;
 const next=canonical.replace(hash,'b'.repeat(40));
 assert.equal(normalizeMagnet(next),next);
 assert.equal(new URL(next).searchParams.get('xt'),'urn:btih:'+'b'.repeat(40));
 assert.deepEqual(new URL(normalizeMagnet(next)!).searchParams.getAll('tr'),[tracker]);
 for(const bad of [next.replace('b'.repeat(40),'g'.repeat(40)),next+`&xt=urn:btih:${hash}`,next+'&dn='+'x'.repeat(MAGNET_MAX_BYTES)])assert.equal(normalizeMagnet(bad),undefined);
 assert.equal(normalizeMagnet(next+'&tr='+encodeURIComponent('https://user:password@private.example')),next);
 assert.equal(normalizeMagnet(next+'&tr=file%3A%2F%2F%2Fsecret'),next);
 assert.equal(normalizeMagnet(`magnet:?xt=urn:btih:${hash}`),`magnet:?xt=urn%3Abtih%3A${hash}`);
 // Evict both by count and by retained bytes; an old valid list must still revalidate.
 for(let i=0;i<300;i++){
  const links=Array.from({length:8},(_,j)=>'https://tracker.example/'+i+'/'+j+'?value='+'x'.repeat(650));
  const input=`magnet:?xt=urn:btih:${hash}`+links.map(link=>'&tr='+encodeURIComponent(link)).join('');
  assert.equal(new URL(normalizeMagnet(input)!).searchParams.getAll('tr').length,8);
 }
 assert.equal(normalizeMagnet(next),next);
});
test('long community magnets retain every tracker through source parsing and normalize numbered hints',()=>{
 const input=`magnet:?xt=urn:btih:${hash}&xt=urn:btmh:1220${'b'.repeat(64)}&so=0-18446744073709551615`+Array.from({length:436},(_,i)=>`&tr.${i+1}=${encodeURIComponent(`udp://tracker${i}.example:6969/announce`)}`).join('');
 assert.ok(input.length>8192);const normalized=normalizeMagnet(input)!;assert.ok(normalized);
 const parsed=new URL(normalized);assert.equal(parsed.searchParams.getAll('tr').length,436);assert.equal(parsed.searchParams.getAll('xt').length,1);assert.equal(parsed.searchParams.has('so'),false);
 const source=parseSourceManifest({name:'Community',downloads:[{title:'Example',uris:[input]}]});assert.equal(source.skipped,0);assert.equal(source.entries[0].files[0].url,normalized);
 assert.equal(normalizeMagnet(normalized+'&tr='+encodeURIComponent('udp://tracker0.example:6969/announce')),normalized);
});
test('base32, duplicate identity, conflicts and bounded unsafe hints agree with native review rules',()=>{
 assert.equal(new URL(normalizeMagnet('magnet:?xt=urn:btih:'+'A'.repeat(32))!).searchParams.get('xt'),'urn:btih:'+'0'.repeat(40));
 const valid=`magnet:?xt=urn:btih:${hash}`;assert.equal(normalizeMagnet(valid+`&xt=URN:BTIH:${hash}`),normalizeMagnet(valid));
 for(const input of [valid+`&xt=urn:btih:${'b'.repeat(40)}`,valid+'&dn='+'x'.repeat(MAGNET_MAX_BYTES),'magnet:?xt=urn:btmh:1220'+'b'.repeat(64),valid+Array.from({length:MAGNET_MAX_TRACKERS+1},(_,i)=>`&tr=udp://t${i}.example:6969`).join('')]) assert.equal(normalizeMagnet(input),undefined);
 for(const hint of ['file:///tmp/secret','https://name:password@example.org/','https:///'+'x'.repeat(2100),'not a url']) assert.equal(normalizeMagnet(valid+'&tr='+encodeURIComponent(hint)),normalizeMagnet(valid));
 assert.equal(sourceUrl('https://example.org/'+'x'.repeat(8192)),undefined);
});
test('existing saved catalogs survive malformed optional trackers without forwarding unsafe hints',()=>{
 const raw=`magnet:?xt=urn:btih:${hash}&tr=file:///tmp/secret&tr=udp://tracker.example:6969/announce&tr=broken`;
 const stored={id:'existing',url:'https://example.org/catalog.json',name:'Projects',format:'community',checkedAt:1,enabled:true,skipped:0,entries:[{id:'release-0',title:'Project',kind:'game',files:[{name:'BitTorrent',url:raw,kind:'magnet'}]}]};
 const sources=validateSourceStore([stored]);assert.equal(sources[0].entries.length,1);assert.deepEqual(new URL(sources[0].entries[0].files[0].url).searchParams.getAll('tr'),['udp://tracker.example:6969/announce']);
});
test('direct source filename remains separate from game title and preserves source filename or URL extension',()=>{
 const named={name:'Expansion 日本.zip',url:'https://example.org/opaque',kind:'direct' as const};assert.equal(sourceFilename(named),'Expansion 日本.zip');
 assert.equal(sourceFilename({...named,name:'example.org',url:'https://example.org/releases/game.tar.gz?download=1'}),'game.tar.gz');
 assert.equal(sourceFilename({...named,name:'../../CON.zip'}),'_CON.zip');
});
