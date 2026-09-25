package harbor.capstan.test

import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.StreamLink
import com.lagradost.cloudstream3.SubtitleFile
import com.lagradost.cloudstream3.utils.ExtractorApi
import com.lagradost.cloudstream3.utils.ExtractorLink
import com.lagradost.cloudstream3.utils.extractorApis
import com.lagradost.cloudstream3.utils.extractorsFor
import com.lagradost.cloudstream3.utils.hostOf
import com.lagradost.cloudstream3.utils.loadExtractor
import harbor.compat.host.HostLink
import harbor.compat.host.PlatformHost
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import java.io.File

/** Scores the extractor registry against the hosts the sample extensions actually reach.
 *
 * Three separate questions are asked, because answering only the first is how a layer reports
 * green while the user sees an empty stream list:
 *   layer    does the layer's own registry hold an extractor for this host
 *   live     does the layer alone, with no extension loaded, turn a real url of that host into a
 *            playable link
 *   winner   once every extension is loaded, whose extractor actually runs
 *
 * The live pass runs before any extension is loaded on purpose. An extension that ships its own
 * extractor for a host masks the layer's, so measuring after loading would score the extensions
 * rather than the layer, and the extensions that ship nothing are exactly the ones that depend on
 * the layer being right.
 *
 * Run without arguments for the registry passes only. Pass --live to add the network pass, and set
 * `LIVE_HOST=stub` to run that pass behind the host the host gate asserts against, so a probe that
 * failed is on record as having failed with a host present rather than without one.
 */

private class HostRow(
    val host: String,
    val extensions: List<String>,
    val evidence: String,
    val probe: String?,
)

/** One live attempt: what the extractor produced, and what those links actually served.
 *
 * [served] is the fact a user feels. A link is a claim until something fetches it, and an
 * extractor that emits a url the host then refuses is a silent failure, not a pass. */
private class Run(val links: Int, val fetched: Int, val served: Int, val note: String)

private class Outcome(
    val row: HostRow,
    val layerExtractor: String?,
    val live: Run?,
    var winner: String?,
    var winnerOwner: String,
    var shipped: Run? = null,
)

fun main(args: Array<String>) {
    val root = File(args.firstOrNull { !it.startsWith("--") } ?: ".").absoluteFile
    val live = args.any { it == "--live" }

    val rows = readHosts(File(root, "spec/hosts.txt"))
    if (rows.isEmpty()) {
        System.err.println("no host list at ${File(root, "spec/hosts.txt")}")
        kotlin.system.exitProcess(1)
    }

    PlatformHost.dataDir = File(root, "out/extractorgate-data")
    val host = if (System.getenv("LIVE_HOST") == "stub") GateHost() else null
    HostLink.channel = host
    val layerCount = extractorApis.size

    val outcomes = rows.map { scoreLayer(it, live) }

    val config = LoaderConfig(cacheDir = File(root, "out/cache"), callTimeoutMs = 120_000)
    val samples = File(root, "samples").listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.sortedBy { it.name }
        .orEmpty()
    val owners = HashMap<String, String>()

    ExtensionLoader(config).use { loader ->
        for (sample in samples) {
            val before = extractorApis.map { it.identity() }.toSet()
            val loaded = runCatching { loader.load(sample) }.getOrNull() ?: continue
            for (api in extractorApis) {
                val id = api.identity()
                if (id !in before) owners[id] = loaded.name
            }
        }
        // Counted before the live pass, because an extension can register more extractors the
        // first time one of its own is called and that would inflate the registry size.
        val extensionCount = extractorApis.size - layerCount
        for (outcome in outcomes) scoreWinner(outcome, owners, live)

        report(outcomes, live, layerCount, extensionCount)

        val report = File(root, "out/EXTRACTOR-GATE.md")
        report.parentFile.mkdirs()
        report.writeText(render(outcomes, live, layerCount, extensionCount) + hostSection(host))
        println()
        println("report ${report.path}")
    }
    HostLink.channel = null
}

