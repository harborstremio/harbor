#!/bin/sh
# Kotlin compiler driver. Runs the embeddable compiler in-process so no Gradle daemon
# ever competes with the app build for this machine.
R=$(cd "$(dirname "$0")/.." && pwd)
. "$R/tools/portable.sh"
KC=$(cp_join "$R"/tools/*.jar)
CP=${KC_CLASSPATH:-$(cp_join "$R"/libs/*.jar)}
exec "${JBIN}java" -Xmx2g -cp "$KC" \
  org.jetbrains.kotlin.cli.jvm.K2JVMCompiler \
  -no-stdlib -nowarn -jvm-target 17 -classpath "$CP" "$@"
