import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWarframeState, warframeActive, warframeFissures, warframeUsable, WARFRAME_MAX_AGE } from '../src/lib/games/warframe-data.ts';

const now = Date.UTC(2026, 8, 30, 12), iso = (offset: number) => new Date(now + offset).toISOString();
const period = { activation: iso(-60_000), expiry: iso(600_000) };
const fissure = (id = 'first', change = {}) => ({ id, ...period, node: 'Hydra (Pluto)', missionType: 'Capture', enemy: 'Corpus', tierNum: 4, isHard: false, isStorm: false, ...change });
const source = (change = {}) => ({
  timestamp: iso(0), cetusCycle: { ...period, state: 'day' }, vallisCycle: { ...period, state: 'cold' },
  cambionCycle: { ...period, state: 'fass' }, duviriCycle: { ...period, state: 'joy' }, earthCycle: { ...period, state: 'night' }, zarimanCycle: { ...period, state: 'corpus' },
  voidTrader: { id: 'baro', activation: iso(86400_000), expiry: iso(3 * 86400_000), location: 'Kronia Relay (Saturn)', inventory: [] },
  sortie: { id: 'sortie', ...period, boss: 'Phorid', variants: [{ node: 'Saxis (Eris)', missionType: 'Hive', modifier: 'Energy reduction', modifierDescription: 'Reduced energy capacity.' }] },
  archonHunt: { id: 'archon', ...period, boss: 'Archon Amar', missions: [{ node: 'War (Mars)', type: 'Assassination' }] },
  fissures: [fissure()], ...change,
});

test('Cycles and operations retain exact source periods; countdown boundaries never invent another state', () => {
  const data = parseWarframeState(source(), now);
  assert.equal(data.partial, false); assert.equal(data.cycles.length, 6);
  assert.equal(data.sortie?.missions[0].type, 'Hive'); assert.equal(data.archon?.missions[0].type, 'Assassination');
  const cycle = data.cycles[0];
  assert.equal(warframeActive(cycle, cycle.activation - 1), false);
  assert.equal(warframeActive(cycle, cycle.activation), true);
  assert.equal(warframeActive(cycle, cycle.expiry - 1), true);
  assert.equal(warframeActive(cycle, cycle.expiry), false);
  assert.equal(cycle.state, 'day');
});

test('Bad independent sections are omitted without losing valid ones or manufacturing empty success', () => {
  const data = parseWarframeState(source({ vallisCycle: { ...period, state: 'day' }, sortie: { id: 'sortie', ...period, boss: 'Phorid', variants: [{ node: 'Saxis (Eris)' }] }, archonHunt: null }), now);
  assert.equal(data.partial, true); assert.equal(data.cycles.length, 5); assert.equal(data.sortie, null); assert.equal(data.archon, null); assert.equal(data.fissures.length, 1);
  assert.throws(() => parseWarframeState({ timestamp: iso(0) }, now));
  assert.throws(() => parseWarframeState(source({ timestamp: iso(301_000) }), now));
  assert.throws(() => parseWarframeState(source({ timestamp: 'tomorrow' }), now));
  assert.equal(parseWarframeState(source({ fissures: [] }), now).partial, false);
});

test('Expired and future fissures are excluded; exact mode, tier and search filters preserve expiry ordering', () => {
  const data = parseWarframeState(source({ fissures: [fissure('normal'), fissure('steel', { isHard: true, tierNum: 1, expiry: iso(500_000) }), fissure('storm', { isStorm: true, node: 'Nsu Grid (Veil)', expiry: iso(400_000) }), fissure('expired', { expiry: iso(-1) }), fissure('future', { activation: iso(1) })] }), now);
  assert.deepEqual(warframeFissures(data, now, 'all', 'all', '').map(row => row.id), ['storm', 'steel', 'normal']);
  assert.deepEqual(warframeFissures(data, now, '1', 'steel', ' CORPUS ').map(row => row.id), ['steel']);
  assert.deepEqual(warframeFissures(data, now, '4', 'normal', 'hydra').map(row => row.id), ['normal']);
  assert.deepEqual(warframeFissures(data, now, 'all', 'storm', 'veil').map(row => row.id), ['storm']);
  assert.equal(warframeFissures(data, now, '6', 'all', '').length, 0);
});

test('Hard age limit hides even unexpired entries and rejects future-clock snapshots', () => {
  const data = parseWarframeState(source(), now);
  assert.equal(warframeUsable(data, now + WARFRAME_MAX_AGE - 1), true);
  assert.equal(warframeUsable(data, now + WARFRAME_MAX_AGE), false);
  assert.equal(warframeUsable(data, now - 301_000), false);
  assert.equal(warframeFissures({ ...data, timestamp: now - WARFRAME_MAX_AGE }, now, 'all', 'all', '').length, 0);
});

test('Malformed quantities, duplicates and ambiguous source flags cannot create misleading fissure rows', () => {
  const data = parseWarframeState(source({ fissures: [fissure(), fissure(), fissure('bad-tier', { tierNum: 7 }), fissure('bad-flag', { isHard: 'false' }), fissure('bad-period', { expiry: iso(-70_000) }), fissure('html', { node: '<b>Hydra</b>\u0000' })] }), now);
  assert.equal(data.partial, true); assert.deepEqual(data.fissures.map(row => row.id), ['first', 'html']); assert.equal(data.fissures[1].node, 'Hydra');
});

test('Baro visit state follows source dates and inventory prices are validated as a whole', () => {
  const data = parseWarframeState(source(), now), trader = data.trader!;
  assert.equal(warframeActive(trader, now), false); assert.equal(warframeActive(trader, trader.activation), true); assert.equal(warframeActive(trader, trader.expiry), false);
  const item = { item: 'Primed Continuity', ducats: 350, credits: 100_000 };
  const visit = { ...source().voidTrader, ...period, inventory: [item] };
  assert.deepEqual(parseWarframeState(source({ voidTrader: visit }), now).trader?.inventory, [item]);
  for (const inventory of [[{ ...item, ducats: -1 }], [{ ...item, credits: 1.5 }], [item, item]]) {
    const invalid = parseWarframeState(source({ voidTrader: { ...visit, inventory } }), now);
    assert.equal(invalid.trader, null); assert.equal(invalid.partial, true);
  }
});
