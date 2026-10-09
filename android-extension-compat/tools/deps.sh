#!/bin/sh
# Fetches every jar this project needs but does not keep in version control.
#
# libs/ and tools/ hold about 100MB of third party binaries. Committing them would put a binary
# blob in every clone forever, so they are ignored and rebuilt here instead. Versions are pinned:
# a floating version would change what the compat layer compiles against without anything in the
# repository recording it. docs/THIRD-PARTY.md lists the licence of everything under libs/, which
# is the set that ships inside the installer.
#
# Run after a fresh clone, then tools/build.sh.
set -e
R=$(cd "$(dirname "$0")/.." && pwd)
M=https://repo1.maven.org/maven2
mkdir -p "$R/libs" "$R/tools"

get() {
  out="$2/$(basename "$1")"
  if [ -s "$out" ]; then echo "  have $(basename "$1")"; return; fi
  echo "  get  $(basename "$1")"
  curl -sSL --fail --max-time 180 -o "$out" "$3" || { rm -f "$out"; echo "FAILED $1"; exit 1; }
}

maven() { get "$1" "$2" "$M/$1"; }

echo "libs/ (compiled against, and shipped inside the installer)"
maven com/google/code/gson/gson/2.11.0/gson-2.11.0.jar "$R/libs"
maven com/fasterxml/jackson/core/jackson-annotations/2.17.2/jackson-annotations-2.17.2.jar "$R/libs"
maven com/fasterxml/jackson/core/jackson-core/2.17.2/jackson-core-2.17.2.jar "$R/libs"
maven com/fasterxml/jackson/core/jackson-databind/2.17.2/jackson-databind-2.17.2.jar "$R/libs"
maven com/fasterxml/jackson/module/jackson-module-kotlin/2.17.2/jackson-module-kotlin-2.17.2.jar "$R/libs"
maven org/jsoup/jsoup/1.18.1/jsoup-1.18.1.jar "$R/libs"
maven org/jetbrains/kotlin/kotlin-reflect/2.2.20/kotlin-reflect-2.2.20.jar "$R/libs"
maven org/jetbrains/kotlin/kotlin-stdlib/2.2.20/kotlin-stdlib-2.2.20.jar "$R/libs"
# Extensions are built against CloudStream, which builds against current kotlinx-coroutines. A layer
# that ships an older one loads them until the first coroutine call and then dies with
# NoSuchMethodError: BuildersKt.runBlockingK, which only exists from 1.11.0. The version tracks what
# the extensions are compiled against, not what is newest.
maven org/jetbrains/kotlinx/kotlinx-coroutines-core-jvm/1.11.0/kotlinx-coroutines-core-jvm-1.11.0.jar "$R/libs"
maven org/jetbrains/kotlinx/kotlinx-serialization-core-jvm/1.7.3/kotlinx-serialization-core-jvm-1.7.3.jar "$R/libs"
maven org/jetbrains/kotlinx/kotlinx-serialization-json-jvm/1.7.3/kotlinx-serialization-json-jvm-1.7.3.jar "$R/libs"
maven com/squareup/okhttp3/okhttp/4.12.0/okhttp-4.12.0.jar "$R/libs"
maven com/squareup/okio/okio-jvm/3.9.0/okio-jvm-3.9.0.jar "$R/libs"
maven org/mozilla/rhino/1.8.1/rhino-1.8.1.jar "$R/libs"
maven com/google/protobuf/protobuf-javalite/4.35.1/protobuf-javalite-4.35.1.jar "$R/libs"

echo "tools/ (the compiler, used to build, never shipped)"
maven org/jetbrains/kotlin/kotlin-compiler-embeddable/2.2.20/kotlin-compiler-embeddable-2.2.20.jar "$R/tools"
maven org/jetbrains/kotlin/kotlin-daemon-embeddable/2.2.20/kotlin-daemon-embeddable-2.2.20.jar "$R/tools"
maven org/jetbrains/kotlin/kotlin-script-runtime/2.2.20/kotlin-script-runtime-2.2.20.jar "$R/tools"
maven org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar "$R/tools"
maven org/jetbrains/annotations/24.1.0/annotations-24.1.0.jar "$R/tools"
for j in kotlin-stdlib-2.2.20 kotlin-reflect-2.2.20 kotlinx-coroutines-core-jvm-1.11.0; do
  [ -s "$R/tools/$j.jar" ] || cp "$R/libs/$j.jar" "$R/tools/$j.jar"
done

echo
echo "Two things this script cannot fetch from Maven Central, because they are not there:"
echo "  libs/NewPipeExtractor-v0.26.5.jar and libs/nanojson-*.jar  (needed by one extension)"
echo "  tools/dex-tools/                                           (Dalvik to JVM conversion)"
echo "  samples/*.cs3                                              (13 test fixtures)"
echo "docs/THIRD-PARTY.md records where each came from and under what licence."
echo
if [ -d "$R/tools/dex-tools/lib" ] && [ -s "$R/libs/NewPipeExtractor-v0.26.5.jar" ]; then
  echo "deps ok"
else
  echo "deps incomplete: see the note above. tools/build.sh works without them;"
  echo "loading a real archive does not."
fi
