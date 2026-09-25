#!/bin/sh
# The live gate: real providers, real network. Run sh tools/build.sh first.
# Usage: sh tools/livegate.sh "<query>" [ExtensionName ...]   Writes out/LIVE-GATE.md.
# LIVE_HOST=stub attaches the host gate's host, so the layer's reverse challenge request is answered
# rather than going nowhere. Default is no host, which is the standalone case.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
  harbor.capstan.test.LiveGateKt "$(cygpath -w "$R")" "$@"
