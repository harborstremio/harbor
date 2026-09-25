package harbor.capstan.test

import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.Provider
import harbor.compat.host.HostLink
import harbor.compat.host.PlatformHost
import java.io.File

/** Drives loaded extensions over the real network: search, then load, then loadLinks.
 *
 * Nothing is simulated and nothing is replayed. Every request an extension makes and every url it
 * hands to the extractor registry is recorded, so a run that ends with no links still says which
 * host it wanted, what that host answered, and whether the registry had a class for it.
 *
 * Usage: LiveGate <root> <default query> [Extension | Extension=query | @Extension=mainUrl ...]
 *
 * An @ token adds a second pass over that extension with its mainUrl repointed, which is how a
 * provider hardcoding one instance of a federated service gets told apart from a broken layer.
 *
 * `LIVE_HOST=stub` attaches the same host the host gate uses, so a run can answer the layer's
 * reverse `challenge` request instead of leaving it unanswered. Without it no host is attached,
 * which is the standalone case and stays the default.
 */

private val TIMEOUT_MS: Long = (System.getenv("LIVE_TIMEOUT_MS") ?: "").toLongOrNull() ?: 120_000L

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val fallbackQuery = args.getOrNull(1) ?: "moon"
    val tokens = args.drop(2)
    // Every search result, unless a run asks for a shallower pass. A fixed depth makes the
    // verdict depend on how far down the relevance ordering the first playable title sits
    // that hour, which is a number that moves on its own between runs.
    val maxCandidates = (System.getenv("LIVE_CANDIDATES") ?: "").toIntOrNull() ?: Int.MAX_VALUE

    val overrides = tokens.filter { it.startsWith("@") }
        .associate { it.removePrefix("@").substringBefore('=') to it.substringAfter('=') }
    val asked = tokens.filterNot { it.startsWith("@") }
        .associate { it.substringBefore('=') to it.substringAfter('=', fallbackQuery) }

    val samples = File(root, "samples")
        .listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.filter { asked.isEmpty() || asked.containsKey(it.nameWithoutExtension) }
        ?.sortedBy { it.name }
        .orEmpty()
    if (samples.isEmpty()) {
        System.err.println("no samples selected under $root")
        kotlin.system.exitProcess(1)
    }

    PlatformHost.dataDir = File(root, "out/livegate-data")
    val config = LoaderConfig(cacheDir = File(root, "out/cache"), callTimeoutMs = TIMEOUT_MS)

    val host = if (System.getenv("LIVE_HOST") == "stub") GateHost() else null
    HostLink.channel = host
    HostLink.forget()
    println("host: ${if (host == null) "none attached" else "the stub host, answering challenge"}")

    val runs = ArrayList<LiveRun>()
    ExtensionLoader(config).use { loader ->
        for (file in samples) {
            val query = asked[file.nameWithoutExtension] ?: fallbackQuery
            val outcome = runCatching { loader.load(file) }
            val extension = outcome.getOrNull()
            if (extension == null) {
                runs.add(LiveRun(file.name, "", query, null, "load failed: ${line(outcome.exceptionOrNull()!!)}"))
            } else {
                extension.use {
                    for (provider in it.providers) {
                        runs.add(drive(file.name, provider, query, maxCandidates, null, host))
                        val repoint = overrides[file.nameWithoutExtension] ?: continue
                        runs.add(drive(file.name, provider, query, maxCandidates, repoint(provider, repoint), host))
                    }
                }
            }
        }
    }
    HostLink.channel = null

    val report = File(root, "out/" + (System.getenv("LIVE_REPORT") ?: "LIVE-GATE.md"))
    report.parentFile.mkdirs()
    report.writeText(LiveReport.render(runs, maxCandidates, command(args, maxCandidates)))
    val played = runs.count { it.played }
    println()
    println("LIVE GATE $played/${runs.size} passes produced at least one playable link")
    println("report ${report.path}")
}

private fun drive(
    file: String,
    provider: Provider,
    query: String,
    maxCandidates: Int,
    note: String?,
    host: GateHost?,
): LiveRun {
    println("=== $file / ${provider.name} / \"$query\"" + (note?.let { "  [$it]" } ?: ""))
    val run = LiveDrive.run(file, provider, query, maxCandidates, note, host)
    println(run.transcript())
    return run
}

/** The invocation, rebuilt from what the process was actually given, so the report never claims a
 * command that was not the one run. */
private fun command(args: Array<String>, maxCandidates: Int): String {
    val env = buildList {
        System.getenv("LIVE_TIMEOUT_MS")?.let { add("LIVE_TIMEOUT_MS=$it") }
        System.getenv("LIVE_CANDIDATES")?.let { add("LIVE_CANDIDATES=$it") }
        System.getenv("LIVE_REPORT")?.let { add("LIVE_REPORT=$it") }
        System.getenv("LIVE_HOST")?.let { add("LIVE_HOST=$it") }
    }.joinToString(" ")
    val quoted = args.drop(1).joinToString(" ") { if (it.contains(' ')) "\"$it\"" else it }
    val prefix = if (env.isEmpty()) "" else "$env "
    val depth = if (maxCandidates == Int.MAX_VALUE) "every search result"
    else "up to $maxCandidates candidates"
    return "${prefix}sh tools/livegate.sh $quoted".trim() +
        "\n# call timeout ${TIMEOUT_MS}ms, $depth chased per provider"
}

/** Points a provider at a named deployment of the same software before the pass runs.
 *
 * This pins one instance so a specific host can be measured. It is not the host's own fallback,
 * which walks the service registry on its own and is what a user gets, and every pass it touches
 * is labelled in the report so the two are never read as the same thing. */
private fun repoint(provider: Provider, mainUrl: String): String {
    val was = provider.mainUrl
    provider.mainUrl = mainUrl
    return "gate pinned mainUrl from $was to ${provider.mainUrl}"
}

internal fun line(failure: Throwable): String {
    var cause: Throwable = failure
    while (cause.cause != null && cause.cause !== cause) cause = cause.cause!!
    val message = (cause.message ?: "").lineSequence().firstOrNull()?.trim().orEmpty()
    return if (message.isEmpty()) cause::class.java.name else "${cause::class.java.simpleName}: ${message.take(200)}"
}
