package harbor.capstan.test

import com.harbor.capstan.LoadStage
import java.time.LocalDate

/** Renders the gate result as the markdown table the run is judged on. */
object GateReport {

    fun render(rows: List<GateRow>): String {
        val passed = rows.count { it.ok }
        val out = StringBuilder()
        out.append("# Load gate\n\n")
        out.append("Every sample extension run through the real loader. A stage is marked reached only when\n")
        out.append("the loader itself reported passing it, so the first blank column is where the load died.\n\n")
        out.append("Result: **$passed of ${rows.size}** extensions loaded.  \n")
        out.append("Run: ${LocalDate.now()}\n\n")

        out.append(summary(rows)).append('\n')
        out.append(providers(rows)).append('\n')
        if (passed != rows.size) out.append(failures(rows)).append('\n')
        return out.toString()
    }

    private fun summary(rows: List<GateRow>): String {
        val out = StringBuilder("## Stages\n\n")
        out.append("| extension | archive | dex convert | jar load | entry | instantiate | register | outcome |\n")
        out.append("| --- | :-: | :-: | :-: | :-: | :-: | :-: | --- |\n")
        for (row in rows) {
            out.append("| `${row.file}` |")
            for (stage in LoadStage.entries) out.append(if (row.reached.any { it.first == stage }) " yes |" else " no |")
            out.append(if (row.ok) " loaded |" else " failed at ${label(row.failedStage)} |")
            out.append('\n')
        }
        return out.toString()
    }

    private fun providers(rows: List<GateRow>): String {
        val out = StringBuilder("## What registered\n\n")
        out.append("| extension | v | entry class | provider | mainUrl | lang | types | extractors |\n")
        out.append("| --- | --- | --- | --- | --- | --- | --- | --- |\n")
        for (row in rows) {
            if (!row.ok) {
                out.append("| `${row.file}` | | | _nothing, load failed_ | | | | |\n")
                continue
            }
            if (row.providers.isEmpty()) {
                out.append("| `${row.file}` | ${row.version} | `${row.entryClass}` | _none registered_ | | | | ${row.extractors.size} |\n")
                continue
            }
            for ((index, provider) in row.providers.withIndex()) {
                val info = provider.info
                val head = if (index == 0) "`${row.file}` | ${row.version} | `${row.entryClass}`" else " | | "
                val types = info.supportedTypes.joinToString(", ").ifEmpty { "_none declared_" }
                val extractors = if (index == 0) row.extractors.size.toString() else ""
                out.append("| $head | ${info.name} | ${info.mainUrl} | ${info.lang} | $types | $extractors |\n")
            }
        }
        out.append('\n')
        val names = rows.filter { it.ok }.flatMap { it.providers }.map { it.info.name }
        out.append("${names.size} providers live: ${names.joinToString(", ")}\n")
        val allExtractors = rows.filter { it.ok }.flatMap { it.extractors }
        out.append("\n${allExtractors.size} extractors registered.\n")
        return out.toString()
    }

    private fun failures(rows: List<GateRow>): String {
        val out = StringBuilder("## Failures\n\n")
        out.append("The type a failure names is whichever one the JVM happened to resolve first, and it does\n")
        out.append("change between runs. The gap list below it does not, so that is the fact to work from.\n\n")
        for (row in rows.filter { !it.ok }) {
            val failure = row.failure!!
            out.append("### `${row.file}`\n\n")
            out.append("- Died at: **${label(row.failedStage)}**\n")
            out.append("- Last stage reached: ${row.reached.lastOrNull()?.let { "${label(it.first)} (${it.second})" } ?: "none"}\n")
            out.append("- Exception: `${failure.exceptionType}`\n")
            out.append("- Message: `${failure.message}`\n")
            failure.namedType?.let { out.append("- Type named: `$it`\n") }
            out.append("- Owning group: ${failure.owner}\n")
            failure.gap?.let { gap ->
                out.append("- Size of the gap: this extension names **${gap.types.size} distinct types** under ")
                out.append("`${gap.packageRoot}`, measured from its own converted bytecode\n\n")
                out.append("<details><summary>the ${gap.types.size} types</summary>\n\n")
                gap.types.forEach { out.append("- `$it`\n") }
                out.append("\n</details>\n")
            }
            out.append('\n')
        }
        return out.toString()
    }

    private fun label(stage: LoadStage?): String = when (stage) {
        LoadStage.ARCHIVE -> "archive read"
        LoadStage.CONVERT -> "dex convert"
        LoadStage.LINK -> "jar load"
        LoadStage.ENTRY -> "entry class"
        LoadStage.INSTANTIATE -> "instantiate"
        LoadStage.REGISTER -> "registration"
        null -> "after registration"
    }
}
