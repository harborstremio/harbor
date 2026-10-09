"""How close every method in an extension sits to the JVM's 64KB per method code limit.

Dalvik has no such limit, so an archive can carry a method the JVM cannot hold. Dalvik code size
is not the JVM size the converter will produce, but it is the only number readable without running
the converter, and the two track each other closely enough to name the archives at risk.

  python tools/methodsize.py samples/*.cs3 samples/repo86/*.cs3
  python tools/methodsize.py --min 20000 --json out/methodsize.json samples/repo86/*.cs3
"""

import json
import struct
import sys
import zipfile


def uleb128(b, off):
    result = 0
    shift = 0
    while True:
        byte = b[off]
        off += 1
        result |= (byte & 0x7F) << shift
        if not byte & 0x80:
            return result, off
        shift += 7


class Dex:
    def __init__(self, data):
        self.d = data
        if data[:4] != b"dex\n":
            raise ValueError(f"not a dex: {data[:8]!r}")
        h = struct.unpack_from("<20I", data, 32)
        (self.file_size, self.header_size, self.endian, self.link_size, self.link_off,
         self.map_off, self.string_ids_size, self.string_ids_off, self.type_ids_size,
         self.type_ids_off, self.proto_ids_size, self.proto_ids_off, self.field_ids_size,
         self.field_ids_off, self.method_ids_size, self.method_ids_off, self.class_defs_size,
         self.class_defs_off, self.data_size, self.data_off) = h

    def string(self, i):
        off = struct.unpack_from("<I", self.d, self.string_ids_off + i * 4)[0]
        _, off = uleb128(self.d, off)
        end = self.d.index(b"\x00", off)
        return self.d[off:end].decode("utf-8", "replace")

    def type_name(self, i):
        return self.string(struct.unpack_from("<I", self.d, self.type_ids_off + i * 4)[0])

    def proto(self, i):
        base = self.proto_ids_off + i * 12
        _, ret, params_off = struct.unpack_from("<3I", self.d, base)
        args = []
        if params_off:
            n = struct.unpack_from("<I", self.d, params_off)[0]
            for k in range(n):
                args.append(self.type_name(struct.unpack_from("<H", self.d, params_off + 4 + k * 2)[0]))
        return f"({''.join(args)}){self.type_name(ret)}"

    def method(self, i):
        base = self.method_ids_off + i * 8
        cls, pro = struct.unpack_from("<HH", self.d, base)
        name = struct.unpack_from("<I", self.d, base + 4)[0]
        return self.type_name(cls), self.string(name), self.proto(pro)

    def code_bytes(self, code_off):
        """Dalvik insns size in bytes, plus the try/handler tail that also has to be translated."""
        insns = struct.unpack_from("<I", self.d, code_off + 12)[0]
        tries = struct.unpack_from("<H", self.d, code_off + 6)[0]
        return insns * 2, tries

    def bodies(self):
        out = []
        for i in range(self.class_defs_size):
            base = self.class_defs_off + i * 32
            class_idx = struct.unpack_from("<I", self.d, base)[0]
            data_off = struct.unpack_from("<I", self.d, base + 24)[0]
            if not data_off:
                continue
            owner = self.type_name(class_idx)
            off = data_off
            counts = []
            for _ in range(4):
                v, off = uleb128(self.d, off)
                counts.append(v)
            static_fields, instance_fields, direct_methods, virtual_methods = counts
            for _ in range(static_fields + instance_fields):
                _, off = uleb128(self.d, off)
                _, off = uleb128(self.d, off)
            for count in (direct_methods, virtual_methods):
                idx = 0
                for k in range(count):
                    diff, off = uleb128(self.d, off)
                    _, off = uleb128(self.d, off)
                    code_off, off = uleb128(self.d, off)
                    idx = diff if k == 0 else idx + diff
                    if not code_off:
                        continue
                    size, tries = self.code_bytes(code_off)
                    cls, name, proto = self.method(idx)
                    out.append((owner if owner == cls else cls, name, proto, size, tries))
        return out


LIMIT = 65536


def scan(path):
    z = zipfile.ZipFile(path)
    found = []
    for entry in z.namelist():
        if entry.endswith(".dex"):
            found += Dex(z.read(entry)).bodies()
    return found


def main(argv):
    minimum = 20000
    as_json = None
    paths = []
    i = 0
    while i < len(argv):
        if argv[i] == "--min":
            minimum = int(argv[i + 1])
            i += 2
        elif argv[i] == "--json":
            as_json = argv[i + 1]
            i += 2
        else:
            paths.append(argv[i])
            i += 1

    rows = []
    over = 0
    for path in paths:
        name = path.replace("\\", "/").split("/")[-1]
        try:
            bodies = scan(path)
        except Exception as e:
            print(f"{name}: FAILED {e}")
            continue
        big = sorted((b for b in bodies if b[3] >= minimum), key=lambda b: -b[3])
        largest = max((b[3] for b in bodies), default=0)
        rows.append({
            "archive": name,
            "methods": len(bodies),
            "largest": largest,
            "over_limit": sum(1 for b in bodies if b[3] >= LIMIT),
            "big": [{"class": c, "method": m, "proto": p, "bytes": s, "tries": t} for c, m, p, s, t in big],
        })
        over += rows[-1]["over_limit"]

    rows.sort(key=lambda r: -r["largest"])
    print(f"{'archive':<34} {'methods':>8} {'largest':>9}  over  biggest method")
    for r in rows:
        top = r["big"][0] if r["big"] else None
        label = f"{top['class']}.{top['method']}" if top else ""
        print(f"{r['archive'][:33]:<34} {r['methods']:>8} {r['largest']:>9}  {r['over_limit']:>4}  {label}")
    print()
    print(f"archives scanned {len(rows)}, methods at or over {LIMIT} bytes of Dalvik code: {over}")
    print(f"archives with a method at or over {minimum} bytes: {sum(1 for r in rows if r['big'])}")
    if as_json:
        with open(as_json, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=1)
        print(f"wrote {as_json}")


if __name__ == "__main__":
    main(sys.argv[1:])
