#!/bin/sh
# Measures how the extensions reference each contract member, then folds that into the spec.
# Reads the converted jars, not the .cs3 files, because ASM sees the invoke opcodes directly.
#
# Default is the 13 fixtures against spec/required.json. Pass 86 for the wider corpus: that scans
# both jar sets, because the two publish eight archives under the same name at different versions
# and the shape facts of both versions are part of the contract.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
case "${1:-13}" in
  13) SPEC=spec/required.json;    JARS=samples/jars;                     OUT=out/usage.json;    GRP=spec/groups ;;
  86) SPEC=spec/required-86.json; JARS=samples/jars,samples/jars86;      OUT=out/usage-86.json; GRP=none ;;
  *) echo "usage: sh tools/usage.sh [13|86]"; exit 1 ;;
esac
CP="$(cygpath -w "$R/libs/gson-2.11.0.jar");$(cygpath -w "$R/tools/dex-tools/lib/asm-9.5.jar")"
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$(cygpath -w "$R/tools/usage")" \
  "$(cygpath -w "$R/tools/usage/harbor/Usage.java")"
"$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-2g} -cp "$(cygpath -w "$R/tools/usage");$CP" harbor.Usage "$(cygpath -w "$R")" \
  --spec "$SPEC" --jars "$JARS" --out "$OUT"
python "$R/tools/spec.py" "$R" --spec "$SPEC" --usage "$OUT" --groups "$GRP"
