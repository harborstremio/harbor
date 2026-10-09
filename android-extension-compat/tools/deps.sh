#!/bin/sh
# Fetches every jar this project needs but does not keep in version control.
#
# libs/ and tools/ hold about 100MB of third party binaries. Committing them would put a binary
# blob in every clone forever, so they are ignored and rebuilt here instead. Versions are pinned:
# a floating version would change what the compat layer compiles against without anything in the
# repository recording it. docs/THIRD-PARTY.md records the sources and licences.
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

digest() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  else
    shasum -a 256 "$1" | cut -d ' ' -f 1
  fi
}

verified() {
  get "$1" "$2" "$3"
  out="$2/$(basename "$1")"
  actual=$(digest "$out")
  if [ "$actual" != "$4" ]; then
    rm -f "$out"
    echo "FAILED checksum for $(basename "$1")"
    echo "  expected $4"
    echo "  actual   $actual"
    exit 1
  fi
}

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
verified NewPipeExtractor-v0.26.5.jar "$R/libs" \
  https://jitpack.io/com/github/TeamNewPipe/NewPipeExtractor/v0.26.5/NewPipeExtractor-v0.26.5.jar \
  923bf0a60938d570ad176ed7b08fa9fec7d0772d7a386ca89a2dd3b9212979c7
maven com/grack/nanojson/1.7/nanojson-1.7.jar "$R/libs"

echo "tools/ (the compiler, used to build, never shipped)"
maven org/jetbrains/kotlin/kotlin-compiler-embeddable/2.2.20/kotlin-compiler-embeddable-2.2.20.jar "$R/tools"
maven org/jetbrains/kotlin/kotlin-daemon-embeddable/2.2.20/kotlin-daemon-embeddable-2.2.20.jar "$R/tools"
maven org/jetbrains/kotlin/kotlin-script-runtime/2.2.20/kotlin-script-runtime-2.2.20.jar "$R/tools"
maven org/jetbrains/intellij/deps/trove4j/1.0.20200330/trove4j-1.0.20200330.jar "$R/tools"
maven org/jetbrains/annotations/24.1.0/annotations-24.1.0.jar "$R/tools"
for j in kotlin-stdlib-2.2.20 kotlin-reflect-2.2.20 kotlinx-coroutines-core-jvm-1.11.0; do
  [ -s "$R/tools/$j.jar" ] || cp "$R/libs/$j.jar" "$R/tools/$j.jar"
done

echo "dex-tools/ (Dalvik to JVM conversion, used at runtime)"
if [ -s "$R/tools/dex-tools/lib/dex-tools-v2.4.jar" ]; then
  echo "  have dex-tools-v2.4"
else
  archive="$R/tools/dex-tools-v2.4.zip"
  verified dex-tools-v2.4.zip "$R/tools" \
    https://github.com/pxb1988/dex2jar/releases/download/v2.4/dex-tools-v2.4.zip \
    ee7c45eb3c1d2474a6145d8d447e651a736a22d9664b6d3d3be5a5a817dda23a
  rm -rf "$R/tools/dex-tools" "$R/tools/dex-tools-v2.4"
  unzip -q "$archive" -d "$R/tools"
  mv "$R/tools/dex-tools-v2.4" "$R/tools/dex-tools"
  rm -f "$archive"
fi

echo
echo "deps ok"
echo "samples/*.cs3 are optional live-test fixtures and are not fetched by this build bootstrap."
