const NAME_TAG = 0x6e616d65;

function u16(v: DataView, o: number): number {
  return o + 2 <= v.byteLength ? v.getUint16(o) : 0;
}

function u32(v: DataView, o: number): number {
  return o + 4 <= v.byteLength ? v.getUint32(o) : 0;
}

function decodeName(v: DataView, off: number, len: number, wide: boolean): string {
  if (off + len > v.byteLength) return "";
  const bytes: number[] = [];
  if (wide) {
    for (let i = 0; i + 1 < len; i += 2) bytes.push(v.getUint16(off + i));
  } else {
    for (let i = 0; i < len; i++) bytes.push(v.getUint8(off + i));
  }
  return String.fromCharCode(...bytes).replace(/\0/g, "").trim();
}

function readNameTable(v: DataView, tableOff: number): string {
  const count = u16(v, tableOff + 2);
  const storage = tableOff + u16(v, tableOff + 4);
  let family = "";
  let typographic = "";
  for (let i = 0; i < count; i++) {
    const rec = tableOff + 6 + i * 12;
    const platform = u16(v, rec);
    const nameId = u16(v, rec + 6);
    if (nameId !== 1 && nameId !== 16) continue;
    const len = u16(v, rec + 8);
    const off = storage + u16(v, rec + 10);
    const text = decodeName(v, off, len, platform === 3 || platform === 0);
    if (!text) continue;
    if (nameId === 16) typographic ||= text;
    else family ||= text;
  }
  return typographic || family;
}

export function sfntFamilyName(buf: ArrayBuffer): string | null {
  try {
    const v = new DataView(buf);
    if (v.byteLength < 12) return null;
    let base = 0;
    if (u32(v, 0) === 0x74746366) base = u32(v, 12);
    const tag = u32(v, base);
    if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) return null;
    const numTables = u16(v, base + 4);
    for (let i = 0; i < numTables; i++) {
      const rec = base + 12 + i * 16;
      if (u32(v, rec) !== NAME_TAG) continue;
      const name = readNameTable(v, u32(v, rec + 8));
      return name || null;
    }
    return null;
  } catch {
    return null;
  }
}
