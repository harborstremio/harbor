import assert from 'node:assert/strict';
import test from 'node:test';
import { filterWowAddons, wowAddonGameVersion, wowAddonWebsite, type WowAddon } from '../src/lib/games/wow-addon-data.ts';

const addon = (website = '', wowiId: number | null = null): WowAddon => ({ folder: 'Bagnon', state: 'ready', missingDependencies: [], manifest: { file: 'Bagnon-TBC.toc', title: 'Bagnon', author: 'Jaliborc', version: '12.0.3', notes: '', interfaces: [20505], dependencies: ['BagBrother'], website, wowiId, loadOnDemand: false } });

test('Addon author links prefer exact WoWI IDs and restrict manifest websites to known HTTPS providers', () => {
  assert.equal(wowAddonWebsite(addon('https://example.com', 11190)), 'https://www.wowinterface.com/downloads/info11190.html');
  assert.equal(wowAddonWebsite(addon('https://github.com/Jaliborc/Bagnon')), 'https://github.com/Jaliborc/Bagnon');
  for (const url of ['javascript:alert(1)', 'file:///C:/private', 'http://github.com/a', 'https://github.com.evil.test/a', 'https://user:pass@github.com/a', 'https://github.com:8443/a', 'https://example.com']) assert.equal(wowAddonWebsite(addon(url)), null);
  for (const id of [-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) assert.equal(wowAddonWebsite(addon('', id)), null);
});
test('Interface versions are formatted from their exact declared values without declaring compatibility', () => {
  assert.equal(wowAddonGameVersion(120001), '12.0.1');
  assert.equal(wowAddonGameVersion(20505), '2.5.5');
  for (const value of [0, 9999, 1000000, 20505.1, Number.NaN]) assert.equal(wowAddonGameVersion(value), '');
});
test('Search matches title, folder and author; attention includes read failures and missing required folders', () => {
  const clean = addon(), missing = { ...addon(), folder: 'Other', missingDependencies: ['Missing'] }, unreadable: WowAddon = { folder: 'Unreádable', state: 'unreadable', missingDependencies: [], manifest: null };
  const items = [clean, missing, unreadable];
  assert.deepEqual(filterWowAddons(items, ' jaliborc ', false), [clean, missing]);
  assert.deepEqual(filterWowAddons(items, '', true), [missing, unreadable]);
  assert.deepEqual(filterWowAddons(items, 'Unrea\u0301dable', true), [unreadable]);
  assert.deepEqual(filterWowAddons(items, 'not present', false), []);
});
