"""The hosts a live gate run actually handed to the extractor registry.

Reads a live gate log and folds its `resolve <host> -> registry [...] tried [...] produced N` lines
into one row per host: which extensions reached it, how many attempts, whether any registry entry
claimed it, and whether anything was ever produced.

This is the truthful source for coverage work. Many extensions assemble their embed hosts at
runtime, so the host never appears as a string constant anywhere in their bytecode.

Usage: python tools/resolvescan.py out/w2/live86.log
"""

import collections
import re
import sys

RUN = re.compile(r"^=== (\S+) / (.*?) / ")
RESOLVE = re.compile(
    r"^\s*resolve (\S+) -> registry \[(.*?)\] tried \[(.*?)\] produced (\d+)\s*$"
)
ANY_URL = re.compile(r"https?://([A-Za-z0-9.-]+)(/[^\s\"'<>,)\]]*)?")


class Row:
    def __init__(self, host):
        self.host = host
        self.archives = set()
        self.attempts = 0
        self.produced = 0
        self.claimants = set()
        self.unclaimed = 0
        self.samples = []

    def rank_key(self):
        return (-len(self.archives), -self.attempts, self.host)


def read(path):
    rows = {}
    seen = collections.defaultdict(list)
    archive = "?"
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            for host, tail in ANY_URL.findall(raw):
                key = host.lower().removeprefix("www.")
                if tail and len(tail) > 1 and len(seen[key]) < 4:
                    seen[key].append("https://" + host + tail)
            run = RUN.match(raw)
            if run:
                archive = run.group(1)
                continue
            hit = RESOLVE.match(raw)
            if not hit:
                continue
            host, registry, _tried, produced = hit.groups()
            row = rows.setdefault(host, Row(host))
            row.archives.add(archive)
            row.attempts += 1
            row.produced += int(produced)
            if registry == "NONE":
                row.unclaimed += 1
            else:
                row.claimants.update(p.strip() for p in registry.split(",") if p.strip())
    for host, row in rows.items():
        row.samples = seen.get(host, [])
    return rows


if __name__ == "__main__":
    rows = read(sys.argv[1])
    ranked = sorted(rows.values(), key=Row.rank_key)
    print(f"# {len(ranked)} hosts handed to the registry")
    print("rank\tarchives\tattempts\tproduced\tclaimed\thost\tby\tsample")
    for i, row in enumerate(ranked, 1):
        claimed = ",".join(sorted(row.claimants)) if row.claimants else "NONE"
        sample = row.samples[0] if row.samples else "-"
        print(
            f"{i}\t{len(row.archives)}\t{row.attempts}\t{row.produced}\t{claimed}"
            f"\t{row.host}\t{','.join(sorted(row.archives))}\t{sample}"
        )
