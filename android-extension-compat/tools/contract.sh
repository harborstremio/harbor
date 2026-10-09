#!/bin/sh
# The scoreboard: how much of the measured contract the compat layer actually satisfies.
# No arguments scores spec/required.json, the 609 measured from the 13 fixtures.
# tools/contract86.sh scores the wider contract measured from all 99 archives.
R=$(cd "$(dirname "$0")/.." && pwd)
exec "$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-2g} -cp "$(cygpath -w "$R/tools/verifier");$(cygpath -w "$R/libs/gson-2.11.0.jar")" \
  harbor.Contract "$(cygpath -w "$R")" "$@"
