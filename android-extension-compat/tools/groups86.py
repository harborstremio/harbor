"""Cuts the wider contract into six buildable shares and writes the report that ranks the work.

spec/required-86.json is the contract measured from all 99 archives. Everything in it that is not
already one of the 609 is new work, and out/missing-86.txt says which of those the compat layer
cannot resolve today. This script partitions the new members six ways and writes out/CONTRACT-86.md.

The partition unit is the outermost class's simple name, not the fully qualified name, because the
layer keeps one top level class per file named after that simple name. android.app.AlertDialog, its
Builder, and androidx.appcompat.app.AlertDialog$Builder therefore land in one share, so no two
agents are ever sent to the same file.
"""

import json
import os
import sys

GROUPS = 6
LF = "\n"


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def lines(path):
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf-8") as fh:
        return [l.rstrip(LF) for l in fh if l.strip()]


def owner(key):
    return key.split("|")[1]


def unit(cls):
    return cls.split(".")[-1].split("$")[0]


def package(cls):
    outer = cls.split("$")[0]
    return outer.rsplit(".", 1)[0] if "." in outer else "(default)"


def blockers(rec):
    return sum(1 for e in rec["exts"] if e.startswith("repo86/"))


def partition(units):
    """Six shares, greedily balanced.

    Two passes, because one pass keyed on missing members hands every already satisfied class to
    whichever share came out one short. The classes that need writing are balanced on missing
    members first, then the rest are balanced on their member count.
    """
    buckets = [{"missing": 0, "total": 0, "keys": [], "units": 0} for _ in range(GROUPS)]

    def take(b, u):
        b["missing"] += u["missing"]
        b["total"] += u["total"]
        b["units"] += 1
        b["keys"] += u["keys"]

    work = [u for u in units.values() if u["missing"]]
    rest = [u for u in units.values() if not u["missing"]]
    for u in sorted(work, key=lambda u: (-u["missing"], -u["total"], u["name"])):
        take(min(buckets, key=lambda x: (x["missing"], x["total"], x["units"])), u)
    for u in sorted(rest, key=lambda u: (-u["total"], u["name"])):
        take(min(buckets, key=lambda x: (x["total"], x["units"])), u)
    return buckets


def write_groups(root, buckets):
    d = os.path.join(root, "spec", "groups86")
    os.makedirs(d, exist_ok=True)
    for name in sorted(os.listdir(d)):
        if name.endswith(".txt"):
            os.remove(os.path.join(d, name))
    for i, b in enumerate(buckets, 1):
        with open(os.path.join(d, f"g{i}.txt"), "w", encoding="utf-8", newline=LF) as fh:
            fh.write(LF.join(sorted(b["keys"])) + LF)


