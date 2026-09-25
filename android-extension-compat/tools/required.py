"""Every member of the compat surface that the sample extensions actually need.

Reads each .cs3's Dalvik bytecode and writes one line per (class, member, descriptor) the
extension references but does not define. That list is the contract: anything on it that the
compat layer cannot resolve is a crash the first time that code path runs, so the list doubles
as the scoreboard. It is measured from the bytecode, never guessed from documentation.

This half answers WHICH members are needed. Run tools/usage.sh afterwards to add HOW each one is
referenced, which is the other half of the contract and is what spec/groups/*.txt is cut from.
"""

import json
import os
import struct
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dexscan import Dex, descriptor_to_name  # noqa: E402

OURS = ("com.lagradost.", "android.", "androidx.")


def uleb(b, off):
    r, s = 0, 0
    while True:
        x = b[off]
        off += 1
        r |= (x & 0x7F) << s
        if not x & 0x80:
            return r, off
        s += 7


def proto(dx, i):
    shorty, ret, params_off = struct.unpack_from("<3I", dx.d, dx.proto_ids_off + i * 12)
    args = []
    if params_off:
        n = struct.unpack_from("<I", dx.d, params_off)[0]
        for k in range(n):
            t = struct.unpack_from("<H", dx.d, params_off + 4 + k * 2)[0]
            args.append(dx.type_name(t))
    return "(" + "".join(args) + ")" + dx.type_name(ret)


def members(path):
    z = zipfile.ZipFile(path)
    out = set()
    for entry in (n for n in z.namelist() if n.endswith(".dex")):
        dx = Dex(z.read(entry))
        defined = set(dx.defined())
        for i in range(dx.method_ids_size):
            c, p = struct.unpack_from("<HH", dx.d, dx.method_ids_off + i * 8)
            n = struct.unpack_from("<I", dx.d, dx.method_ids_off + i * 8 + 4)[0]
            owner = dx.type_name(c)
            if owner in defined:
                continue
            name = descriptor_to_name(owner)
            if name and name.startswith(OURS):
                out.add(("method", name, dx.string(n), proto(dx, p)))
        for i in range(dx.field_ids_size):
            c, t = struct.unpack_from("<HH", dx.d, dx.field_ids_off + i * 8)
            n = struct.unpack_from("<I", dx.d, dx.field_ids_off + i * 8 + 4)[0]
            owner = dx.type_name(c)
            if owner in defined:
                continue
            name = descriptor_to_name(owner)
            if name and name.startswith(OURS):
                out.add(("field", name, dx.string(n), dx.type_name(t)))
        for t in dx.types():
            name = descriptor_to_name(t)
            if name and name.startswith(OURS) and t not in defined:
                out.add(("class", name, "", ""))
    return out


if __name__ == "__main__":
    root = sys.argv[1]
    per, union = {}, {}
    for f in sorted(os.listdir(root)):
        if not f.endswith(".cs3"):
            continue
        ms = members(os.path.join(root, f))
        per[f] = sorted("|".join(m) for m in ms)
        for m in ms:
            union.setdefault("|".join(m), []).append(f)
    doc = {
        "extensions": len(per),
        "required": {k: {"exts": sorted(v)} for k, v in sorted(union.items())},
        "per_extension": per,
    }
    out = os.path.join(os.path.dirname(root), "spec", "required.json")
    with open(out, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, sort_keys=True)
    kinds = {}
    for k in union:
        kinds[k.split("|", 1)[0]] = kinds.get(k.split("|", 1)[0], 0) + 1
    print(f"extensions {len(per)}  required members {len(union)}  {kinds}")
