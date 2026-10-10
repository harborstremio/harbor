import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWowEquipment, wowEquipmentIcon, WOW_EQUIPMENT_SLOTS } from '../src/lib/games/wow-equipment.ts';
import { parseWowCharacter } from '../src/lib/games/wow-character-data.ts';

const item = (extra = {}) => ({ item_id: 271474, item_level: 321, name: "Baleful Grave-Knight's Casque", icon: 'inv_helm_plate_raiddeathknightulatek_d_01', gems: [240906], gems_detail: [{ id: 240906, name: '16 Crit & 7 Haste', icon: 'gem_nature' }], enchants: [7991], enchants_detail: [{ id: 243981, name: 'Empowered Blessing of Speed', icon: 'enchant_vellum' }], ...extra });
test('Equipment follows anatomical slot order and preserves duplicate equipped items in distinct slots', () => {
  const data = parseWowEquipment({ finger2: item(), head: item(), finger1: item() })!;
  assert.deepEqual(data.items.map(x => x.slot), ['head', 'finger1', 'finger2']);
  assert.equal(data.partial, false); assert.equal(WOW_EQUIPMENT_SLOTS.length, 18);
  assert.equal(data.items[0]?.enchants.complete, true); // Item and spell-enchantment IDs deliberately differ.
});
test('Unknown or corrupt gear cannot become valid empty equipment or fabricated item levels', () => {
  for (const value of [null, [], {}, { head: null }, { head: item({ item_id: -1 }) }, Object.fromEntries(Array.from({ length: 41 }, (_, i) => [String(i), {}]))]) assert.equal(parseWowEquipment(value), null);
  const data = parseWowEquipment({ head: item({ item_level: -1 }), neck: item({ name: '' }), notASlot: item() })!;
  assert.equal(data.items.length, 1); assert.equal(data.items[0]?.level, null); assert.equal(data.partial, true);
  assert.equal(parseWowEquipment({ head: item({ name: 'x'.repeat(241) }) }), null);
});
test('Source icon stems are restricted to the existing Raider.IO image host and path', () => {
  assert.match(wowEquipmentIcon('inv_helm_plate_01'), /^https:\/\/cdn\.raiderio\.net\/images\/wow\/icons\/large\/inv_helm_plate_01\.jpg$/);
  for (const value of ['../../secret', 'https://evil.test/x', 'icon?x=1', 'name.jpg', 'x'.repeat(151), null, 42]) assert.equal(wowEquipmentIcon(value), '');
  assert.equal(parseWowEquipment({ head: item({ icon: 'bad/icon' }) })?.items[0]?.name, "Baleful Grave-Knight's Casque");
});
test('Enhancement coverage distinguishes observed absence, missing descriptions and partial records', () => {
  const cases = [
    { gems: [], gems_detail: [], complete: true, count: 0 },
    { gems: [1], gems_detail: [], complete: false, count: 0 },
    { gems: undefined, gems_detail: undefined, complete: false, count: 0 },
    { gems: [1, 2], gems_detail: [{ id: 1, name: 'Valid' }, { id: 2, name: '' }], complete: false, count: 1 },
    { gems: [1, 1], gems_detail: [{ id: 1, name: 'Duplicate gem' }, { id: 1, name: 'Duplicate gem' }], complete: true, count: 2 },
    { gems: [1], gems_detail: Array.from({ length: 21 }, () => ({ id: 1, name: 'Too many' })), complete: false, count: 0 },
  ];
  for (const { complete, count, ...fields } of cases) { const result = parseWowEquipment({ head: item(fields) })!.items[0]!.gems; assert.equal(result.complete, complete); assert.equal(result.items.length, count); }
});
test('Production character parsing attaches equipment without requiring a Mythic+ score or changing identity checks', () => {
  const target = { region: 'eu' as const, realm: 'silvermoon', name: 'Example' };
  const raw = { name: 'Example', region: 'eu', realm: 'Silvermoon', profile_url: 'https://raider.io/characters/eu/silvermoon/Example', gear: { item_level_equipped: 300, items: { head: item() } } };
  const data = parseWowCharacter(raw, target);
  assert.equal(data.equipment?.items[0]?.id, 271474); assert.equal(data.score, null); assert.equal(data.itemLevel, 300);
  assert.throws(() => parseWowCharacter({ ...raw, region: 'us' }, target));
});
