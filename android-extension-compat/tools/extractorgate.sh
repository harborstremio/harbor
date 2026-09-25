#!/bin/sh
# The extractor gate: every host the samples reach, resolved through the real registry.
# Run sh tools/build.sh first. Add --live for the network pass. Writes out/EXTRACTOR-GATE.md.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
  harbor.capstan.test.ExtractorGateKt "$(cygpath -w "$R")" "$@"
