package harbor.capstan.test

import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoadedExtension
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.Provider
import harbor.compat.host.PlatformHost
import java.io.File

/** Loads every sample extension and says, per file, whether it came up and what it registered.
 *
 * The second pass exists to show the converted jar is reused: it repeats the same work against a
 * warm cache, so the two timings are the cost with and without conversion. */
fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val samples = File(root, "samples").listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.sortedBy { it.name }
        .orEmpty()
    if (samples.isEmpty()) {
        System.err.println("no samples under $root")
        return
    }

    PlatformHost.dataDir = File(root, "out/loadertest-data")
    val config = LoaderConfig(cacheDir = File(root, "out/cache"))

    val cold = ExtensionLoader(config).use { loader -> pass(loader, samples, "cold") }
    val warm = ExtensionLoader(config).use { loader -> pass(loader, samples, "warm") }

    val query = args.getOrNull(1)
    if (query != null) ExtensionLoader(config).use { loader -> probe(loader, samples, query) }

    println()
    println("LOADER ${cold.loaded}/${samples.size} loaded, ${cold.providers} providers, ${cold.extractors} extractors")
    println("TIMING cold ${cold.millis} ms, warm ${warm.millis} ms")
    println("BARRIER checked at every load: the host is unreachable and the compat layer is one copy")
    if (cold.loaded != samples.size) {
        System.err.println("LOADER FAILED: ${samples.size - cold.loaded} extension(s) did not load")
        kotlin.system.exitProcess(1)
    }
}

private class PassResult(val loaded: Int, val providers: Int, val extractors: Int, val millis: Long)

private fun pass(loader: ExtensionLoader, samples: List<File>, label: String): PassResult {
    println("--- $label pass")
    var loaded = 0
    var providers = 0
    var extractors = 0
    val started = System.nanoTime()
    for (file in samples) {
        val each = System.nanoTime()
        val outcome = runCatching { loader.load(file) }
        val took = (System.nanoTime() - each) / 1_000_000
        outcome.onSuccess { extension ->
            loaded++
            providers += extension.providers.size
            extractors += extension.extractorNames.size
            println(report(file, extension, took))
            extension.close()
        }.onFailure { failure ->
            println("FAIL ${file.name.padEnd(30)} ${took}ms  ${reason(failure)}")
        }
    }
    return PassResult(loaded, providers, extractors, (System.nanoTime() - started) / 1_000_000)
}

/** Optional and off by default, because it puts a real request on the wire. It is the only way to
 * see the suspend boundary actually cross into an extension and come back with data. */
private fun probe(loader: ExtensionLoader, samples: List<File>, query: String) {
    println()
    println("--- search probe \"$query\"")
    for (file in samples) {
        val extension = runCatching { loader.load(file) }.getOrNull() ?: continue
        extension.use {
            for (provider in it.providers) println("     ${provider.name.padEnd(22)} ${chain(provider, query)}")
        }
    }
}

/** Search, then load the first hit, then ask for its links. The three calls the host API exposes,
 * run against the live site in the order a viewer would trigger them. */
private fun chain(provider: Provider, query: String): String {
    val started = System.nanoTime()
    val results = runCatching { provider.search(query) }
        .getOrElse { return "search error ${reason(it)}" }
    if (results.isEmpty()) return "0 results  (${elapsed(started)})"

    val first = results.first()
    val detail = runCatching { provider.load(first.url) }
        .getOrElse { return "${results.size} results, load error ${reason(it)}" }
        ?: return "${results.size} results, load returned nothing"

    val data = detail.playableData ?: detail.episodes.firstOrNull()?.data
        ?: return "${results.size} results, loaded \"${detail.name}\" with nothing playable"

    val links = runCatching { provider.loadLinks(data) }
        .getOrElse { return "${results.size} results, loaded \"${detail.name}\", links error ${reason(it)}" }

    val shape = if (detail.episodes.isEmpty()) "single" else "${detail.episodes.size} episodes"
    return "${results.size} results, \"${detail.name}\" $shape, " +
        "${links.links.size} links ${links.subtitles.size} subtitles  (${elapsed(started)})"
}

private fun elapsed(startedNanos: Long): String = "${(System.nanoTime() - startedNanos) / 1_000_000}ms"

private fun report(file: File, extension: LoadedExtension, took: Long): String {
    val names = extension.providerNames.ifEmpty { listOf("(none)") }.joinToString(", ")
    val extra = if (extension.extractorNames.isEmpty()) "" else " +${extension.extractorNames.size} extractors"
    return "OK   ${file.name.padEnd(30)} ${took.toString().padStart(5)}ms  v${extension.version}  $names$extra"
}

private fun reason(failure: Throwable): String {
    val message = failure.message ?: failure::class.java.name
    return message.lineSequence().first().take(220)
}
