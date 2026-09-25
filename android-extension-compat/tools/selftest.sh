#!/bin/sh
# Proves the scoreboard is honest: runs it against a synthetic contract whose answers are known.
# A scoreboard that only ever counts up is worth nothing, so every rule gets a case it must fail.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
T="$R/out/selftest"
rm -rf "$T"
mkdir -p "$T/spec" "$T/out" "$T/libs" "$T/classes"
cp "$R/test/shape/spec.json" "$T/spec/required.json"
"$JAVA_HOME/bin/javac" -nowarn -d "$(cygpath -w "$T/classes")" "$(cygpath -w "$R/test/shape/Probe.java")"
(cd "$T/classes" && "$JAVA_HOME/bin/jar" cf "$(cygpath -w "$T/out/probe.jar")" .)
"$JAVA_HOME/bin/java" -cp "$(cygpath -w "$R/tools/verifier");$(cygpath -w "$R/libs/gson-2.11.0.jar")" \
  harbor.Contract "$(cygpath -w "$T")"
echo "--- reasons ---"
tr -d '\r' < "$T/out/shape.txt"
echo "--- checks ---"
# The verifier writes with the platform line separator, so compare text, not bytes.
tr -d '\r' < "$T/out/missing.txt" > "$T/out/missing.lf"
tr -d '\r' < "$T/out/shape.txt" | cut -d' ' -f1 > "$T/out/shape.keys"
fail=0
if diff "$R/test/shape/expected-missing.txt" "$T/out/missing.lf"; then
  echo "missing.txt as expected"
else
  echo "SELFTEST FAILED: missing.txt"; fail=1
fi
if diff "$R/test/shape/expected-shape.txt" "$T/out/shape.keys"; then
  echo "shape.txt as expected"
else
  echo "SELFTEST FAILED: shape.txt"; fail=1
fi
[ "$fail" = 0 ] || exit 1
echo "SELFTEST ok"
