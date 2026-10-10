import assert from "node:assert/strict";
import test from "node:test";
import { combineGameRatings, parseMetacritic, parseSteamReviewSummary } from "../src/lib/games/rating-data";
import { parseAtlasGame } from "../src/lib/games/igdb-data";
import { decodeIgdbRows } from "../src/lib/games/igdb-records";
import { decodeGameMetadata, markSavedMetadata } from "../src/lib/games/metadata-records";
import type { GameDetail } from "../src/lib/games/types";

test("critic score links only use the real Metacritic game destination; missing scores stay absent", () => {
  assert.deepEqual(parseMetacritic({score:0,url:"http://www.metacritic.com/game/red-dead-redemption-2/"}),{score:0,url:"https://www.metacritic.com/game/red-dead-redemption-2/"});
  for(const value of [{score:101,url:"https://metacritic.com/game/a"},{score:88,url:"https://metacritic.com.evil.test/game/a"},{score:88,url:"javascript:alert(1)"},{score:88,url:"https://evil@metacritic.com/game/a"},{score:88}])assert.equal(parseMetacritic(value),undefined);
});
test("IGDB user and external critic samples remain separate through the cache; combined average is not another rating", () => {
  const game={id:9,name:"Test",slug:"test",external_games:[{uid:"42",external_game_source:1}],rating:81.5,rating_count:9,aggregated_rating:91,aggregated_rating_count:3,total_rating:86.25,total_rating_count:12};
  const atlas=parseAtlasGame(markSavedMetadata(decodeIgdbRows([game])!,12345)[0]);
  const ratings=combineGameRatings({id:"steam:42",steamId:42,name:"Test",capsule:"",platforms:[]},null,atlas);
  assert.deepEqual(ratings.map(r=>[r.source,r.score,r.count,r.cachedAt]),[["igdb-users",81.5,9,12345],["igdb-critics",91,3,12345]]);
  assert.equal(combineGameRatings({id:"steam:99",steamId:99,name:"Test",capsule:"",platforms:[]},null,atlas).length,0);
});
test("Steam recommendation percentage keeps its own meaning and sample; unavailable data is never zero", () => {
  const game={id:"steam:42",steamId:42,name:"Test",capsule:"",platforms:[]};
  const ratings=combineGameRatings(game,{...game,metacritic:{score:87,url:"https://metacritic.com/game/test"}} as GameDetail,null,{...game,reviews:{positive:96,count:520}});
  assert.deepEqual(ratings.map(r=>[r.source,r.kind,r.score,r.count]),[["steam","positive-reviews",96,520],["metacritic","score",87,undefined]]);
  assert.deepEqual(combineGameRatings(game,null,null,{...game,reviews:{positive:0,count:0}}),[]);
});
test("Steam's negative verdict survives the cache without changing 31% into a negative-review share", () => {
  const game={id:"steam:2357570",steamId:2357570,name:"Overwatch",capsule:"https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2357570/header.jpg",platforms:["Windows"]};
  const reviews=parseSteamReviewSummary({percent_positive:31,review_count:425562,review_score_label:"Mostly Negative"});
  const cached=decodeGameMetadata("highlights:v2:2357570",[{...game,reviews}]) as (typeof game & {reviews:NonNullable<typeof reviews>})[];
  const rating=combineGameRatings(game,null,null,cached[0])[0];
  assert.equal(rating.verdict,"Mostly Negative");assert.equal(rating.score,31);assert.equal(rating.kind,"positive-reviews");assert.equal(rating.count,425562);
});
test("Steam verdicts come from the provider, with no positive verdict invented for missing or unknown labels", () => {
  for(const label of [undefined,"new provider label","<script>"]){assert.equal(parseSteamReviewSummary({percent_positive:31,review_count:10,review_score_label:label})?.verdict,undefined);}
  assert.equal(parseSteamReviewSummary({percent_positive:41,review_count:171513,review_score_label:"Mixed"})?.verdict,"Mixed");
  assert.equal(parseSteamReviewSummary({percent_positive:96,review_count:520,review_score_label:"Overwhelmingly Positive"})?.verdict,"Overwhelmingly Positive");
  assert.equal(parseSteamReviewSummary({percent_positive:31,review_count:0,review_score_label:"Mostly Negative"}),undefined);
});