/** Whether a host was there to clear a challenge for these probes, and what it managed. A run with
 * no host attached has not shown that a clearance would not have helped. */
private fun hostSection(host: GateHost?): String {
    val out = StringBuilder("\n## The host channel\n\n")
    if (host == null) {
        out.append("No host was attached, so the layer's reverse `challenge` request went unanswered\n")
        out.append("wherever it was made. Rerun with `LIVE_HOST=stub` to run these probes behind a host.\n")
        return out.toString()
    }
    val asks = host.asks
    if (asks.isEmpty()) {
        out.append("A host was attached and never asked: nothing any extractor fetched came back looking\n")
        out.append("like an interactive challenge, so no missing link here is a missing clearance.\n")
        return out.toString()
    }
    out.append("| asked for | cleared | what the host found |\n| --- | :-: | --- |\n")
    for (ask in asks) {
        out.append("| `${ask.url.take(90)}` | ${if (ask.cleared) "yes" else "no"} | ${ask.detail} |\n")
    }
    return out.toString()
}

private fun ExtractorApi.identity(): String = "${this::class.java.name}@${System.identityHashCode(this)}"

private fun named(url: String): ExtractorApi? =
    extractorsFor(url).firstOrNull { hostOf(it.mainUrl).isNotEmpty() }

private fun scoreLayer(row: HostRow, live: Boolean): Outcome {
    val best = named(row.probe ?: "https://${row.host}/")
    val run = if (live && row.probe != null) probe(row.probe) else null
    return Outcome(row, best?.name, run, null, "")
}

private fun scoreWinner(outcome: Outcome, owners: Map<String, String>, live: Boolean) {
    val best = named(outcome.row.probe ?: "https://${outcome.row.host}/")
    outcome.winner = best?.name
    outcome.winnerOwner = best?.let { owners[it.identity()] ?: "layer" } ?: "none"
    if (!live || outcome.row.probe == null) return
    outcome.shipped = probe(outcome.row.probe)
}

private fun probe(url: String): Run {
    val produced = ArrayList<ExtractorLink>()
    val note = try {
        runBlocking {
            withTimeout(PROBE_TIMEOUT_MS) {
                loadExtractor(url, null, { _: SubtitleFile -> }, { link: ExtractorLink -> produced.add(link) })
            }
        }
        if (produced.isNotEmpty()) "" else "no links"
    } catch (t: Throwable) {
        "${t::class.java.simpleName}: ${t.message?.take(60)}"
    }
    if (produced.isEmpty()) return Run(0, 0, 0, note)
    val probes = LinkProbes.probe(produced.map(::streamLink), PROBE_LINKS)
    val served = probes.count { it.served }
    val why = if (served > 0) "" else probes.firstOrNull()?.line()?.substringBefore("  ").orEmpty()
    return Run(produced.size, probes.size, served, why)
}

private fun streamLink(link: ExtractorLink) = StreamLink(
    source = link.source,
    name = link.name,
    url = link.url,
    referer = link.referer,
    quality = link.quality,
    type = link.type.name,
    headers = link.playbackHeaders(),
)

private fun report(outcomes: List<Outcome>, live: Boolean, layerCount: Int, extensionCount: Int) {
    println("registry holds ${layerCount + extensionCount} extractors: " +
        "$layerCount from the layer, $extensionCount from extensions")
    println()
    for (o in outcomes) {
        val layer = o.layerExtractor ?: "GENERIC ONLY"
        val winner = o.winner?.let { "$it (${o.winnerOwner})" } ?: "generic"
        val liveText = if (!live) "" else "  live: ${cell(o.live)} / ${cell(o.shipped)}"
        println("${o.row.host.padEnd(28)} ${o.row.extensions.size} ext  ${layer.padEnd(18)} -> ${winner.padEnd(26)}$liveText")
    }
    val covered = outcomes.count { it.layerExtractor != null }
    println()
    println("LAYER   $covered/${outcomes.size} hosts have an extractor in the layer itself")
    if (live) {
        val probed = outcomes.count { it.live != null }
        println("LIVE    layer alone ${outcomes.count { (it.live?.links ?: 0) > 0 }}/$probed, " +
            "as shipped ${outcomes.count { (it.shipped?.links ?: 0) > 0 }}/$probed probed hosts produced a link")
        println("SERVED  layer alone ${outcomes.count { (it.live?.served ?: 0) > 0 }}/$probed, " +
            "as shipped ${outcomes.count { (it.shipped?.served ?: 0) > 0 }}/$probed probed hosts served bytes")
    }
}

