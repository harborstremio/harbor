import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as selection from "../src/lib/music/daily-discovery-selection";
import * as genres from "../src/lib/music/genre-catalog";
import * as membership from "../src/lib/music/genre-membership";
import * as quality from "../src/lib/music/mix-quality";
import { artistIdentityKey } from "../src/lib/music/artist-popularity";
import { musicTrackIdentity } from "../src/lib/music/track-identity";
import { musicRecentContextIdentity } from "../src/lib/music/recent-identity";
import type { MusicTrack } from "../src/lib/music/types";

const track = (artist: string, n: number): MusicTrack => ({ id:`deezer:track:${artist}-${n}`,artist,title:`Song ${n}`,artwork:`${artist}.jpg`,durationSeconds:180,durationLabel:"3:00" });
const names=["Rapper A","Rapper B","Producer A","Producer B"];
const ranked=names.map((name,i)=>({name,key:artistIdentityKey(name),score:10-i,seeds:Array.from({length:12},(_,n)=>track(name,n))}));
const tags=new Map(names.map(name=>[genres.genreSearchKey(name),[name.startsWith("Rapper")?"rap":"trance"]]));
const source=readFileSync(new URL("../src/lib/music/made-for-you-genres.ts",import.meta.url),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const mocks:Record<string,unknown>={
  "./artist-authority":{artistIdentityKey,resolveArtist:async()=>({canonical:null})},
  "./artist-profile":{loadArtistProfile:async()=>null},
  "./artist-genre-cache":{readArtistGenres:async()=>tags},
  "./daily-discovery-selection":selection,"./genre-catalog":genres,"./genre-membership":membership,
  "./mix-quality":quality,"./track-identity":{musicTrackIdentity},
};
const mod={exports:{}};
new Function("require","module","exports",compiled)((id:string)=>{assert.ok(id in mocks,id);return mocks[id]},mod,mod.exports);
const api=mod.exports as typeof import("../src/lib/music/made-for-you-genres");
const pool=ranked.flatMap(artist=>artist.seeds);

test("personal genres contain only evidenced artists, with balanced real songs and original covers",()=>{
  const mixes=api.planMadeForYouGenres(ranked,[...pool,...Array.from({length:12},(_,n)=>track("Unrelated pop artist",n))],tags,"2026-10-02","me");
  assert.deepEqual(mixes.map(mix=>mix.name),["Hip-hop","Electronic"]);
  for(const mix of mixes){
    assert.ok(api.genreMixHasVariety(mix.tracks));assert.equal(mix.artwork.length,2);
    assert.equal(new Set(mix.tracks.map(musicTrackIdentity)).size,mix.tracks.length);
    assert.ok(mix.tracks.every(track=>track.artist.startsWith(mix.name==="Hip-hop"?"Rapper":"Producer")));
  }
});
test("no genre is invented from missing metadata or a single artist",()=>{
  assert.deepEqual(api.planMadeForYouGenres(ranked,pool,new Map(),"2026-10-02","me"),[]);
  assert.deepEqual(api.planMadeForYouGenres(ranked.slice(0,1),ranked[0].seeds,tags,"2026-10-02","me"),[]);
});
test("genre queues stay stable in a day, rotate later and retain profile-specific context identity",async()=>{
  const a=await api.loadMadeForYouGenres(ranked,pool,"2026-10-02","me");
  assert.deepEqual(await api.loadMadeForYouGenres(ranked,pool,"2026-10-02","me"),a);
  const b=api.planMadeForYouGenres(ranked,pool,tags,"2026-10-03","me");
  const c=api.planMadeForYouGenres(ranked,pool,tags,"2026-10-02","other");
  const identity=(mix:typeof a[number])=>musicRecentContextIdentity({kind:"similar",id:mix.id,seed:mix.seeds[0]});
  assert.equal(identity(a[0]),identity(b[0]));assert.notEqual(identity(a[0]),identity(c[0]));
  assert.notDeepEqual(a[0].tracks.map(musicTrackIdentity),b[0].tracks.map(musicTrackIdentity));
});
