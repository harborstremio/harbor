#!/bin/sh
# Drives the built bridge as a real subprocess against a real extension file.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
T="$R/out/bridgetest"
rm -rf "$T"
mkdir -p "$T/data"
win(){ for j in "$@"; do cygpath -w "$j"; done | tr '\n' ';'; }
LIBS=$(win "$R"/libs/*.jar)
printf 'this is not an extension\n' > "$T/broken.cs3"
python "$R/test/bridge/drive.py" \
  "$JAVA_HOME/bin/java" \
  "$(cygpath -w "$R/out/capstan.jar");$LIBS" \
  "$(cygpath -w "$T/data")" \
  "$(cygpath -w "$R/samples/DailymotionProvider.cs3")" \
  "$(cygpath -w "$T/broken.cs3")"
