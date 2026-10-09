import assert from 'node:assert/strict';
import test from 'node:test';
import { parseOfficialWarframeState, parseWarframeMapping, type WarframeMappings } from '../src/lib/games/warframe-official-data.ts';
import { warframeActive, warframeFissures } from '../src/lib/games/warframe-data.ts';

const now = Date.parse('2026-10-01T04:23:47Z');
const date = (ms: number) => ({ $date: { $numberLong: String(ms) } });
const id = (value: string) => ({ $oid: value });
const window = { Activation: date(now - 60_000), Expiry: date(now + 600_000) };
const maps: WarframeMappings = {
  solNodes: { SolNode171: { value: 'Saxis (Eris)', type: 'Hive', enemy: 'Infestation' }, SolNode16: { value: 'Augustus (Mars)', type: 'Rescue', enemy: 'Grineer' }, SaturnHUB: { value: 'Kronia Relay (Saturn)' }, CrewBattleNode535: { value: 'Calabash (Veil)', type: 'Skirmish', enemy: 'Grineer' } },
  missionTypes: { MT_HIVE: { value: 'Hive' }, MT_ARTIFACT: { value: 'Disruption' } },
  sortieData: { bosses: { SORTIE_BOSS_PHORID: { name: 'Phorid' }, SORTIE_BOSS_AMAR: { name: 'Archon Amar' } }, modifierTypes: { SORTIE_MODIFIER_LOW_ENERGY: 'Energy Reduction' }, modifierDescriptions: { SORTIE_MODIFIER_LOW_ENERGY: 'Maximum Warframe Energy capacity is quartered.' } },
  languages: { '/Lotus/PrimedContinuity': { value: 'Primed Continuity' } },
};
const raw = (change = {}) => ({
  Time: now / 1000,
  SyndicateMissions: ['CetusSyndicate', 'ZarimanSyndicate'].map(Tag => ({ Tag, Expiry: date(Date.parse('2026-10-01T05:16:19.870Z')) })),
  Sorties: [{ _id: id('sortie'), ...window, Boss: 'SORTIE_BOSS_PHORID', Variants: [{ missionType: 'MT_HIVE', node: 'SolNode171', modifierType: 'SORTIE_MODIFIER_LOW_ENERGY' }] }],
  LiteSorties: [{ _id: id('archon'), ...window, Boss: 'SORTIE_BOSS_AMAR', Missions: [{ missionType: 'MT_ARTIFACT', node: 'SolNode16' }] }],
  ActiveMissions: [{ _id: id('normal'), ...window, Node: 'SolNode171', MissionType: 'MT_HIVE', Modifier: 'VoidT3' }, { _id: id('steel'), ...window, Node: 'SolNode16', MissionType: 'MT_ARTIFACT', Modifier: 'VoidT6', Hard: true }],
  VoidStorms: [{ _id: id('storm'), ...window, Node: 'CrewBattleNode535', ActiveMissionTier: 'VoidT2' }],
  VoidTraders: [{ _id: id('baro'), ...window, Character: "Baro'Ki Teel", Node: 'SaturnHUB', Manifest: [{ ItemType: '/Lotus/PrimedContinuity', PrimePrice: 350, RegularPrice: 100000 }] }],
  ...change,
});

test('Official IDs resolve through explicit dictionaries, retaining ordinary/Steel Path/storm identity and ordered mission meaning', () => {
  const state = parseOfficialWarframeState(raw(), maps, now);
  assert.equal(state.source, 'official'); assert.equal(state.timestamp, now); assert.equal(state.partial, false);
  assert.deepEqual(state.fissures.map(f => [f.id, f.node, f.type, f.tier, f.hard, f.storm]), [['normal','Saxis (Eris)','Hive',3,false,false],['steel','Augustus (Mars)','Disruption',6,true,false],['storm','Calabash (Veil)','Skirmish',2,false,true]]);
  assert.equal(state.sortie?.boss, 'Phorid'); assert.equal(state.sortie?.missions[0].modifier, 'Energy Reduction'); assert.equal(state.archon?.missions[0].type, 'Disruption');
  assert.deepEqual(state.trader?.inventory, [{ item: 'Primed Continuity', ducats: 350, credits: 100000 }]);
});

