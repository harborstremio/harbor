import assert from 'node:assert/strict';
import test from 'node:test';
import { DEADLOCK_BUILD_PAGE, deadlockBuildGroupKey, deadlockBuildImage, deadlockBuildLanguage, deadlockBuildItemsUrl, deadlockBuildsUrl, parseDeadlockBuildAbilities, parseDeadlockBuildItems, parseDeadlockBuilds } from '../src/lib/games/deadlock-builds-data.ts';

const build = (id = 10, extra = {}) => ({ hero_build: { hero_id: 1, hero_build_id: id, version: 2, name: 'Item guide', last_updated_timestamp: 1790800000, details: { mod_categories: [{ name: 'Early', mods: [{ ability_id: 4_000_000_000, annotation: 'Buy only if needed', imbue_target_ability_id: 1593133799, required_flex_slots: 2 }] }] }, ...extra }, num_weekly_favorites: null });
const item = (id = 4_000_000_000, extra = {}) => ({ id, type: 'upgrade', name: 'Item', cost: 800, shopable: true, item_slot_type: 'weapon', ...extra });

test('built-in category tokens get translated without replacing author-written names', () => {
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_EarlyGame'), 'early');
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_Mid'), 'mid');
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_LateGame'), 'late');
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_Lane'), 'lane');
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_OptionalShort'), 'optional');
  assert.equal(deadlockBuildGroupKey('#Citadel_HeroBuilds_FutureToken'), 'group');
  assert.equal(deadlockBuildGroupKey('Early Game 800 Souls'), null);
  assert.equal(deadlockBuildGroupKey('#My optional choices'), null);
});

test('builds retain author groups, uint32 item IDs, optional choices and exact imbue references', () => {
  const source = build(10, { details: { mod_categories: [{ name: 'Options', description: 'Choose one', optional: true, mods: [{ ability_id: 4_000_000_000, annotation: 'Save for later', imbue_target_ability_id: 1593133799, required_flex_slots: 2 }] }] } });
  const parsed = parseDeadlockBuilds([source], 1).builds[0];
  assert.equal(parsed.id, 10); assert.equal(parsed.version, 2); assert.equal(parsed.updated, 1790800000000); assert.equal(parsed.weekly, null);
  assert.deepEqual(parsed.groups[0], { name: 'Options', note: 'Choose one', optional: true, items: [{ id: 4_000_000_000, note: 'Save for later', imbue: 1593133799, flex: 2 }] });
  assert.equal(source.hero_build.details.mod_categories[0].mods[0].ability_id, 4_000_000_000);
});

test('wrong hero, invalid build identity and oversized guides reject instead of attaching another hero’s content', () => {
  for (const input of [build(10, { hero_id: 2 }), build(0), build(10, { version: '2' }), build(10, { name: '' }), build(10, { details: { mod_categories: [{ mods: [{ ability_id: -1 }] }] } })]) assert.throws(() => parseDeadlockBuilds([input], 1));
  assert.throws(() => parseDeadlockBuilds({}, 1)); assert.throws(() => parseDeadlockBuilds(Array.from({ length: 101 }, (_, i) => build(i + 1)), 1));
  assert.throws(() => parseDeadlockBuilds([build(10, { details: { mod_categories: Array.from({ length: 6 }, () => ({ mods: Array.from({ length: 100 }, () => ({ ability_id: 1 })) })) } })], 1));
});

test('paging uses an extra result, latest duplicate versions win, and unknown favorites never become zero', () => {
  const result = parseDeadlockBuilds(Array.from({ length: DEADLOCK_BUILD_PAGE + 1 }, (_, i) => build(i + 1)), 1);
  assert.equal(result.builds.length, DEADLOCK_BUILD_PAGE); assert.equal(result.more, true);
  const versions = parseDeadlockBuilds([build(10), build(10, { version: 1 }), { ...build(10, { version: 3 }), num_weekly_favorites: 0 }, build(11, { development_build: true })], 1);
  assert.equal(versions.builds.length, 1); assert.equal(versions.builds[0].version, 3); assert.equal(versions.builds[0].weekly, 0);
  assert.deepEqual(parseDeadlockBuilds([], 1), { builds: [], more: false });
});

test('author text is bounded plain text and absent timestamps are not refreshed to now', () => {
  const result = parseDeadlockBuilds([build(10, { name: '<b>Guide</b>', description: '<script>bad()</script>Hello\nthere\u0000', last_updated_timestamp: null })], 1).builds[0];
  assert.equal(result.name, 'Guide'); assert.equal(result.note, 'Hello\nthere'); assert.equal(result.updated, null);
  assert.equal(parseDeadlockBuilds([build(10, { description: 'x'.repeat(20000) })], 1).builds[0].note.length, 16000);
});

test('definition parser preserves removed items and only accepts exact original media origins', () => {
  const image = 'https://assets-bucket.deadlock-api.com/assets-api-res/images/items/weapon/basic_magazine.webp';
  const values = parseDeadlockBuildItems([item(1, { shop_image_webp: image }), item(2, { shopable: false, cost: null }), item(3, { cost: 0 }), item(4, { type: 'ability' })]);
  assert.equal(values[0].image, image); assert.equal(values[1].shopable, false); assert.equal(values[1].cost, null); assert.equal(values[2].cost, 0); assert.equal(values.length, 3);
  for (const bad of ['javascript:alert(1)', image.replace('https:', 'http:'), image.replace('.com/', '.com.evil.test/'), image.replace('https://', 'https://user@'), image.replace('.webp', '.svg'), image.replace('/images/items/', '/images/heroes/')]) assert.equal(deadlockBuildImage(bad), '');
  assert.throws(() => parseDeadlockBuildItems([item(1), item(1)])); assert.throws(() => parseDeadlockBuildItems([]));
});

test('imbue names cannot come from another hero; shared abilities must explicitly include the selected hero', () => {
  const abilities = parseDeadlockBuildAbilities([{ id: 1, name: 'Right', type: 'ability', hero: 1 }, { id: 2, name: 'Other', type: 'ability', hero: 2 }, { id: 3, name: 'Shared', type: 'ability', heroes: [1, 2] }], 1);
  assert.deepEqual(abilities.map(value => value.name), ['Right', 'Shared']);
});

test('queries preserve exact hero, source sorting, language scope and bounded encoded searches', () => {
  const query = new URL(deadlockBuildsUrl(1, 'updated_at', ' test & hero_id=2 ', 'de', 8));
  assert.equal(query.searchParams.get('hero_id'), '1'); assert.equal(query.searchParams.get('search_name'), 'test & hero_id=2'); assert.equal(query.searchParams.get('build_language'), 'German'); assert.equal(query.searchParams.get('only_latest'), 'true'); assert.equal(query.searchParams.get('limit'), '9'); assert.equal(query.searchParams.get('start'), '8');
  assert.equal(new URL(deadlockBuildsUrl(1, 'weekly_favorites', '', 'all', 0)).searchParams.has('build_language'), false);
  assert.equal(deadlockBuildLanguage('ar'), 'en'); assert.ok(deadlockBuildItemsUrl('de').endsWith('language=german'));
  for (const offset of [-1, 1.2, 10001]) assert.throws(() => deadlockBuildsUrl(1, 'updated_at', '', 'en', offset));
});