def table(rows, head):
    out = ["| " + " | ".join(head) + " |", "|" + "|".join("---" for _ in head) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return out


def shape_line(raw):
    key, _, why = raw.partition("  ")
    return "- `" + key.strip() + "` " + why.strip()


def report(root, doc, keys609, missing, shape, buckets, units, share_of):
    req = doc["required"]
    missing_set = set(missing)
    new = [k for k in req if k not in keys609]
    new_missing = [k for k in new if k in missing_set]
    old_missing = [k for k in missing if k in keys609]
    exts86 = sorted({e for r in req.values() for e in r["exts"] if e.startswith("repo86/")})
    kinds = {}
    for k in new:
        kinds[k.split("|", 1)[0]] = kinds.get(k.split("|", 1)[0], 0) + 1

    L = ["# The contract measured from all 99 archives", ""]
    L += [f"{doc['extensions']} archives: the 13 fixtures plus the {len(exts86)} published by one"
          " public repository. Every member below is a class, method or field at least one of them"
          " references and does not define, read out of its Dalvik bytecode. The shape facts come"
          " from the same bytecode through the ASM scan, so a type extensions subclass is recorded"
          " as extended, and a final class in that position is counted unresolved because at"
          " runtime it is.", ""]
    L += table([
        ["total members", len(req)],
        ["already satisfied", len(req) - len(missing)],
        ["missing", len(missing)],
        ["of the missing, present but the wrong shape", len(shape)],
        ["already in the 609", len(keys609)],
        ["new beyond the 609", len(new)],
        ["new and already satisfied", len(new) - len(new_missing)],
        ["new and missing", len(new_missing)],
        ["of the 609, now unsatisfied", len(old_missing)],
    ], ["", "count"])
    L += ["", "New members by kind: " + ", ".join(f"{k} {v}" for k, v in sorted(kinds.items())), ""]

    L += ["## Present but the wrong shape", "",
          "These resolve by name and signature and still fail, because the bytecode reaches them a"
          " way the declaration does not allow.", ""]
    L += [shape_line(s) for s in shape] or ["None."]

    L += ["", "## Missing by package", "",
          "The count column is how many of the 86 reference that member, so it is how many"
          " extensions each one blocks. The share column names the file under spec/groups86 that"
          " owns it.", ""]
    by_pkg = {}
    for k in missing:
        by_pkg.setdefault(package(owner(k)), []).append(k)
    order = sorted(by_pkg, key=lambda p: (-max(blockers(req[k]) for k in by_pkg[p]),
                                          -sum(blockers(req[k]) for k in by_pkg[p]), p))
    L += table([[p, len(by_pkg[p]), max(blockers(req[k]) for k in by_pkg[p]),
                 sum(blockers(req[k]) for k in by_pkg[p])] for p in order],
               ["package", "missing", "worst blocks", "sum of blocks"])
    for pkg in order:
        ks = sorted(by_pkg[pkg], key=lambda k: (-blockers(req[k]), k))
        L += ["", f"### {pkg}  ({len(ks)} missing)", ""]
        L += table([[blockers(req[k]), share_of[k], "`" + k + "`"] for k in ks],
                   ["of 86", "share", "member"])

    L += ["", "## Top 20 missing, by how many of the 86 each blocks", ""]
    top = sorted(missing, key=lambda k: (-blockers(req[k]), k))[:20]
    L += table([[blockers(req[k]), share_of[k], "`" + k + "`"] for k in top],
               ["of 86", "share", "member"])

    L += ["", "## The six shares", "",
          "spec/groups86/g1.txt through g6.txt: disjoint, and together every new member. A share"
          " owns whole outermost class names, so two agents are never sent to the same file, and the"
          f" partition unit is {len(units)} such names. Balance is on missing members, which is the"
          " work. The members column counts the new ones already satisfied too, since those still"
          " have to be checked rather than written.", ""]
    L += table([[f"g{i}.txt", b["units"], b["total"], b["missing"]]
                for i, b in enumerate(buckets, 1)],
               ["share", "classes", "new members", "of those missing"])

    with open(os.path.join(root, "out", "CONTRACT-86.md"), "w", encoding="utf-8", newline=LF) as fh:
        fh.write(LF.join(L) + LF)
    return len(req), len(missing), len(new), len(new_missing), top


if __name__ == "__main__":
    root = sys.argv[1]
    doc = load(os.path.join(root, "spec", "required-86.json"))
    keys609 = set(load(os.path.join(root, "spec", "required.json"))["required"])
    missing = [k for k in lines(os.path.join(root, "out", "missing-86.txt")) if k in doc["required"]]
    shape = lines(os.path.join(root, "out", "shape-86.txt"))
    missing_set = set(missing)

    units = {}
    for key in doc["required"]:
        if key in keys609:
            continue
        name = unit(owner(key))
        u = units.setdefault(name, {"name": name, "keys": [], "missing": 0, "total": 0})
        u["keys"].append(key)
        u["total"] += 1
        if key in missing_set:
            u["missing"] += 1

    buckets = partition(units)
    write_groups(root, buckets)
    share_of = {k: f"g{i}" for i, b in enumerate(buckets, 1) for k in b["keys"]}
    total, nmissing, nnew, nnewmissing, top = report(
        root, doc, keys609, missing, shape, buckets, units, share_of)
    print(f"CONTRACT-86 {total} members, {total - nmissing} satisfied, {nmissing} missing")
    print(f"  new beyond the 609 {nnew}, of those missing {nnewmissing}")
    print("  shares " + " ".join(
        f"g{i}={b['total']}/{b['missing']}" for i, b in enumerate(buckets, 1)))
