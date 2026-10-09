import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_SCHEMA, SOURCE_METADATA_VERSION, sourceNeedsMetadataRefresh, SOURCE_MAX_ENTRIES, SOURCE_MAX_SUBSCRIPTIONS, matchingReleases, parseSourceManifest, parseSourceText, sourceMatch, sourceUrl, sourceResponseError } from '../src/lib/games/sources.ts';
import { checkSourceStoreSize } from '../src/lib/games/source-store-validation.ts';
import { validateSourceStore } from '../src/lib/games/source-store.ts';
import { uniqueSourceFiles } from '../src/lib/games/source-files.ts';

test('catalog transport failures distinguish missing, blocked and legally unavailable sources', () => {
 assert.equal(sourceResponseError(404),'source_missing');
 assert.equal(sourceResponseError(403),'source_blocked');
 assert.equal(sourceResponseError(451),'source_restricted');
 assert.equal(sourceResponseError(503),'source_network');
});
import { sourceDownloadTitle } from '../src/lib/games/source-title.ts';

const file={name:'Expansion.zip',kind:'direct',url:'https://example.org/expansion.zip',sizeBytes:2048,sha256:'A'.repeat(64)};
const release={id:'expansion-1',title:'Hades II',game:{steamId:1145350,igdbId:228742},version:'1.2',files:[file]};
const manifest={schema:SOURCE_SCHEMA,name:'Community archive',items:[release]};

test('recent release titles round trip into details without losing a known catalog match', () => {
 const title='Sengoku Rance Free Download [Build-25565749]';
 const catalog=parseSourceManifest({name:'SteamGG',downloads:[{title,uris:['https://files.example/game.zip']}]});
 const source={...catalog,id:'steamgg',url:'https://catalog.example/steamgg.json',checkedAt:1,enabled:true};
 assert.equal(sourceDownloadTitle(title),'Sengoku Rance');
 assert.equal(matchingReleases([source],{name:sourceDownloadTitle(title),igdbId:42})[0]?.release.title,title);
 for(const suffix of [' – Remastered',' Deluxe Edition',' 2',' – The Final Chapter',' Soundtrack']) {
   assert.equal(sourceMatch({...catalog.entries[0],title:`Sengoku Rance${suffix} Free Download [Build-123]`},{name:'Sengoku Rance'}),null);
 }
 assert.equal(sourceMatch({...catalog.entries[0],steamId:99},{name:'Sengoku Rance',steamId:100}),null);
});

test('equivalent magnets merge tracker hints while distinct torrents, mirrors and keyed URLs survive', () => {
 const hash='a'.repeat(40), other='b'.repeat(40);
 const catalog=parseSourceManifest({name:'Catalog',downloads:[{title:'Game',uris:[
   `magnet:?xt=urn:btih:${hash}&tr=https://tracker.example/one`,
   `magnet:?xt=urn:btih:${hash.toUpperCase()}&tr=https://tracker.example/two`,
   `magnet:?xt=urn:btih:${other}`,
   'https://files.example/game#one','https://files.example/game#two',
 ]}]});
 const files=catalog.entries[0].files;
 assert.equal(files.length,4);
 assert.deepEqual(new URL(files[0].url).searchParams.getAll('tr'),['https://tracker.example/one','https://tracker.example/two']);
 assert.deepEqual(uniqueSourceFiles(files),files);
 const restored=validateSourceStore([{...catalog,id:'dedup',url:'https://catalog.example/test.json',checkedAt:1,enabled:true}]);
 assert.deepEqual(restored[0].entries[0].files,files);
});
test('source manifest accepts explicit file facts and never treats a host page as a direct file',()=>{
 const result=parseSourceManifest({...manifest,items:[release,{...release,id:'page',files:[{url:'https://example.org/game'}]}]});
 assert.equal(result.entries[0].files[0].sha256,'a'.repeat(64));assert.equal(result.entries[0].files[0].sizeBytes,2048);assert.equal(result.entries[1].files[0].kind,'page');
 const legacy=parseSourceManifest({name:'Community source',downloads:[{title:'Hades II v1.2',fileSize:'12 GB',uploadDate:'2026-01-01',uris:['magnet:?xt=urn:btih:'+'a'.repeat(40),'https://example.org/file']} ]});
 assert.equal(legacy.entries[0].steamId,undefined);assert.deepEqual(legacy.entries[0].files.map(f=>f.kind),['magnet','page']);assert.equal(legacy.entries[0].size,'12 GB');
});
test('malformed identities, active URL schemes, credentials and invalid hashes cannot become download entries',()=>{
 for(const url of ['javascript:alert(1)','file:///C:/x','https://user:pass@example.org/x','magnet:?xt=urn:btih:no'])assert.equal(sourceUrl(url,true),undefined);
 const result=parseSourceManifest({...manifest,items:[release,{...release,id:'bad-id',game:{steamId:'1145350'}},{...release,id:'bad-hash',files:[{...file,sha256:'no'}]},{...release,id:'bad-url',files:[{url:'javascript:alert(1)'}]},release]});
 assert.equal(result.entries.length,1);assert.equal(result.skipped,4);
 assert.throws(()=>parseSourceText('{ broken'),/source_format/);assert.throws(()=>parseSourceManifest({...manifest,schema:'unknown'}),/source_format/);assert.throws(()=>parseSourceManifest({...manifest,items:Array(SOURCE_MAX_ENTRIES+1).fill(release)}),/source_limit/);
});

