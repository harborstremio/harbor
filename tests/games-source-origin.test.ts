import assert from 'node:assert/strict';
import test from 'node:test';
import { sourceOrigin, withSourceOrigin } from '../src/lib/games/source-origin.ts';
import { matchingReleases, parseSourceManifest, SOURCE_SCHEMA, type GameSource, type SourceRelease } from '../src/lib/games/sources.ts';
import { matchingReleasesAsync } from '../src/lib/games/source-matches.ts';
import { buildSourceIndex, sourceIndexCandidates } from '../src/lib/games/source-index.ts';
import { resolveDetailEdition } from '../src/lib/games/detail-edition.ts';
import { collectionGame } from '../src/lib/games/personal-collections.ts';
import { readSavedGames, writeSavedGames } from '../src/lib/games/saved.ts';
import type { GameSummary } from '../src/lib/games/types.ts';

const game: GameSummary = {id:'steam:123',steamId:123,name:'The Actual Game',capsule:'',platforms:['Windows']};
const release: SourceRelease = {id:'release-20',title:'The Actual Game / Другая игра [P] [RUS] (2026, RPG)',sourcePage:'https://example.org/release/20',kind:'game',files:[{name:'Files',url:'https://example.org/files/20',kind:'page'}]};
const source: GameSource = {id:'tracker',url:'https://example.org/feed.json',name:'Tracker',enabled:true,checkedAt:1,format:'community',entries:[release],skipped:0};

test('selected translated/edition releases survive catalog enrichment without broadening title matching', () => {
  for (const title of [release.title,'The Actual Game: Deluxe Edition','[PS3] The Actual Game [USA/FULLRUS]']) {
    const selected={...release,title}, feed={...source,entries:[selected]}, opened=withSourceOrigin(game,feed,selected);
    assert.equal(matchingReleases([feed],game).length,0);
    const enriched=resolveDetailEdition(opened,{...game,name:'Renamed by publisher',features:[]} as any,null).portableGame;
    assert.equal(matchingReleases([feed],enriched)[0]?.release,selected);
    assert.equal(matchingReleases([{...feed,id:'other'}],enriched).length,0);
  }
});

test('origin candidates work with explicit IDs, raw tracker titles and console editions', () => {
  for (const selected of [release,{...release,steamId:77},{...release,igdbId:88,platform:'PS3'}]) {
    const feed={...source,entries:[selected]}, opened=withSourceOrigin(game,feed,selected), index=buildSourceIndex(feed.entries);
    const rows=sourceIndexCandidates(index,opened).map(row=>feed.entries[row]);
    assert.equal(matchingReleases([{...feed,entries:rows}],opened).length,1);
  }
});

test('origin follows records through reordering, but never disabled/removed/replaced sources or different releases', () => {
  const opened=withSourceOrigin(game,source,release);
  assert.equal(matchingReleases([{...source,entries:[{...release,id:'release-900'}]}],opened).length,1);
  for (const feed of [{...source,enabled:false},{...source,url:'https://other.example/feed.json'},
    {...source,entries:[{...release,title:release.title+' II'}]}, {...source,entries:[{...release,sourcePage:'https://example.org/other'}]},
    {...source,entries:[{...release,steamId:44}]}, {...source,entries:[{...release,platform:'GBA'}]}, {...source,entries:[{...release,kind:'patch' as const}]}]) {
    assert.equal(matchingReleases([feed],opened).length,0);
  }
  assert.deepEqual(matchingReleases([],opened),[]);
});

test('origin and ordinary matching deduplicate the same record and preserve other matching repositories', () => {
  const selected={...release,title:game.name}, feed={...source,entries:[selected]}, opened=withSourceOrigin(game,feed,selected);
  const matches=matchingReleases([feed,{...feed,id:'second'}],opened);
  assert.equal(matches.length,2);
});