test('Cycle rules match independently observed provider boundaries and use the official clock, not parse time', () => {
  const state = parseOfficialWarframeState(raw(), maps, now);
  assert.deepEqual(state.cycles.map(c => [c.world,c.state,new Date(c.expiry).toISOString()]), [
    ['cetus','day','2026-10-01T04:26:00.000Z'],['vallis','cold','2026-10-01T04:40:08.000Z'],['cambion','fass','2026-10-01T04:26:00.000Z'],['duviri','fear','2026-10-01T06:00:00.000Z'],['earth','night','2026-10-01T08:00:00.000Z'],['zariman','corpus','2026-10-01T05:16:00.000Z'],
  ]);
  const later = parseOfficialWarframeState(raw(), maps, now + 3600_000);
  assert.deepEqual(later.cycles, state.cycles); assert.equal(later.timestamp, now);
  assert.equal(warframeActive(later.cycles[0], now + 3600_000), false);
  assert.equal(warframeFissures(later, now + 3600_000, 'all', 'all', '').length, 0);
});

test('Unknown nodes/types never appear as internal IDs or borrowed mission names, and independent sections survive', () => {
  const fixture = raw(); fixture.ActiveMissions[0].Node = 'SolNode999999'; fixture.LiteSorties[0].Missions[0].missionType = 'MT_UNKNOWN';
  const state = parseOfficialWarframeState(fixture, maps, now);
  assert.equal(state.partial, true); assert.equal(state.fissures.length, 2); assert.equal(state.archon, null); assert.equal(state.sortie?.missions[0].node, 'Saxis (Eris)');
  assert.ok(!JSON.stringify(state).includes('SolNode999999'));
});

test('Invalid flags, dates, duplicate or ambiguous chains are rejected instead of silently joining source records', () => {
  const fixture = raw(); fixture.Sorties.push(structuredClone(fixture.Sorties[0]));
  const state = parseOfficialWarframeState({ ...fixture, ActiveMissions: [{ ...fixture.ActiveMissions[0], Hard: 'false' }, { ...fixture.ActiveMissions[1], Expiry: { $date: { $numberLong: 'NaN' } } }] }, maps, now);
  assert.equal(state.sortie, null); assert.equal(state.fissures.length, 1); assert.equal(state.partial, true);
  assert.throws(() => parseOfficialWarframeState({ ...fixture, Time: (now + 301000) / 1000 }, maps, now));
  assert.throws(() => parseOfficialWarframeState({ ...fixture, Time: '1790828627' }, maps, now));
});

test('Expired bounty anchors cannot manufacture new Cetus/Cambion/Zariman periods', () => {
  const state = parseOfficialWarframeState(raw({ SyndicateMissions: [{ Tag: 'CetusSyndicate', Expiry: date(now - 1) }, { Tag: 'ZarimanSyndicate', Expiry: date(now - 1) }] }), maps, now);
  assert.equal(state.partial, true); assert.deepEqual(state.cycles.map(c => c.world), ['vallis','duviri','earth']);
});

test('Inventory cannot borrow an unknown item label, invent a zero price or combine overlapping Baro visits', () => {
  const fixture = raw();
  const unknown = parseOfficialWarframeState({ ...fixture, VoidTraders: [{ ...fixture.VoidTraders[0], Manifest: [{ ItemType: '/unknown', PrimePrice: 0, RegularPrice: 1 }] }] }, maps, now);
  assert.equal(unknown.trader, null); assert.equal(unknown.partial, true);
  const missingPrice = parseOfficialWarframeState({ ...fixture, VoidTraders: [{ ...fixture.VoidTraders[0], Manifest: [{ ItemType: '/Lotus/PrimedContinuity', PrimePrice: 0 }] }] }, maps, now);
  assert.equal(missingPrice.trader, null);
  const ambiguous = parseOfficialWarframeState({ ...fixture, VoidTraders: [...fixture.VoidTraders, fixture.VoidTraders[0]] }, maps, now);
  assert.equal(ambiguous.trader, null);
});

test('Mapping inputs require bounded objects, and invalid sections cannot poison valid cycles', () => {
  for (const value of [null, [], {}, 'mapping']) assert.throws(() => parseWarframeMapping(value));
  assert.throws(() => parseWarframeMapping(Object.fromEntries(Array.from({ length: 50001 }, (_, i) => [i, {}]))));
  const state = parseOfficialWarframeState(raw({ Sorties: null, VoidStorms: null, VoidTraders: null }), maps, now);
  assert.equal(state.partial, true); assert.equal(state.cycles.length, 6); assert.equal(state.fissures.length, 2);
});
