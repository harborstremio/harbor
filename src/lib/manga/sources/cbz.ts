const IMG_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

export type CbzEntry = { name: string; data: Uint8Array };

export async function readCbzImages(bytes: Uint8Array): Promise<CbzEntry[]> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = bytes.length;

  let eocd = -1;
  const scanFrom = Math.max(0, len - 22 - 65536);
  for (let i = len - 22; i >= scanFrom; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return [];

  const cdCount = dv.getUint16(eocd + 10, true);
  let cd = dv.getUint32(eocd + 16, true);

  const out: CbzEntry[] = [];
  for (let n = 0; n < cdCount; n++) {
    if (cd + 46 > len || dv.getUint32(cd, true) !== 0x02014b50) break;
    const method = dv.getUint16(cd + 10, true);
    const compSize = dv.getUint32(cd + 20, true);
    const nameLen = dv.getUint16(cd + 28, true);
    const extraLen = dv.getUint16(cd + 30, true);
    const commentLen = dv.getUint16(cd + 32, true);
    const localOffset = dv.getUint32(cd + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    cd += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/") || !IMG_RE.test(name)) continue;
    if (localOffset + 30 > len) continue;

    const lhNameLen = dv.getUint16(localOffset + 26, true);
    const lhExtraLen = dv.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lhNameLen + lhExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + compSize);

    try {
      if (method === 0) out.push({ name, data: raw });
      else if (method === 8) out.push({ name, data: await inflateRaw(raw) });
    } catch {
      /* skip unreadable entry */
    }
  }
  return out;
}