test('large community catalogs retain every release through storage validation beyond the former limits',()=>{
 const downloads=Array.from({length:110_300},(_,index)=>({title:`Example project ${index}`,uris:[`https://example.org/releases/${index}`]}));
 const catalog=parseSourceText(JSON.stringify({name:'Large catalog',downloads}));
 assert.equal(catalog.entries.length,110_300);assert.equal(catalog.skipped,0);
 const source={...catalog,id:'large',url:'https://example.org/large.json',checkedAt:10,enabled:true};
 checkSourceStoreSize([source]);const restored=validateSourceStore([source])[0];
 assert.equal(restored.entries.at(-1)?.title,'Example project 110299');
 assert.throws(()=>checkSourceStoreSize(Array(SOURCE_MAX_SUBSCRIPTIONS+1).fill(source)),/source_limit/);
});
test('identity conflicts and sequels never become matches; versions remain explicitly unconfirmed',()=>{
 const entry=parseSourceManifest(manifest).entries[0],game={name:'Hades II',steamId:1145350,igdbId:228742};
 assert.equal(sourceMatch(entry,game),'identity');assert.equal(sourceMatch({...entry,igdbId:42},game),null);assert.equal(sourceMatch({...entry,steamId:999,igdbId:undefined},game),null);
 const unlinked={...entry,steamId:undefined,igdbId:undefined};assert.equal(sourceMatch({...unlinked,title:'Hades II — v1.2 + extras'},game),'title');assert.equal(sourceMatch({...unlinked,title:'Hades III'},game),null);
 assert.equal(sourceMatch({...unlinked,title:'Elden Ring Nightreign'},{name:'Elden Ring'}),null);assert.equal(sourceMatch({...unlinked,title:'Hades II v1.2'},game),'title');
 const source={...parseSourceManifest(manifest),id:'one',url:'https://example.org/catalog.json',checkedAt:10,enabled:false};assert.equal(matchingReleases([source],game).length,0);assert.equal(matchingReleases([{...source,enabled:true}],game).length,1);
});
test('stored catalogs retain metadata and reject corruption instead of silently replacing them',()=>{
 const community=parseSourceManifest({name:'Source',downloads:[{title:'Hades II',fileSize:'12 GB',uris:['https://example.org/file']}]});
 const source={...community,id:'valid-id',url:'https://example.org/catalog.json',checkedAt:10,enabled:true};assert.equal(validateSourceStore([source])[0].entries[0].size,'12 GB');assert.equal(validateSourceStore([source])[0].format,'community');
 assert.throws(()=>validateSourceStore([source,source]),/source_storage/);assert.throws(()=>validateSourceStore([{...source,entries:[{...source.entries[0],files:[]}]}]),/source_no_valid_entries|source_storage/);
});