private fun cell(run: Run?): String = when {
    run == null -> "skipped"
    run.served > 0 -> "${run.links} links, ${run.served} of ${run.fetched} fetched served"
    run.links > 0 -> "${run.links} links, 0 of ${run.fetched} fetched served, ${run.note}"
    else -> "none, ${run.note}"
}

private fun render(outcomes: List<Outcome>, live: Boolean, layerCount: Int, extensionCount: Int): String {
    val out = StringBuilder()
    out.append("# Extractor gate\n\n")
    out.append("Every host the sample extensions hand to loadExtractor, resolved through the real\n")
    out.append("registry. A host with no named extractor falls to the generic page reader, which\n")
    out.append("finds a stream only when the host leaves one in the page.\n\n")
    out.append("The layer column is measured with no extension loaded. The winner column is who\n")
    out.append("runs once all thirteen are loaded, because an extension shipping its own extractor\n")
    out.append("for a host takes that host off the layer.\n\n")
    out.append("Registry: ${layerCount + extensionCount} extractors, ")
    out.append("$layerCount from the layer, $extensionCount from extensions.\n\n")
    out.append("| host | extensions | evidence | in the layer | winner | owner |")
    if (live) out.append(" live, layer alone | live, as shipped |")
    out.append("\n| --- | :-: | --- | --- | --- | --- |")
    if (live) out.append(" --- | --- |")
    out.append("\n")
    for (o in outcomes) {
        out.append("| `${o.row.host}` | ${o.row.extensions.size} | ${o.row.evidence} | ")
        out.append(o.layerExtractor ?: "_generic only_")
        out.append(" | ${o.winner ?: "_generic_"} | ${o.winnerOwner} |")
        if (live) out.append(" ${cell(o.live)} | ${cell(o.shipped)} |")
        out.append("\n")
    }
    val covered = outcomes.count { it.layerExtractor != null }
    out.append("\n$covered of ${outcomes.size} hosts have an extractor in the layer itself.\n")
    if (live) {
        val probed = outcomes.count { it.live != null }
        out.append("\nOf $probed hosts with a live probe url, ")
        out.append("${outcomes.count { (it.live?.links ?: 0) > 0 }} produced a link from the layer alone ")
        out.append("and ${outcomes.count { (it.shipped?.links ?: 0) > 0 }} with every extension loaded. ")
        out.append("${outcomes.count { (it.shipped?.served ?: 0) > 0 }} of those links served bytes when ")
        out.append("fetched with the headers the extractor attached.\n")
    }
    return out.toString()
}

private const val PROBE_TIMEOUT_MS = 60_000L

private const val PROBE_LINKS = 3

private fun readHosts(file: File): List<HostRow> {
    if (!file.isFile) return emptyList()
    return file.readLines().mapNotNull { line ->
        val text = line.trim()
        if (text.isEmpty() || text.startsWith("#")) return@mapNotNull null
        val parts = text.split('|')
        if (parts.size < 3) return@mapNotNull null
        HostRow(
            host = parts[0].trim(),
            extensions = parts[1].split(',').map { it.trim() }.filter { it.isNotEmpty() },
            evidence = parts[2].trim(),
            probe = parts.getOrNull(3)?.trim()?.takeIf { it.isNotEmpty() && it != "-" },
        )
    }
}
