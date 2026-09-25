#!/bin/sh
# Kotlin compiler driver. Runs the embeddable compiler in-process so no Gradle daemon
# ever competes with the app build for this machine.
R=$(cd "$(dirname "$0")/.." && pwd)
win(){ for j in "$@"; do cygpath -w "$j"; done | tr '\n' ';'; }
KC=$(win "$R"/tools/*.jar)
CP=${KC_CLASSPATH:-$(win "$R"/libs/*.jar)}
exec "$JAVA_HOME/bin/java" -Xmx2g -cp "$KC" \
  org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-stdlib -nowarn -jvm-target 17 -classpath "$CP" "$@"