test('release URLs preserve file keys, folder selections and encoded fragments through import and storage',()=>{
 const links=['https://mega.nz/file/ExampleA#key_A-b', 'https://mega.nz/#!ExampleB!key_B-c', 'https://mega.nz/folder/ExampleC#key_C-d/file/ExampleD', 'https://files.example/project#part%2Fone%23two', 'https://files.example/project#part-two'];
 const community=parseSourceManifest({name:'Projects',homepage:'https://catalog.example/#about',downloads:[{title:'Community project',uris:[...links,links[0]]}]});
 assert.deepEqual(community.entries[0].files.map(file=>file.url),links);
 assert.equal(community.homepage,'https://catalog.example/');
 const restored=validateSourceStore([{...community,id:'fragments',url:'https://catalog.example/source.json#section',checkedAt:1,enabled:true}])[0];
 assert.deepEqual(restored.entries[0].files.map(file=>file.url),links);
 assert.equal(restored.url,'https://catalog.example/source.json');
 const harbor=parseSourceManifest({...manifest,items:[{...release,files:links.map(url=>({url,kind:'page'}))}]});
 assert.deepEqual(harbor.entries[0].files.map(file=>file.url),links);
 assert.equal(sourceUrl('https://catalog.example/source.json#section'),'https://catalog.example/source.json');
});


test('community release-page evidence survives import and storage without changing file links', () => {
 const url='https://steamgg.net/retrospace-free-download/';
 const catalog=parseSourceManifest({name:'SteamGG',downloads:[{title:'RetroSpace Free Download [Build-25646526+1 DLC]',uris:['https://files.example/game.zip'],descriptionHtml:'<a href="'+url+'">Website with instructions for launching the game</a>'}]});
 assert.equal(catalog.entries[0].sourcePage,url);
 assert.deepEqual(catalog.entries[0].files.map(file=>file.url),['https://files.example/game.zip']);
 const source={...catalog,id:'source',url:'https://catalog.example/steamgg.json',checkedAt:1,enabled:true};
 const restored=validateSourceStore([source])[0];
 assert.equal(restored.entries[0].sourcePage,url);
 assert.equal(restored.metadataVersion,SOURCE_METADATA_VERSION);
 assert.equal(sourceNeedsMetadataRefresh(restored),false);
 const old=validateSourceStore([{...source,metadataVersion:undefined}])[0];
 assert.equal(sourceNeedsMetadataRefresh(old),true);
 assert.equal(sourceNeedsMetadataRefresh({...old,enabled:false}),false);
 assert.equal(sourceNeedsMetadataRefresh({...old,format:'website'}),false);
});

test('source descriptions are inert, bounded, and must publish one unambiguous page', () => {
 for(const descriptionHtml of [
  '<a href="javascript:alert(1)">Page</a>',
  '<a href="https://user:pass@example.org/game">Page</a>',
  '<a href="https://example.org/game">Page</a><a href="https://example.org/other">Other</a>',
  '<script>"<a href="https://example.org/game">Page</a>"</script>',
  '<a href="https://example.org/game" href="https://other.example/game">Page</a>',
  '<a href="https://example.org/game">'+'x'.repeat(8192)+'</a>',
 ]) {
  const catalog=parseSourceManifest({name:'Catalog',downloads:[{title:'Game',uris:['https://files.example/game.zip'],descriptionHtml}]});
  assert.equal(catalog.entries[0].sourcePage,undefined);
  assert.equal(catalog.entries.length,1);
 }
 const catalog=parseSourceManifest({name:'Catalog',downloads:[{title:'Game',uris:['https://files.example/game.zip'],descriptionHtml:'<a target="_blank" href="https://example.org/game?a=1&amp;b=2">Page</a>'}]});
 assert.equal(catalog.entries[0].sourcePage,'https://example.org/game?a=1&b=2');
});
