#!/bin/sh
# Asks the real bridge why an empty answer was empty, for services that are refusing right now.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
T="$R/out/outagegate"
rm -rf "$T"
mkdir -p "$T/data"
win(){ for j in "$@"; do cygpath -w "$j"; done | tr '\n' ';'; }
LIBS=$(win "$R"/libs/*.jar)
SET=${*:-"AniDb InvidiousProvider"}
ARGS=""
for name in $SET; do ARGS="$ARGS $(cygpath -w "$R/samples/$name.cs3")"; done
python "$R/test/bridge/outage.py" \
  "$JAVA_HOME/bin/java" \
  "$(cygpath -w "$R/out/capstan.jar");$LIBS" \
  "$(cygpath -w "$T/data")" \
  $ARGS
