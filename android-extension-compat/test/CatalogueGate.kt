package harbor.capstan.test

import com.harbor.capstan.CallTrace
import com.harbor.capstan.CatalogueRow
import com.harbor.capstan.ExtensionLoader
import com.harbor.capstan.HttpCall
import com.harbor.capstan.LoaderConfig
import com.harbor.capstan.Provider
import harbor.compat.host.PlatformHost
import java.io.File

private val TIMEOUT_MS: Long = (System.getenv("CATALOGUE_TIMEOUT_MS") ?: "").toLongOrNull() ?: 45_000L

private val ROW_LIMIT: Int = (System.getenv("CATALOGUE_ROWS") ?: "").toIntOrNull() ?: 2

private val ONLY_CATALOGUE = listOf("DoraBash", "PublicSportsIPTV")

class RowAttempt(
    val row: CatalogueRow,
    val page: Int,
    val sections: List<Pair<String, List<String>>>,
    val hasNext: Boolean,
    val millis: Long,
    val error: String?,
    val note: String?,
    val http: List<HttpCall>,
    val logs: List<String>,
) {
    val items: Int get() = sections.sumOf { it.second.size }

    val real: Int get() = sections.sumOf { section -> section.second.count { it.isNotBlank() } }
}

class CatalogueRun(
    val file: String,
    val providerName: String,
    val hasMainPageFlag: Boolean,
    val rows: List<CatalogueRow>,
    val attempts: List<RowAttempt>,
    val abort: String?,
) {
    val exposes: Boolean get() = rows.isNotEmpty()

    val declaredRows: Int get() = rows.count { it.declared }

    val real: Int get() = attempts.sumOf { it.real }

    val served: Boolean get() = real > 0

    val verdict: String
        get() {
            val attempt = attempts.firstOrNull { it.real > 0 }
            val refused = attempts.flatMap { it.http }.firstOrNull { !it.ok }
            return when {
                abort != null -> "blocked: $abort"
                rows.isEmpty() && hasMainPageFlag ->
                    "no rows, and the provider claims hasMainPage"
                rows.isEmpty() -> "no rows, and the provider does not override the call"
                attempt != null ->
                    "${attempt.real} titles in row \"${attempt.row.name}\"" +
                        if (attempt.row.declared) "" else " (the row stood up for it)"
                attempts.isEmpty() -> "rows listed, none fetched"
                attempts.all { it.error != null } ->
                    "every row tried threw: ${attempts.first().error}"
                attempts.any { it.note != null } ->
                    "rows answered nothing, ${attempts.first { it.note != null }.note}"
                refused != null ->
                    "rows answered nothing, a request answered ${refused.error ?: refused.status}"
                attempts.any { it.items > 0 } -> "rows answered items with no titles on them"
                else -> "rows answered nothing, every request they made succeeded"
            }
        }
}

fun main(args: Array<String>) {
    val root = File(args.getOrNull(0) ?: ".").absoluteFile
    val asked = args.drop(1).toSet()
    val from = System.getenv("CATALOGUE_SAMPLES")?.takeIf { it.isNotBlank() }?.let(::File)
        ?: File(root, "samples")
    val samples = from
        .listFiles { f: File -> f.isFile && f.name.endsWith(".cs3") }
        ?.filter { asked.isEmpty() || asked.contains(it.nameWithoutExtension) }
        ?.sortedBy { it.name }
        .orEmpty()
    if (samples.isEmpty()) {
        System.err.println("no samples selected under $from")
        kotlin.system.exitProcess(1)
    }

    PlatformHost.dataDir = File(root, "out/cataloguegate-data")
    val config = LoaderConfig(cacheDir = File(root, "out/cache"), callTimeoutMs = TIMEOUT_MS)

    val runs = ArrayList<CatalogueRun>()
    ExtensionLoader(config).use { loader ->
        for (file in samples) {
            val outcome = runCatching { loader.load(file) }
            val extension = outcome.getOrNull()
            if (extension == null) {
                runs.add(
                    CatalogueRun(
                        file.name, "", false, emptyList(), emptyList(),
                        "load failed: ${line(outcome.exceptionOrNull()!!)}",
                    ),
                )
                println("=== ${file.name}: load failed")
                continue
            }
            extension.use { loaded -> for (provider in loaded.providers) runs.add(drive(file.name, provider)) }
        }
    }

    val report = File(root, "out/" + (System.getenv("CATALOGUE_REPORT") ?: "CATALOGUE-GATE.md"))
    report.parentFile.mkdirs()
    report.writeText(CatalogueReport.render(runs, from))
    val exposed = runs.count { it.exposes }
    val served = runs.count { it.served }
    println()
    println("CATALOGUE GATE $exposed/${runs.size} providers expose a catalogue, $served returned real items")
    println("report ${report.path}")
}

