#!/bin/sh
# What a load handle may and may not be rewritten into. No network, no archives: every case is a
# shape one of the 86 archives depends on. Run sh tools/build.sh first.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
  harbor.capstan.test.UrlShapeGateKt
