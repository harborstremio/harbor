#!/bin/sh
# The catalogue gate: every provider's browse rows, listed and then fetched over the real network.
# Run sh tools/build.sh first. Writes out/CATALOGUE-GATE.md.
# Usage: sh tools/cataloguegate.sh [ExtensionName ...]
# CATALOGUE_SAMPLES points it at another set of archives, CATALOGUE_ROWS at how many rows per
# provider get tried, CATALOGUE_TIMEOUT_MS at the per call ceiling.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
exec "$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-2g} -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
  harbor.capstan.test.CatalogueGateKt "$(cygpath -w "$R")" "$@"
