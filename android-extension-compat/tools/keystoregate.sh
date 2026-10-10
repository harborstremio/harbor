#!/bin/sh
# The keystore gate: generate in one JVM, find the key again in a second one.
# Two processes, because one process proves only that a field held its value.
# Run sh tools/build.sh first.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
[ -d "$R/out/test-classes" ] || { echo "run sh tools/build.sh first"; exit 1; }
CP="$(cygpath -w "$R/out/test-classes");$(cygpath -w "$R/out/capstan.jar")"
for j in "$R"/libs/*.jar; do CP="$CP;$(cygpath -w "$j")"; done
run() {
  "$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-2g} -Dfile.encoding=UTF-8 -Dstdout.encoding=UTF-8 -cp "$CP" \
    harbor.capstan.test.KeyStoreGateKt "$(cygpath -w "$R")" "$@"
}
FIRST="$R/out/keystore-gate-first.txt"
run first | tee "$FIRST"
KEY=$(sed -n 's/^LEAF_PUBLIC //p' "$FIRST")
ID=$(sed -n 's/^INSTALL_ID //p' "$FIRST")
[ -n "$KEY" ] || { echo "the first phase printed no public key"; exit 1; }
echo
run again "$KEY" "$ID"
