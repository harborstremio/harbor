#!/bin/sh
# Calls every method the converter could not represent and checks the refusal is honest.
# Run sh tools/build.sh first. STUB_SAMPLES points at another set of archives.
# Usage: sh tools/stubgate.sh [ExtensionName ...]   Writes out/STUB-GATE.md.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-2g} -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
  harbor.capstan.test.StubGateKt "$(cygpath -w "$R")" "$@"
