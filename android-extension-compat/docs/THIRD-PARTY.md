# Capstan third-party dependencies

`tools/deps.sh` downloads the binary dependencies used to compile and stage the Capstan Android
extension compatibility layer. Dependency versions are fixed in that script; artifacts that do not
come from Maven Central are also checked against a repository-pinned SHA-256 digest.

The runtime bundled in a desktop installer contains `capstan.jar`, the jars under `libs/`, and the
required dex2jar jars under `tools/dex-tools/lib/`. Compiler jars under `tools/` are build-time only.

| Component | Upstream source | License | Use |
| --- | --- | --- | --- |
| Gson | <https://github.com/google/gson> | Apache-2.0 | Runtime |
| Jackson | <https://github.com/FasterXML/jackson> | Apache-2.0 | Runtime |
| jsoup | <https://github.com/jhy/jsoup> | MIT | Runtime |
| Kotlin standard library and reflection | <https://github.com/JetBrains/kotlin> | Apache-2.0 | Runtime and compiler |
| kotlinx.coroutines | <https://github.com/Kotlin/kotlinx.coroutines> | Apache-2.0 | Runtime and compiler |
| kotlinx.serialization | <https://github.com/Kotlin/kotlinx.serialization> | Apache-2.0 | Runtime |
| OkHttp and Okio | <https://github.com/square/okhttp> and <https://github.com/square/okio> | Apache-2.0 | Runtime |
| Rhino | <https://github.com/mozilla/rhino> | MPL-2.0 | Runtime |
| protobuf-javalite | <https://github.com/protocolbuffers/protobuf> | BSD-3-Clause | Runtime |
| NewPipeExtractor 0.26.5 | <https://github.com/TeamNewPipe/NewPipeExtractor/releases/tag/v0.26.5> via JitPack | GPL-3.0 | Runtime |
| nanojson 1.7 | <https://github.com/mmastrac/nanojson> via Maven Central | Apache-2.0 | Runtime |
| dex2jar 2.4 | <https://github.com/pxb1988/dex2jar/releases/tag/v2.4> | Apache-2.0 | Runtime conversion |
| Kotlin compiler and its compiler dependencies | <https://github.com/JetBrains/kotlin> | Apache-2.0 | Build only |

Each upstream distribution remains subject to its own license and notice files. Keep version or
source changes in this document synchronized with `tools/deps.sh`.
