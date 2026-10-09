import test from 'node:test';
import assert from 'node:assert/strict';
import { humbleBundlePaths, parseHumbleBundle, bundlesWithGame } from '../src/lib/games/humble-bundle-data.ts';
const now = Date.parse('2026-09-30T20:00:00Z');
const html = (id: string, data: unknown) => `<script id="${id}" type="application/json">${JSON.stringify(data)}</script>`;
test('live Humble listing excludes expired, future and foreign destinations', () => {
  const product = { product_url: '/games/collection', 'start_date|datetime': '2026-09-01T00:00:00', 'end_date|datetime': '2026-10-01T00:00:00' };
  assert.deepEqual(humbleBundlePaths(html('landingPage-json-data', { data: { games: { mosaic: [{ products: [product, product, { ...product, product_url: 'https://evil.test/games/foo' }, { ...product, 'end_date|datetime': '2026-09-01T00:00:00' }] }] } } }), now), ['/games/collection']);
});
test('bundle membership is explicit and excludes sold-out tiers; exact edition stays distinct', () => {
  const data = { bundleData: { basic_data: { human_name: 'A collection', 'end_time|datetime': '2026-10-01T00:00:00' }, tier_display_data: { a: { sold_out: false, tier_item_machine_names: ['a'] }, b: { sold_out: true, tier_item_machine_names: ['b'] } }, tier_item_data: { a: { human_name: 'Test™ II', item_content_type: 'game' }, b: { human_name: 'Test', item_content_type: 'game' } } } };
  const bundle = parseHumbleBundle(html('webpack-bundle-page-data', data), '/games/collection', now)!;
  assert.equal(bundlesWithGame([bundle], 'test II', now).length, 1);
  for (const title of ['Test', 'Test II Deluxe', 'Test II soundtrack']) assert.equal(bundlesWithGame([bundle], title, now).length, 0);
  assert.equal(bundlesWithGame([bundle], 'Test II', now + 86400000).length, 0);
  assert.throws(() => parseHumbleBundle('<h1>Blocked</h1>', '/games/collection', now));
});
