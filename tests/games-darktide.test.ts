import assert from 'node:assert/strict';
import test from 'node:test';
import { currentDarktideMissions, darktideCondition, parseDarktideBoard } from '../src/lib/games/darktide-data.ts';

const now = Date.UTC(2026, 8, 30, 22);
const row = (id = '12345678-1234-1234-1234-123456789000', changes = {}) => ({ id, map: 'km_heresy', category: 'common', start: String(now - 60_000), expiry: String(now + 60_000), challenge: 5, resistance: 4, credits: 1000, xp: 100, extraRewards: { circumstance: { credits: 50, xp: 10 } }, requiredLevel: 30, circumstance: 'default', ...changes });
const board = (...rows: unknown[]) => parseDarktideBoard({ missions: rows });

test('Original expiry is exclusive; future and historical missions never appear as available', () => {
  const data = board(row());
  assert.equal(currentDarktideMissions(data, now - 60_001, 'all', 'all', '').length, 0);
  assert.equal(currentDarktideMissions(data, now - 60_000, 'all', 'all', '').length, 1);
  assert.equal(currentDarktideMissions(data, now + 59_999, 'all', 'all', '').length, 1);
  assert.equal(currentDarktideMissions(data, now + 60_000, 'all', 'all', '').length, 0);
  assert.equal(currentDarktideMissions(data, now + 180 * 60_000, 'all', 'all', '').length, 0);
});
test('Difficulty distinguishes Damnation and Auric; map identity provides exact art and searchable names', () => {
  const data = board(row(), row('12345678-1234-1234-1234-123456789001', { resistance: 5, category: 'maelstrom' }));
  assert.equal(currentDarktideMissions(data, now, 'common', '5', 'DARK communion')[0].name, 'Dark Communion');
  assert.equal(currentDarktideMissions(data, now, 'common', 'auric', '').length, 0);
  assert.equal(currentDarktideMissions(data, now, 'maelstrom', 'auric', '').length, 1);
  assert.match(data.missions[0].image, /assets\/maps\/Dark_Communion\.png$/);
  const spillway = board(row(undefined, {map:'spillway'})).missions[0];assert.equal(spillway.name,'Spillway');assert.match(spillway.image,/^https:\/\/cdn\.prod\.website-files\.com\//);
  const unknown = board(row(undefined, { map: 'new_map', circumstance: 'new_condition', challenge: 6, resistance: 6 })).missions[0];
  assert.equal(unknown.name, 'new_map'); assert.equal(unknown.image, ''); assert.equal(unknown.difficulty, 'unknown');
  assert.deepEqual(darktideCondition(unknown.condition), ['unknown']);
  for(const code of ['__proto__', 'constructor']) {assert.deepEqual(darktideCondition(code), ['unknown']);assert.equal(board(row(undefined, {map:code})).missions[0].image, '');}
});
test('Rewards include declared bonuses; missing, malformed, negative and zero values stay distinct', () => {
  const mission = board(row()).missions[0];assert.equal(mission.credits, 1050);assert.equal(mission.xp, 110);
  for (const amount of [undefined, -1, '100', Infinity]) assert.equal(board(row(undefined, { credits: amount })).missions[0].credits, null);
  assert.equal(board(row(undefined, { credits: 0, extraRewards: {} })).missions[0].credits, 0);
  assert.equal(board(row(undefined, { extraRewards: { circumstance: { credits: -5 } } })).missions[0].credits, null);
});
test('Identical observations dedupe, conflicting identities fail, damaged rows remain partial', () => {
  assert.equal(board(row(), row()).missions.length, 1);
  for (const change of [{map:'cm_habs'}, {category:'story'}, {expiry:String(now+120_000)}, {credits:500}, {circumstance:'darkness_01'}]) assert.throws(() => board(row(), row(undefined, change)), /Conflicting/);
  const data = board(row(), {id:'broken'}); assert.equal(data.partial, true); assert.equal(data.missions.length, 1);
  assert.deepEqual(board(), {missions:[], partial:false});
  assert.throws(() => board({id:'broken'}));assert.throws(() => parseDarktideBoard({}));assert.throws(() => board(...Array(3001).fill(row())));
  for(const change of [{expiry:String(now-120_000)}, {start:'1'}, {map:'../path'}, {expiry:String(now+25*3600_000)}]) assert.throws(() => board(row(undefined, change)));
});
test('Verified combined conditions preserve both modifiers; deadlines sort nearest first', () => {
  assert.deepEqual(darktideCondition('waves_of_specials_more_resistance_01'), ['high','shock']);
  assert.deepEqual(darktideCondition('ventilation_purge_with_snipers_01'), ['fog','snipers']);
  assert.deepEqual(darktideCondition('default'), []);
  const data=board(row(undefined,{expiry:String(now+120_000)}),row('12345678-1234-1234-1234-123456789001'));
  assert.equal(currentDarktideMissions(data,now,'all','all','')[0].id,'12345678-1234-1234-1234-123456789001');
});
