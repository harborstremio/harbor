"""Re-derive Big Picture's ten-foot scale from the BUILT css.

A television lays out on 1080x607, and at that height most of Big Picture's
clamps resolve to their px floor rather than their vh term. The floor scale is
therefore the real ten-foot design. It is only coherent because the floors sit
at a fairly even multiple of the authored vh value, so this reports that
multiple and, more usefully, the elements that deviate from it. An element far
off the norm is the one that will read wrong next to its neighbours.

Run a vite build first, then: python tools/clamp-audit.py
"""

import collections
import glob
import io
import re
import statistics

H = 607.0
W = 1080.0

SIZE = {"height", "min-height", "max-height", "width", "min-width", "max-width"}
SPACE = ("padding", "margin", "gap", "row-gap", "column-gap", "inset", "top", "bottom", "left", "right")

decl = re.compile(r"([-a-z]+)\s*:\s*([^;{}]*clamp\([^)]*\)[^;{}]*)")
cl = re.compile(r"clamp\(\s*([0-9.]+)px\s*,\s*([0-9.]+)(vh|vw)\s*,\s*([0-9.]+)px\s*\)")


def load():
    text = ""
    for f in sorted(glob.glob("dist/assets/*.css")):
        text += io.open(f, encoding="utf-8", errors="replace").read()
    if not text:
        raise SystemExit("no built css in dist/assets. run a vite build first.")
    rows = []
    for prop, val in decl.findall(text):
        for floor, num, unit, cap in cl.findall(val):
            floor, num, cap = float(floor), float(num), float(cap)
            mid = num * (H if unit == "vh" else W) / 100.0
            used = min(max(mid, floor), cap)
            binds = "floor" if mid < floor else ("cap" if mid > cap else "vh")
            rows.append(
                {
                    "prop": prop,
                    "floor": floor,
                    "num": num,
                    "unit": unit,
                    "cap": cap,
                    "mid": mid,
                    "used": used,
                    "binds": binds,
                    "ratio": used / mid if mid else 0.0,
                }
            )
    return rows


def kind(prop):
    if prop == "font-size":
        return "font"
    if prop in SIZE:
        return "size"
    if prop.startswith(SPACE):
        return "space"
    return "other"


def main():
    rows = load()
    binds = collections.Counter(r["binds"] for r in rows)
    print(f"clamps: {len(rows)}   binding: {dict(binds)}")

    floored = [r for r in rows if r["binds"] == "floor"]
    norm = statistics.median(r["ratio"] for r in floored)
    print(f"floor-scale norm (median): {norm:.2f}x the authored vh value\n")

    for k in ("size", "space", "font"):
        sel = [r for r in floored if kind(r["prop"]) == k]
        if not sel:
            continue
        med = statistics.median(r["ratio"] for r in sel)
        print(f"--- {k}: {len(sel)} floored, median {med:.2f}x ---")
        seen, out = set(), []
        for r in sorted(sel, key=lambda r: abs(r["ratio"] - norm), reverse=True):
            key = (r["prop"], r["floor"], r["num"], r["unit"])
            if key in seen:
                continue
            seen.add(key)
            out.append(r)
            if len(out) >= 6:
                break
        for r in out:
            flag = "UNDER" if r["ratio"] < norm else "OVER "
            print(
                f"  {flag} {r['ratio']:4.2f}x  {r['prop']:<11}"
                f" clamp({r['floor']:g}px,{r['num']:g}{r['unit']},{r['cap']:g}px)"
                f" -> {r['used']:6.1f}px"
            )
        print()

    capped = [r for r in rows if r["binds"] == "cap"]
    if capped:
        print(f"--- cap binding at 607px ({len(capped)}), these cannot grow ---")
        seen = set()
        for r in capped:
            key = (r["prop"], r["cap"])
            if key in seen:
                continue
            seen.add(key)
            print(
                f"  {r['prop']:<11} clamp({r['floor']:g}px,{r['num']:g}{r['unit']},{r['cap']:g}px)"
                f" -> {r['used']:6.1f}px  (vh wanted {r['mid']:.0f}px)"
            )


main()
