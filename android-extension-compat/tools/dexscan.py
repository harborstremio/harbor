"""What a CloudStream .cs3 actually needs from its host.

Reads the DEX directly: every type the plugin references, minus every type it defines, is a
class the host has to provide or the plugin dies with NoClassDefFoundError on load.
"""

import io
import json
import re
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
        if data[:8] not in (b"dex\n035\x00", b"dex\n036\x00", b"dex\n037\x00", b"dex\n038\x00", b"dex\n039\x00"):
            raise ValueError(f"not a dex: {data[:8]!r}")
        h = struct.unpack_from("<20I", data, 32)
        # header after magic(8)+checksum(4)+signature(20) = offset 32
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
        idx = struct.unpack_from("<I", self.d, self.type_ids_off + i * 4)[0]
        return self.string(idx)

    def types(self):
        return [self.type_name(i) for i in range(self.type_ids_size)]

    def defined(self):
        out = []
        for i in range(self.class_defs_size):
            cidx = struct.unpack_from("<I", self.d, self.class_defs_off + i * 32)[0]
            out.append(self.type_name(cidx))
        return out

    def methods(self):
        out = []
        for i in range(self.method_ids_size):
            c, p = struct.unpack_from("<HH", self.d, self.method_ids_off + i * 8)
            n = struct.unpack_from("<I", self.d, self.method_ids_off + i * 8 + 4)[0]
            out.append((self.type_name(c), self.string(n)))
        return out


def descriptor_to_name(d):
    if d.startswith("[") :
        return descriptor_to_name(d.lstrip("["))
    if d.startswith("L") and d.endswith(";"):
        return d[1:-1].replace("/", ".")
    return None  # primitive


def scan(path):
    z = zipfile.ZipFile(path)
    names = z.namelist()
    dexes = [n for n in names if n.endswith(".dex")]
    manifest = json.loads(z.read("manifest.json")) if "manifest.json" in names else {}
    refs, defs, methods = set(), set(), []
    for n in dexes:
        dx = Dex(z.read(n))
        for t in dx.types():
            nm = descriptor_to_name(t)
            if nm:
                refs.add(nm)
        for t in dx.defined():
            nm = descriptor_to_name(t)
            if nm:
                defs.add(nm)
        methods += [(descriptor_to_name(c) or c, m) for c, m in dx.methods()]
    return manifest, refs, defs, methods, names


def bucket(name):
    for prefix, label in [
        ("com.lagradost.cloudstream3", "cloudstream api"),
        ("com.lagradost.nicehttp", "cloudstream http"),
        ("com.lagradost", "cloudstream other"),
        ("android.", "android platform"),
        ("androidx.", "android platform"),
        ("java.", "jvm stdlib"),
        ("javax.", "jvm stdlib"),
        ("kotlin.", "kotlin stdlib"),
        ("kotlinx.", "kotlin stdlib"),
        ("org.jsoup", "jsoup"),
        ("okhttp3", "okhttp"),
        ("okio", "okhttp"),
        ("com.google.gson", "gson"),
        ("com.fasterxml.jackson", "jackson"),
        ("org.json", "json"),
    ]:
        if name.startswith(prefix):
            return label
    return "other"


if __name__ == "__main__":
    import collections

    totals = collections.Counter()
    per_file = []
    api_methods = collections.Counter()
    for path in sys.argv[1:]:
        try:
            manifest, refs, defs, methods, names = scan(path)
        except Exception as e:
            print(f"{path}: FAILED {e}")
            continue
        external = sorted(refs - defs)
        buckets = collections.Counter(bucket(n) for n in external)
        per_file.append((path.split("/")[-1], manifest.get("name", "?"), len(defs), len(external), buckets))
        for n in external:
            totals[n] += 1
        for c, m in methods:
            if c and c.startswith("com.lagradost"):
                api_methods[f"{c}.{m}"] += 1

    print(f"{'plugin':<34} {'classes':<8} {'external':<9} buckets")
    for f, name, nd, ne, b in per_file:
        top = ", ".join(f"{k} {v}" for k, v in b.most_common(5))
        print(f"{name[:33]:<34} {nd:<8} {ne:<9} {top}")

    print()
    cs = sorted((n for n in totals if n.startswith("com.lagradost")), key=lambda n: -totals[n])
    print(f"cloudstream classes referenced across {len(per_file)} plugins: {len(cs)}")
    for n in cs[:45]:
        print(f"  {totals[n]:>3}x  {n}")
    print()
    print(f"distinct cloudstream methods called: {len(api_methods)}")
    for m, c in api_methods.most_common(30):
        print(f"  {c:>3}x  {m}")