test('warm async matches invalidate when another release of the same game was selected', async () => {
  const edition={...release,id:'edition',title:'The Actual Game: Deluxe Edition'}, feed={...source,entries:[release,edition]};
  const first=withSourceOrigin(game,feed,release), second=withSourceOrigin(game,feed,edition), signal=new AbortController().signal;
  assert.equal((await matchingReleasesAsync([feed],first,signal))[0]?.release.id,release.id);
  assert.equal((await matchingReleasesAsync([feed],second,signal))[0]?.release.id,edition.id);
  assert.equal((await matchingReleasesAsync([feed],game,signal)).length,0);
  assert.equal((await matchingReleasesAsync([{...feed,id:'other'}],first,signal)).length,0);
});

test('Harbor, community and website records retain their original direct, page and magnet choices', () => {
  const files=[{name:'Archive',url:'https://example.org/game.zip',kind:'direct' as const},{name:'Publisher',url:'https://example.org/game',kind:'page' as const},{name:'Torrent',url:'magnet:?xt=urn:btih:0123456789012345678901234567890123456789',kind:'magnet' as const}];
  const native=parseSourceManifest({schema:SOURCE_SCHEMA,name:'Harbor',items:[{id:'known',title:release.title,game:{steamId:77},files}]});
  const community=parseSourceManifest({name:'Community',downloads:[{title:release.title,uris:files.map(file=>file.url)}]});
  for (const manifest of [native,community,{...community,format:'website' as const,website:{kind:'wordpress' as const,api:'https://example.org/wp-json/wp/v2',site:'https://example.org/'}}]) {
    const feed={...source,...manifest}, original=feed.entries[0], opened=withSourceOrigin(game,feed,original);
    const matches=matchingReleases([feed],opened);
    assert.equal(matches.length,1);assert.deepEqual(matches[0].release.files,original.files);
    assert.equal(matches[0].release.steamId,original.steamId);
  }
});

test('source-backed, Steam and IGDB origins survive Saved and collection reloads', () => {
  const data=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>data.set(k,v)}});
  for (const target of [game,{...game,id:'igdb:100',steamId:undefined,igdbId:100},
    {...game,id:'source:tracker:stable',steamId:undefined,sourceListing:{page:release.sourcePage!,sourceName:source.name,description:'Published description',screenshots:[]}}]) {
    const opened=withSourceOrigin(target,source,release);
    writeSavedGames('proof',[opened]);
    const saved=readSavedGames('proof')[0];
    assert.deepEqual(saved.sourceOrigin,sourceOrigin(opened.sourceOrigin));
    assert.equal(matchingReleases([source],saved).length,1);
    assert.deepEqual(collectionGame(opened)?.sourceOrigin,saved.sourceOrigin);
  }
  assert.deepEqual(readSavedGames('another-profile'),[]);
});

test('untrusted saved provenance is bounded and cannot introduce active URLs or invalid identities', () => {
  const valid=withSourceOrigin(game,source,release).sourceOrigin!;
  assert.ok(sourceOrigin(valid));
  for (const patch of [{sourceUrl:'javascript:alert(1)'},{page:'file:///secret'},{title:'x'.repeat(501)},{sourceId:'x'.repeat(81)},{steamId:-1},{igdbId:'100'},{kind:'unknown'},{platform:'\0'}]) assert.equal(sourceOrigin({...valid,...patch}),undefined);
});

test('the reported Hidden Land tracker title remains discoverable as a source-only listing', () => {
  const selected={...release,title:'Hidden Land of Ana: Ghostly Realm [ч. 4] [P] [ENG + 5] (2026, Quest) [P2P]'};
  const opened=withSourceOrigin({id:'source:tracker:ana',name:'Hidden Land of Ana: Ghostly Realm [ч. 4]',capsule:'',platforms:[]},source,selected);
  const entries=[selected], rows=sourceIndexCandidates(buildSourceIndex(entries),opened);
  assert.equal(matchingReleases([{...source,entries:rows.map(row=>entries[row])}],opened).length,1);
});
