import assert from 'node:assert/strict';
import test from 'node:test';
import { concurrentChartGames, parseConcurrentChart } from '../src/lib/games/concurrent-chart-data.ts';
import type { GameSummary } from '../src/lib/games/types.ts';

const response = (ranks: unknown[]) => ({ response: { last_update: 1791042747, ranks } });
const rank = (appid: number, rank: number, concurrent_in_game: unknown) => ({ appid, rank, concurrent_in_game });

test('live leaderboard orders the full observation by concurrent count before pagination', () => {
  const { ranks } = parseConcurrentChart(response([rank(553850,21,58341),rank(252490,22,156906),rank(2507950,23,108602),rank(230410,24,77762),rank(413150,26,84647)]));
  assert.deepEqual(ranks.map(row=>row.currentPlayers),[156906,108602,84647,77762,58341]);
  const metadata = [553850,413150,252490,230410,2507950].map(steamId=>({id:`steam:${steamId}`,steamId,name:String(steamId)} as GameSummary));
  const ordered = concurrentChartGames(ranks, metadata);
  assert.deepEqual(ordered.map(game=>game.steamId),[252490,2507950,413150,230410,553850]);
  assert.deepEqual(ordered.map(game=>game.chartRank),[1,2,3,4,5]);
  assert.equal(ordered[0].currentPlayers,156906);
  assert.equal(metadata[0].steamId,553850);
});

test('invalid observations never become zero; zero and stable count ties are valid', () => {
  const { ranks,publishedAt } = parseConcurrentChart(response([rank(1,2,5),rank(2,1,5),rank(3,3,0),rank(4,4,'7'),rank(5,5,-2),rank(2,6,10),null]));
  assert.deepEqual(ranks.map(row=>row.appId),[2,1,3]);
  assert.equal(publishedAt,1791042747000);
  assert.throws(()=>parseConcurrentChart(response([rank(1,1,null)])));
  assert.throws(()=>parseConcurrentChart({response:{ranks:[rank(1,1,2)]}}));
});

test('missing metadata keeps surviving counts paired with the right rank, and chart stays bounded', () => {
  const {ranks}=parseConcurrentChart(response(Array.from({length:105},(_,i)=>rank(i+1,i+1,105-i))));
  assert.equal(ranks.length,100);
  const games=concurrentChartGames(ranks,[{id:'steam:2',steamId:2,name:'Second'} as GameSummary]);
  assert.equal(games[0].chartRank,2);
  assert.equal(games[0].currentPlayers,104);
});