private fun drive(file: String, provider: Provider): CatalogueRun {
    val rows = runCatching { provider.catalogue }
    val listed = rows.getOrNull()
    if (listed == null) {
        println("=== $file / ${provider.name}: listing rows threw")
        return CatalogueRun(
            file, provider.name, provider.info.hasMainPage, emptyList(), emptyList(),
            "listing rows threw ${line(rows.exceptionOrNull()!!)}",
        )
    }
    println("=== $file / ${provider.name}  ${listed.size} row(s)")
    for (row in listed) {
        println("  row \"${row.name}\" data=${row.data.take(120)}" + if (row.declared) "" else "  [stood up]")
    }
    val attempts = ArrayList<RowAttempt>()
    for (row in listed.take(ROW_LIMIT)) {
        val attempt = fetch(provider, row)
        attempts.add(attempt)
        println(transcript(attempt))
        if (attempt.real > 0) break
    }
    return CatalogueRun(file, provider.name, provider.info.hasMainPage, listed, attempts, null)
}

private fun fetch(provider: Provider, row: CatalogueRow): RowAttempt {
    val since = System.currentTimeMillis()
    val started = System.nanoTime()
    val traced = CallTrace.tracing { runCatching { provider.cataloguePage(row.name, 1) } }
    val millis = (System.nanoTime() - started) / 1_000_000
    val page = traced.value.getOrNull()
    val sections = page?.sections?.map { it.name to it.items.map { item -> item.name } }.orEmpty()
    val empty = sections.sumOf { it.second.size } == 0
    return RowAttempt(
        row = row,
        page = 1,
        sections = sections,
        hasNext = page?.hasNext ?: false,
        millis = millis,
        error = traced.value.exceptionOrNull()?.let { "cataloguePage threw ${line(it)}" },
        note = if (empty) runCatching { provider.why(since) }.getOrNull() else null,
        http = traced.http,
        logs = traced.logs,
    )
}

private fun transcript(attempt: RowAttempt): String {
    val out = StringBuilder()
    out.append("    page 1 of \"${attempt.row.name}\" -> ${attempt.items} item(s) ")
    out.append("in ${attempt.sections.size} section(s), hasNext=${attempt.hasNext}, ${attempt.millis}ms\n")
    attempt.http.forEach { out.append("      http ${it.line()}\n") }
    attempt.logs.forEach { out.append("      said ${it.take(200)}\n") }
    attempt.error?.let { out.append("      error $it\n") }
    attempt.note?.let { out.append("      note  $it\n") }
    for ((name, titles) in attempt.sections) {
        out.append("      section \"$name\" ${titles.size} item(s)\n")
        titles.take(3).forEach { out.append("        - $it\n") }
    }
    return out.toString().trimEnd('\n')
}

object CatalogueReport {

    fun render(runs: List<CatalogueRun>, from: File): String {
        val exposed = runs.filter { it.exposes }
        val served = runs.filter { it.served }
        val out = StringBuilder()
        out.append("# Catalogue gate\n\n")
        out.append("Every provider's browse rows, listed and then fetched over the real network. A row is only\n")
        out.append("counted as working when page 1 of it came back with titles that are not blank, so a provider\n")
        out.append("that claims a row and answers nothing is on the wrong side of the second number.\n\n")
        out.append("Samples: `${from.path}`. Up to $ROW_LIMIT row(s) tried per provider, ")
        out.append("stopping at the first that returns titles. Call timeout ${TIMEOUT_MS}ms.\n\n")
        out.append("| | count |\n|---|---|\n")
        out.append("| providers driven | ${runs.size} |\n")
        out.append("| expose a catalogue | ${exposed.size} |\n")
        out.append("| of those, rows are the provider's own | ${exposed.count { it.declaredRows > 0 }} |\n")
        out.append("| of those, one row stood up for it | ${exposed.count { it.declaredRows == 0 }} |\n")
        out.append("| returned real items | ${served.size} |\n")
        out.append("| total titles read back | ${runs.sumOf { it.real }} |\n\n")
        out.append(onlyCatalogue(runs))
        out.append(table(runs))
        return out.toString()
    }

    private fun onlyCatalogue(runs: List<CatalogueRun>): String {
        val out = StringBuilder("## The two archives with no search\n\n")
        out.append("`DoraBash` and `PublicSportsIPTV` declare no `search`, so before this surface existed\n")
        out.append("nothing in Harbor could reach either one.\n\n")
        out.append("| archive | provider | rows | own rows | titles | verdict |\n|---|---|---|---|---|---|\n")
        for (name in ONLY_CATALOGUE) {
            val found = runs.filter { it.file.removeSuffix(".cs3") == name }
            if (found.isEmpty()) {
                out.append("| `$name` | | | | | _not in this run's samples_ |\n")
                continue
            }
            for (run in found) out.append(row(run))
        }
        out.append('\n')
        return out.toString()
    }

    private fun table(runs: List<CatalogueRun>): String {
        val out = StringBuilder("## Every provider\n\n")
        out.append("`own rows` counts the rows the provider declares itself. Where it is 0 and `rows` is 1,\n")
        out.append("that row was stood up because the provider answers the call and names none.\n\n")
        out.append("| archive | provider | rows | own rows | titles | verdict |\n|---|---|---|---|---|---|\n")
        for (run in runs.sortedWith(compareByDescending<CatalogueRun> { it.real }.thenBy { it.file })) {
            out.append(row(run))
        }
        return out.toString()
    }

    private fun row(run: CatalogueRun): String {
        val provider = run.providerName.ifEmpty { "_none_" }
        return "| `${run.file}` | $provider | ${run.rows.size} | ${run.declaredRows} | ${run.real} | ${run.verdict} |\n"
    }
}
