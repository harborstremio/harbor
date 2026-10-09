#!/bin/sh
# Compiles the scoreboard in place, next to its source, which is where contract.sh looks for it.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
"$JAVA_HOME/bin/javac" -nowarn -cp "$(cygpath -w "$R/libs/gson-2.11.0.jar")" \
  -d "$(cygpath -w "$R/tools/verifier")" "$(cygpath -w "$R/tools/verifier/harbor/Contract.java")"
echo "VERIFIER ok"
