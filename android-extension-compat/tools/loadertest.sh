#!/bin/sh
# Loads every sample extension through the real loader. Run sh tools/build.sh first.
# A search term as the first argument adds an opt in probe that puts real requests on the wire.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" harbor.capstan.test.LoaderTestKt "$(cygpath -w "$R")" "$@"
