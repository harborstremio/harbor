async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function unzip(buffer: ArrayBuffer): Promise<Map<string, Uint8Array>> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const out = new Map<string, Uint8Array>();

  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Not a valid zip file");

  const count = view.getUint16(eocd + 10, true);
  let cd = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();

  for (let n = 0; n < count; n += 1) {
    if (cd + 46 > buffer.byteLength || view.getUint32(cd, true) !== 0x02014b50) break;
    const method = view.getUint16(cd + 10, true);
    const compSize = view.getUint32(cd + 20, true);
    const fnLen = view.getUint16(cd + 28, true);
    const extraLen = view.getUint16(cd + 30, true);
    const commentLen = view.getUint16(cd + 32, true);
    const localOff = view.getUint32(cd + 42, true);
    const name = decoder.decode(bytes.subarray(cd + 46, cd + 46 + fnLen));

    if (!name.endsWith("/")) {
      const lfnLen = view.getUint16(localOff + 26, true);
      const lextraLen = view.getUint16(localOff + 28, true);
      const dataStart = localOff + 30 + lfnLen + lextraLen;
      const comp = bytes.subarray(dataStart, dataStart + compSize);
      out.set(name, method === 8 ? await inflateRaw(comp) : comp.slice());
    }
    cd += 46 + fnLen + extraLen + commentLen;
  }
  return out;
}
