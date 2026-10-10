import assert from 'node:assert/strict';
import test from 'node:test';
import { filterWowRealms, matchingWowRealm, parseWowRealms, parseWowRealmDirectory, wowRealmRegion, wowRealmRequest, wowRealmStatusUrl } from '../src/lib/games/wow-realm-data.ts';
import { wowClassicEdition, parsePinnedWowRealms, wowClassicStorageKey } from '../src/lib/games/wow-classic.ts';
import { wowClassicArt } from '../src/lib/games/wow-art.ts';

const realm = (extra = {}) => ({ name: "Quel'Thalas", slug: 'quelthalas', online: true, locale: 'en-US', timezone: 'CDT', population: {enum: 'FULL'}, type: {enum: 'NORMAL'}, realmLockStatus: {isLockedForNewCharacters: false}, ...extra });
const response = (realms = [realm()]) => ({data:{Realms:realms}});
test('Realm observations preserve explicit offline/online and unknown without coercing strings or missing flags', () => {
  const [online, offline, missing, invalid] = parseWowRealms(response([realm(),realm({name:'B',slug:'b',online:false}),realm({name:'C',slug:'c',online:undefined,population:null,type:null,realmLockStatus:null}),realm({name:'D',slug:'d',online:'false',realmLockStatus:{isLockedForNewCharacters:'false'}})]));
  assert.equal(online.online,true);assert.equal(offline.online,false);assert.equal(missing.online,null);assert.equal(invalid.online,null);
  assert.equal(missing.population,'');assert.equal(missing.type,'');assert.equal(missing.newCharactersLocked,null);assert.equal(invalid.newCharactersLocked,false);
});
test('Partial GraphQL errors, empty responses, duplicate identities and malformed realms do not become healthy lists', () => {
  for(const value of [{errors:[{message:'partial'}],...response()}, {},response([]),response([realm(),realm()]),response([realm({slug:'../other'})]),response([realm({name:'A'.repeat(81)})]),response([realm({name:'bad\nname'})]),response(Array.from({length:1001},(_,i)=>realm({slug:`realm-${i}`})))]) assert.throws(()=>parseWowRealms(value));
});
test('Exact matching handles provider names, slugs, accents and Korean without matching an unrelated prefix', () => {
  const realms=parseWowRealms(response([realm(),realm({name:'Tarren Mill',slug:'tarren-mill'}),realm({name:'아즈샤라',slug:'아즈샤라'}),realm({name:'Pozzo dell’Eternità',slug:'pozzo-delleternità'})]));
  assert.equal(matchingWowRealm(realms,'quel’thalas')?.slug,'quelthalas');assert.equal(matchingWowRealm(realms,'TARREN-MILL')?.slug,'tarren-mill');assert.equal(matchingWowRealm(realms,'아즈샤라')?.name,'아즈샤라');assert.equal(matchingWowRealm(realms,'Tarren'),null);
  assert.equal(filterWowRealms(realms,'eternità','en')[0]?.name,'Pozzo dell’Eternità');assert.equal(filterWowRealms(realms,'tarren mill','en')[0]?.slug,'tarren-mill');
});
test('Retail requests are fixed read-only operations and unsupported regions never fall back to Americas', () => {
  for(const region of ['us','eu','kr','tw'] as const){assert.equal(wowRealmRequest(region).variables.input.compoundRegionGameVersionSlug,region);assert.ok(wowRealmStatusUrl(region).endsWith(`/worldsoul/${region}/server-status`));}
  assert.equal(wowRealmRegion('cn'),false);assert.throws(()=>wowRealmRequest('cn' as 'us'));assert.throws(()=>wowRealmRequest('classic-us' as 'us'));
});
test('Unexpected future population/types stay unknown; locks are not inferred from a full population', () => {
  const [full,unknown,locked]=parseWowRealms(response([realm(),realm({slug:'future',population:{enum:'NEW_VALUE'},type:{enum:'UNKNOWN'}}),realm({slug:'locked',realmLockStatus:{isLockedForNewCharacters:true}})]));
  assert.equal(full.newCharactersLocked,false);assert.equal(full.population,'FULL');assert.equal(unknown.population,'');assert.equal(unknown.type,'');assert.equal(locked.newCharactersLocked,true);
});
test('Classic requests and source links always use their exact edition and region', () => {
  for(const edition of ['classic','classic1x','classicann'] as const) for(const region of ['us','eu','kr','tw'] as const) {
    assert.equal(wowRealmRequest(region,edition).variables.input.compoundRegionGameVersionSlug,`${edition}-${region}`);
    assert.ok(wowRealmStatusUrl(region,edition).endsWith(`/${edition}/${region}/server-status`));
  }
  assert.throws(()=>wowRealmRequest('us','classic2' as 'classic'));assert.throws(()=>wowRealmRequest('cn' as 'us','classicann'));
});
test('Only observed boolean lock enums are accepted, independently for creation and transfer', () => {
  const [locked,open,unknown]=parseWowRealms(response([realm({slug:'locked',category:'Legacy',population:{enum:'LOCKED'},realmLockStatus:{isLockedForNewCharacters:'true',isLockedForPct:'false'}}),realm({slug:'open',realmLockStatus:{isLockedForNewCharacters:'false',isLockedForPct:true}}),realm({slug:'unknown',realmLockStatus:{isLockedForNewCharacters:'yes',isLockedForPct:1}})]));
  assert.equal(locked.population,'LOCKED');assert.equal(locked.category,'Legacy');assert.equal(locked.newCharactersLocked,true);assert.equal(locked.transfersLocked,false);
  assert.equal(open.newCharactersLocked,false);assert.equal(open.transfersLocked,true);assert.equal(unknown.newCharactersLocked,null);assert.equal(unknown.transfersLocked,null);
});
test('Edition branding selects only the matching live game-version entry and fails gracefully if missing', () => {
  const value={data:{...response().data,GameVersions:[{key:'modern',name:'World of Warcraft'},{key:'classicann',name:'Burning Crusade Classic'},{key:'classic',name:'Mists of Pandaria Classic'}]}};
  assert.equal(parseWowRealmDirectory(value,'classicann').editionName,'Burning Crusade Classic');
  assert.equal(parseWowRealmDirectory(value,'classic1x').editionName,'');
  assert.match(wowClassicArt('classicann','Burning Crusade Classic').logo,/classic-bcc-logo/);
  assert.match(wowClassicArt('classic','Mists of Pandaria Classic').logo,/classic-mop-logo/);
  assert.match(wowClassicArt('classicann','Future expansion').logo,/classic-logo/);
  assert.doesNotMatch(wowClassicArt('classic1x','Mists of Pandaria Classic').logo,/classic-mop/);
});
test('Native Classic identity overrides catalog mistakes and excludes Retail, PTR and historical expansions', () => {
  assert.equal(wowClassicEdition({id:'battlenet:wow_classic',igdbId:123}),'classic');
  assert.equal(wowClassicEdition({id:'battlenet:wow_classic_era'}),'classic1x');
  assert.equal(wowClassicEdition({id:'battlenet:wow_classic_anniversary'}),'classicann');
  for(const id of ['battlenet:wow','battlenet:wowt','custom:World of Warcraft Classic']) assert.equal(wowClassicEdition({id}),null);
  assert.equal(wowClassicEdition({id:'igdb:75379',igdbId:75379}),'classic1x');
  assert.equal(wowClassicEdition({id:'steam:1',steamId:1,igdbId:75379}),null);
  assert.equal(wowClassicEdition({id:'igdb:198161',igdbId:198161}),null);
});
test('Pinned realms are bounded, validated and isolated by profile, edition and region', () => {
  assert.deepEqual(parsePinnedWowRealms(['tarren-mill','tarren-mill','아즈샤라',null,'../bad','a'.repeat(101),3]),['tarren-mill','아즈샤라']);
  assert.deepEqual(parsePinnedWowRealms({name:'other'}),[]);assert.equal(parsePinnedWowRealms(Array.from({length:150},(_,i)=>`realm-${i}`)).length,100);
  assert.notEqual(wowClassicStorageKey('a','classic','us'),wowClassicStorageKey('b','classic','us'));
  assert.notEqual(wowClassicStorageKey('a','classic','us'),wowClassicStorageKey('a','classicann','us'));
  assert.notEqual(wowClassicStorageKey('a','classic','us'),wowClassicStorageKey('a','classic','eu'));
});
