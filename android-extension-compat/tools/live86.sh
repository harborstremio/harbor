#!/bin/sh
# The whole repository through the live gate, in parallel shards.
#
# One process over 86 archives does not finish in a sitting, so the archives are dealt across N
# shards that run at once. Each shard gets its own root, because the gate writes its cache, its
# data directory and its report under the root it is given and two shards sharing one would
# overwrite each other. The reports are concatenated at the end; the verdict lines are what the
# count is taken from, so a shard that dies is visible as a missing row rather than a silent zero.
#
# Usage: sh tools/live86.sh [shards] [query]
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
N=${1:-5}
Q=${2:-fight club}
SRC="$R/samples/repo86"
OUT="$R/out/live86"

[ -d "$SRC" ] || { echo "no $SRC"; exit 1; }
rm -rf "$OUT"
mkdir -p "$OUT"

# Deal the archives round robin so a slow neighbourhood does not land in one shard.
i=0
for f in "$SRC"/*.cs3; do
  s=$((i % N + 1))
  mkdir -p "$OUT/s$s/samples"
  cp "$f" "$OUT/s$s/samples/"
  i=$((i + 1))
done
echo "dealt $i archives across $N shards"

pids=""
s=1
while [ "$s" -le "$N" ]; do
  (
    cd "$R"
    LIVE_SAMPLES="$OUT/s$s/samples" \
    LIVE_REPORT="live86/s$s.md" \
    LIVE_CANDIDATES="${LIVE_CANDIDATES:-2}" \
    LIVE_TIMEOUT_MS="${LIVE_TIMEOUT_MS:-45000}" \
    CAPSTAN_XMX="${CAPSTAN_XMX:-2g}" \
    sh tools/livegate.sh "$Q" > "$OUT/s$s.log" 2>&1
    echo "$?" > "$OUT/s$s.rc"
  ) &
  pids="$pids $!"
  s=$((s + 1))
done
echo "running $N shards, pids$pids"
for p in $pids; do wait "$p" || true; done

echo
echo "=== per shard ==="
s=1
while [ "$s" -le "$N" ]; do
  line=$(grep -h 'LIVE GATE' "$OUT/s$s.log" 2>/dev/null | tail -1)
  printf 's%-2s rc=%-3s %s\n' "$s" "$(cat "$OUT/s$s.rc" 2>/dev/null || echo '?')" "${line:-NO RESULT LINE}"
  s=$((s + 1))
done

# The verdict table rows are the only per archive record, so the totals come from them.
cat "$R"/out/live86/s*.md > "$OUT/ALL.md" 2>/dev/null || true
rows=$(grep -c '^| `' "$OUT/ALL.md" 2>/dev/null || echo 0)
live=$(grep '^| `' "$OUT/ALL.md" 2>/dev/null | grep -c 'live, ' || echo 0)
echo
echo "LIVE 86: $live of $rows provider passes produced at least one link"
echo "reports $OUT/ALL.md"
