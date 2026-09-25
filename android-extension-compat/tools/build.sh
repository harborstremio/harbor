#!/bin/sh
# One compile pass over the whole compat layer. The platform stubs and the extension API are
# mutually referential, so they are one compilation unit, not a chain of them.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
rm -rf "$R/out/classes" "$R/out/capstan.jar"
mkdir -p "$R/out/classes"
SRC=$(find "$R/src" -name '*.kt' | sort)
[ -n "$SRC" ] || { echo "no sources"; exit 1; }
sh "$R/tools/kc.sh" $SRC -d "$R/out/classes"
JAVA=$(find "$R/src" -name '*.java' | sort)
if [ -n "$JAVA" ]; then
  CP=$(for j in "$R"/libs/*.jar; do cygpath -w "$j"; done | tr '\n' ';')
  "$JAVA_HOME/bin/javac" -nowarn -cp "$(cygpath -w "$R/out/classes");$CP" -d "$R/out/classes" $JAVA
fi
# Service declarations travel with the classes they name, so they are merged in before the jar is
# sealed rather than being a separate artifact the host would have to remember to ship.
if [ -d "$R/src/resources" ]; then cp -r "$R/src/resources/." "$R/out/classes/"; fi
(cd "$R/out/classes" && "$JAVA_HOME/bin/jar" cf "$(cygpath -w "$R/out/capstan.jar")" .)
# The top level tests compile against the finished jar, not alongside it, because they are a
# consumer of the layer and must not be able to reach anything the jar does not publish.
TEST=$(ls "$R"/test/*.kt 2>/dev/null | sort)
if [ -n "$TEST" ]; then
  rm -rf "$R/out/test-classes"
  mkdir -p "$R/out/test-classes"
  KC_CLASSPATH="$(cygpath -w "$R/out/capstan.jar");$(for j in "$R"/libs/*.jar; do cygpath -w "$j"; done | tr '\n' ';')" \
    sh "$R/tools/kc.sh" $TEST -d "$R/out/test-classes"
fi
echo "BUILD ok  $(find "$R/out/classes" -name '*.class' | wc -l) classes"
