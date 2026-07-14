// ponytail: Tizen .wgt is just a zip of dist/ with .wgt extension.
// No native deps - Node 18+ has zlib and fs, we build the zip manually.

import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { deflateRawSync, crc32 } from 'node:zlib';

const distDir = join(process.cwd(), 'dist');
const outFile = join(process.cwd(), 'harbor-tizen.wgt');

async function collectFiles(dir, base = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) {
      files.push(...await collectFiles(full, rel));
    } else {
      files.push({ rel, full });
    }
  }
  return files;
}

function writeU16(v) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}

function writeU32(v) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(v >>> 0);
  return b;
}

// Minimal ZIP builder (deflate compression)
function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.rel, 'utf8');
    const compressed = deflateRawSync(f.data);
    const crc = crc32(f.data);

    const local = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x03, 0x04]),
      writeU16(20), writeU16(0), writeU16(8),
      Buffer.alloc(4),
      writeU32(crc),
      writeU32(compressed.length),
      writeU32(f.data.length),
      writeU16(nameBuf.length),
      writeU16(0),
      nameBuf,
      compressed,
    ]);

    localParts.push(local);

    const central = Buffer.concat([
      Buffer.from([0x50, 0x4B, 0x01, 0x02]),
      writeU16(20), writeU16(20), writeU16(0), writeU16(8),
      Buffer.alloc(4),
      writeU32(crc),
      writeU32(compressed.length),
      writeU32(f.data.length),
      writeU16(nameBuf.length),
      writeU16(0), writeU16(0), writeU16(0), writeU16(0), Buffer.alloc(4),
      writeU32(offset),
      nameBuf,
    ]);

    centralParts.push(central);
    offset += local.length;
  }

  const centralBuf = Buffer.concat(centralParts);
  const endRecord = Buffer.concat([
    Buffer.from([0x50, 0x4B, 0x05, 0x06]),
    writeU16(0), writeU16(0), writeU16(files.length), writeU16(files.length),
    writeU32(centralBuf.length),
    writeU32(offset),
    writeU16(0),
  ]);

  return Buffer.concat([...localParts, centralBuf, endRecord]);
}

async function main() {
  const list = await collectFiles(distDir);
  const files = [];
  for (const f of list) {
    const data = await readFile(f.full);
    files.push({ rel: f.rel, data });
  }

  console.log(`Packaging ${files.length} files into harbor-tizen.wgt...`);
  const zip = buildZip(files);
  await writeFile(outFile, zip);

  const size = (await stat(outFile)).size;
  console.log(`Done: harbor-tizen.wgt (${(size / 1024).toFixed(1)} KB)`);
  console.log('Sideload via Tizen Studio or: sdb push harbor-tizen.wgt /opt/usr/apps/');
}

main().catch((e) => {
  console.error('Package failed:', e);
  process.exit(1);
});
