import test from 'node:test';
import assert from 'node:assert/strict';
import { HACK_CREATOR_VIDEOS, hackVideos, hackGameplaySearch, spotlightGames } from '../src/lib/games/hack-editorial.ts';
import { parseAtlasGame } from '../src/lib/games/igdb-data.ts';
import { decodeIgdbRows } from '../src/lib/games/igdb-records.ts';

test('spotlights keep editorial order and exact game/base identities', () => {
 const rows = [
  { id:191278, name:'B3313', game_type:5, parent_game:{id:1074,name:'Super Mario 64'} },
  { id:141663, name:'Unbound', game_type:5, parent_game:{id:1559,name:'FireRed'} },
  { id:999, name:'Unbound', game_type:5, parent_game:{id:1559,name:'FireRed'} },
  { id:314536, name:'Unrelated base game', game_type:0 },
 ].map(parseAtlasGame);
 assert.deepEqual(spotlightGames(rows).map(g=>g.igdbId),[141663,191278]);
 assert.deepEqual(spotlightGames(rows,1559).map(g=>g.igdbId),[141663]);
 assert.equal(spotlightGames(rows,9999).length,0);
});
test('creator clips never leak to similarly named games and catalog videos remain bounded', () => {
 const id=HACK_CREATOR_VIDEOS[0].id;
 const raw={id:141663,name:'Unbound',game_type:5,videos:[{video_id:id,name:'Provider duplicate'},{video_id:'abcdefghijk',name:'Trailer'}, {video_id:'../notvideo?',name:'Invalid'}]};
 const game=parseAtlasGame(decodeIgdbRows([raw])![0]);
 const videos=hackVideos(game);
 assert.equal(videos.length,2);assert.equal(videos[0].creator,'HoodlumCallum');assert.equal(videos[1].title,'Trailer');
 assert.equal(hackVideos(parseAtlasGame({...raw,id:123,videos:[]})).length,0);
 const many={...raw,videos:Array.from({length:30},(_,i)=>({video_id:`abcdefgh${String(i).padStart(3,'0')}`,name:'x'.repeat(500)}))};
 const decoded=parseAtlasGame(decodeIgdbRows([many])![0]);
 assert.equal(decoded.videos?.length,8);assert.equal(decoded.videos?.[0].title.length,200);
 const search=new URL(hackGameplaySearch('A & B? #1'));
 assert.equal(search.hostname,'www.youtube.com');assert.equal(search.searchParams.get('search_query'),'A & B? #1 ROM hack gameplay');
});
