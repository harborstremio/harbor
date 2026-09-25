"""Merges the measured usage facts into the contract and repartitions it into ownership groups.

required.py measures WHICH members the extensions need. out/usage.json, produced by the ASM scan
in tools/usage, measures HOW each one is referenced. Both halves are facts read out of shipped
bytecode. This script joins them and rewrites spec/groups/*.txt so the groups stay a disjoint,
complete cover of the contract.
"""

import json
import os
import sys

CORE_API = {"APIHolder", "CommonActivity", "MainAPI", "MainAPIKt", "MainActivityKt"}
CS = "com.lagradost.cloudstream3."


def group(cls):
    """Ownership group for a class. Disjoint and total: every class lands in exactly one."""
    if cls.startswith("androidx."):
        return "androidx"
    if cls.startswith("android."):
        if cls.startswith("android.webkit."):
            return "and-webkit"
        if cls.startswith("android.graphics.") or cls.startswith("android.text."):
            return "and-graphics"
        if cls.startswith("android.view.") or cls.startswith("android.widget."):
            return "and-widget"
        return "and-platform"
    if cls.startswith(CS + "plugins.") or cls.startswith(CS + "syncproviders."):
        return "cs-plugins"
    if cls.startswith(CS + "utils.") or cls.startswith(CS + "extractors."):
        return "cs-utils"
    if cls.startswith(CS):
        rest = cls[len(CS):]
        if "." in rest:
            return "cs-http"
        return "core-api" if rest in CORE_API else "core-model"
    return "cs-http"


def exts_of(value):
    return value if isinstance(value, list) else value["exts"]


def enrich(doc, usage):
    inv, acc, types = usage["invoke"], usage["access"], usage["types"]
    out = {}
    for key, value in doc["required"].items():
        rec = {"exts": sorted(exts_of(value))}
        kinds = set(inv.get(key, []))
        if kinds:
            if "itf" in kinds:
                rec["itf"] = True
                kinds.discard("itf")
            rec["invoke"] = sorted(kinds)
        if key in acc:
            rec["access"] = sorted(acc[key])
        for fact in sorted(types.get(key, [])):
            rec[fact] = True
        out[key] = rec
    doc["required"] = out
    doc["usage_conflicts"] = usage["conflicts"]
    return doc


def write_groups(root, keys):
    d = os.path.join(root, "spec", "groups")
    buckets = {}
    for key in keys:
        buckets.setdefault(group(key.split("|")[1]), []).append(key)
    for name in sorted(os.listdir(d)):
        if name.endswith(".txt") and name[:-4] not in buckets:
            raise SystemExit("group file with no members: " + name)
    for name, members in sorted(buckets.items()):
        path = os.path.join(d, name + ".txt")
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write("\n".join(sorted(members)) + "\n")
    return {k: len(v) for k, v in sorted(buckets.items())}


if __name__ == "__main__":
    root = sys.argv[1]
    spec = os.path.join(root, "spec", "required.json")
    with open(spec, encoding="utf-8") as fh:
        doc = json.load(fh)
    with open(os.path.join(root, "out", "usage.json"), encoding="utf-8") as fh:
        usage = json.load(fh)
    doc = enrich(doc, usage)
    with open(spec, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(doc, fh, indent=1, sort_keys=True)
    sizes = write_groups(root, doc["required"])
    shaped = sum(1 for r in doc["required"].values() if len(r) > 1)
    print(f"SPEC {len(doc['required'])} members, {shaped} carry usage facts, "
          f"{len(doc['usage_conflicts'])} conflicts")
    print("  groups " + " ".join(f"{k}={v}" for k, v in sizes.items()))
