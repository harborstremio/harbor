#!/bin/sh
# Measures how the extensions reference each contract member, then folds that into the spec.
# Reads the converted jars, not the .cs3 files, because ASM sees the invoke opcodes directly.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
CP="$(cygpath -w "$R/libs/gson-2.11.0.jar");$(cygpath -w "$R/tools/dex-tools/lib/asm-9.5.jar")"
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$(cygpath -w "$R/tools/usage")" \
  "$(cygpath -w "$R/tools/usage/harbor/Usage.java")"
"$JAVA_HOME/bin/java" -cp "$(cygpath -w "$R/tools/usage");$CP" harbor.Usage "$(cygpath -w "$R")"
python "$R/tools/spec.py" "$R"
