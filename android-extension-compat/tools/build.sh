#!/bin/sh
# One compile pass over the whole compat layer. The platform stubs and the extension API are
# mutually referential, so they are one compilation unit, not a chain of them.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
. "$R/tools/portable.sh"
rm -rf "$R/out/classes" "$R/out/capstan.jar"
mkdir -p "$R/out/classes"
find "$R/src" -name '*.kt' -print -quit | grep -q . || { echo "no sources"; exit 1; }
# The Kotlin CLI accepts a source directory and walks it recursively. Passing the 300+ source
# paths individually exceeds Windows' CreateProcess command-line limit before Java can start.
# Quoting the single directory also keeps checkouts whose paths contain spaces working.
sh "$R/tools/kc.sh" "$R/src" -d "$R/out/classes"
JAVA=$(find "$R/src" -name '*.java' | sort)
if [ -n "$JAVA" ]; then
  set --
  while IFS= read -r f; do
    if [ -n "$f" ]; then set -- "$@" "$f"; fi
  done <<JAVA_EOF
$JAVA
JAVA_EOF
  CP=$(cp_join "$R"/libs/*.jar)
  "${JBIN}javac" -nowarn -cp "$(hostpath "$R/out/classes")$CPSEP$CP" -d "$R/out/classes" "$@"
fi
# Service declarations travel with the classes they name, so they are merged in before the jar is
# sealed rather than being a separate artifact the host would have to remember to ship.
if [ -d "$R/src/resources" ]; then cp -r "$R/src/resources/." "$R/out/classes/"; fi
(cd "$R/out/classes" && "${JBIN}jar" cf "$(hostpath "$R/out/capstan.jar")" .)
# The top level tests compile against the finished jar, not alongside it, because they are a
# consumer of the layer and must not be able to reach anything the jar does not publish.
TEST=$(ls "$R"/test/*.kt 2>/dev/null | sort)
if [ -n "$TEST" ]; then
  rm -rf "$R/out/test-classes"
  mkdir -p "$R/out/test-classes"
  set --
  while IFS= read -r f; do
    if [ -n "$f" ]; then set -- "$@" "$f"; fi
  done <<TEST_EOF
$TEST
TEST_EOF
  KC_CLASSPATH="$(hostpath "$R/out/capstan.jar")$CPSEP$(cp_join "$R"/libs/*.jar)" \
    sh "$R/tools/kc.sh" "$@" -d "$R/out/test-classes"
fi
echo "BUILD ok  $(find "$R/out/classes" -name '*.class' | wc -l) classes"
