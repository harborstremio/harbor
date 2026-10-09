#!/bin/sh
# The wider scoreboard: the contract measured from all 99 archives, the 13 fixtures plus the 86.
# Reports land in out/missing-86.txt and out/shape-86.txt, so the standing 609 scoreboard and its
# reports are untouched. Writes out/CONTRACT-86.md and the six ownership groups under spec/groups86.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
sh "$R/tools/contract.sh" --spec spec/required-86.json --tag -86
python "$R/tools/groups86.py" "$R"
