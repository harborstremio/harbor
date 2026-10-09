/** Build the small EVE system directory from CCP's versioned SDE. No full ZIP download.
 * node scripts/build-eve-universe.mjs BUILD RELEASE_ISO OUTPUT.json
 * Supply the build/release pair from https://developers.eveonline.com/static-data/tranquility/latest.json
 * Review the output before updating EVE_UNIVERSE and its dated public asset.
 */
import fs from 'node:fs/promises';
import { inflateRawSync } from 'node:zlib';
import { parseEveUniverse } from '../src/lib/games/eve-data.ts';

const [buildText, released, output] = process.argv.slice(2), build = Number(buildText);
if (!Number.isSafeInteger(build) || build < 1 || !Number.isFinite(Date.parse(released ?? '')) || !output?.endsWith('.json')) throw Error('Usage: node scripts/build-eve-universe.mjs BUILD RELEASE_ISO OUTPUT.json');
const url = `https://developers.eveonline.com/static-data/tranquility/eve-online-static-data-${build}-jsonl.zip`;
const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(15000) }), size = Number(head.headers.get('content-length'));
if (!head.ok || !Number.isSafeInteger(size) || size < 65557 || size > 1_000_000_000) throw Error('Invalid SDE size');
let downloaded = 0;
async function range(start, end) {
  if (start < 0 || end >= size || end < start || end - start > 5_000_000) throw Error('Invalid range');
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(20000) });
  if (response.status !== 206 || response.headers.get('content-range') !== `bytes ${start}-${end}/${size}`) { await response.body?.cancel(); throw Error('SDE host did not honor bounded Range'); }
  const reader = response.body.getReader(), chunks = []; let bytes = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > end - start + 1) throw Error('Oversize SDE range'); chunks.push(part.value); } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (bytes !== end - start + 1) throw Error('Incomplete SDE range'); downloaded += bytes; return Buffer.concat(chunks);
}
function crc32(buffer) { let crc = -1; for (const byte of buffer) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ -1) >>> 0; }
const tail = await range(size - 65557, size - 1), end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (end < 0 || end + 22 > tail.length) throw Error('Missing ZIP directory');
const indexSize = tail.readUInt32LE(end + 12), indexAt = tail.readUInt32LE(end + 16);
if (!indexSize || indexSize > 2_000_000) throw Error('Oversize ZIP directory');
const index = await range(indexAt, indexAt + indexSize - 1), entries = new Map();
for (let at = 0; at < index.length;) {
  if (index.readUInt32LE(at) !== 0x02014b50) throw Error('Invalid ZIP entry');
  const length = index.readUInt16LE(at + 28), extra = index.readUInt16LE(at + 30), comment = index.readUInt16LE(at + 32), name = index.subarray(at + 46, at + 46 + length).toString();
  if (entries.has(name)) throw Error('Duplicate ZIP entry');
  entries.set(name, { flags: index.readUInt16LE(at + 8), method: index.readUInt16LE(at + 10), crc: index.readUInt32LE(at + 16), packed: index.readUInt32LE(at + 20), unpacked: index.readUInt32LE(at + 24), offset: index.readUInt32LE(at + 42) }); at += 46 + length + extra + comment;
}
async function records(name) {
  const entry = entries.get(name);
  if (!entry || (entry.flags & 1) || ![0, 8].includes(entry.method) || entry.packed > 5_000_000 || entry.unpacked > 30_000_000) throw Error('Unsupported SDE entry');
  const header = await range(entry.offset, entry.offset + 29);
  if (header.readUInt32LE(0) !== 0x04034b50) throw Error('Invalid local ZIP header');
  const start = entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28), packed = await range(start, start + entry.packed - 1);
  const bytes = entry.method === 8 ? inflateRawSync(packed, { maxOutputLength: entry.unpacked }) : packed;
  if (bytes.length !== entry.unpacked || crc32(bytes) !== entry.crc) throw Error('SDE checksum mismatch');
  return bytes.toString('utf8').trim().split('\n').map(line => JSON.parse(line));
}
const systems = await records('mapSolarSystems.jsonl'), constellations = await records('mapConstellations.jsonl'), regions = await records('mapRegions.jsonl');
const names = value => Object.fromEntries(Object.entries(value).filter(([language, text]) => language === 'en' || text !== value.en));
const con = new Map(constellations.map(value => [value._key, value])), reg = new Map(regions.map(value => [value._key, value]));
const data = { schema: 1, build, released, systems: systems.filter(value => value._key >= 30000000 && value._key < 32000000).map(value => [value._key, names(value.name), value.securityStatus, value.constellationID, value.regionID, value.wormholeClassID ?? con.get(value.constellationID)?.wormholeClassID ?? reg.get(value.regionID)?.wormholeClassID ?? 0]), constellations: constellations.map(value => [value._key, names(value.name)]), regions: regions.map(value => [value._key, names(value.name)]) };
parseEveUniverse(data);
await fs.writeFile(output, JSON.stringify(data), { flag: 'wx' });
console.log(JSON.stringify({ build, released, systems: data.systems.length, downloaded, archiveBytes: size, output }));
