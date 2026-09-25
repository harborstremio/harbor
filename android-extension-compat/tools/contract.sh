#!/bin/sh
# The scoreboard: how much of the measured contract the compat layer actually satisfies.
R=$(cd "$(dirname "$0")/.." && pwd)
exec "$JAVA_HOME/bin/java" -cp "$(cygpath -w "$R/tools/verifier");$(cygpath -w "$R/libs/gson-2.11.0.jar")" \
  harbor.Contract "$(cygpath -w "$R")"
