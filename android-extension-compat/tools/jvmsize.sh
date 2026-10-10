#!/bin/sh
# How close every extension's largest method sits to the JVM's 65535 byte per method code limit.
# No arguments measures the 99: the 13 fixtures plus samples/repo86. Writes nothing; prints a table.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
D="$R/tools/dex-tools/lib"
[ -d "$D" ] || { echo "tools/dex-tools is missing, see tools/deps.sh"; exit 1; }
CP=$(for j in "$D"/*.jar; do cygpath -w "$j"; done | tr '\n' ';')
"$JAVA_HOME/bin/javac" -nowarn -cp "$CP" -d "$(cygpath -w "$R/tools/jvmsize")" \
  "$(cygpath -w "$R/tools/jvmsize/harbor/JvmSize.java")"
if [ $# -eq 0 ]; then
  for f in "$R"/samples/*.cs3 "$R"/samples/repo86/*.cs3; do set -- "$@" "$(cygpath -w "$f")"; done
fi
exec "$JAVA_HOME/bin/java" -Xmx${CAPSTAN_XMX:-4g} -cp "$(cygpath -w "$R/tools/jvmsize");$CP" harbor.JvmSize "$@"
