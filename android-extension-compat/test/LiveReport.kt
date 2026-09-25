package harbor.capstan.test

import java.time.LocalDate

/** Renders the live run as markdown. Every number here came out of a real request. */
object LiveReport {

    private const val BR = "\n"

    fun render(runs: List<LiveRun>, maxCandidates: Int, command: String): String {
        val played = runs.count { it.played }
        val out = StringBuilder()
        out.append("# Live gate\n\n")
        out.append("Every provider below was loaded from its real `.cs3`, then driven over the real network:\n")
        out.append("`search`, then `load`, then `loadLinks`. Nothing is stubbed and nothing is replayed.\n\n")
        out.append("Result: **$played of ${runs.size}** providers returned at least one playable link.  \n")
        val depth = if (maxCandidates == Int.MAX_VALUE) "Every search result is"
        else "Up to $maxCandidates search results are"
        out.append("$depth chased per provider, stopping at the first that plays.  \n")
        out.append("Run: ${LocalDate.now()}\n\n")
        out.append("Exactly what was run:\n\n```\ncd D:/harbor-beta/android-extension-compat\nsh tools/build.sh\n")
        out.append(command).append("\n```\n\n")

        out.append(table(runs)).append('\n')
        out.append(host(runs)).append('\n')
        out.append(refusals(runs)).append('\n')
        out.append(coverage(runs)).append('\n')
        out.append(transcripts(runs))
        return out.toString()
    }

    /** Whether a host was there to answer the layer's reverse requests, and what it managed.
     *
     * Without this the report cannot tell a pass that had no chance of clearing a challenge from one
     * that had a host and failed anyway, and those are different findings about different code. */
    private fun host(runs: List<LiveRun>): String {
        val out = StringBuilder("## The host channel\n\n")
        val attached = runs.count { it.hostAttached }
        val asks = runs.flatMap { run -> run.asks.map { run to it } }
        when {
            attached == 0 -> out.append(
                "No host was attached to any pass, so the layer's reverse `challenge` request went\n" +
                    "unanswered wherever it was made. A pass that produced no link here has not been\n" +
                    "shown to fail with a host present. Rerun with `LIVE_HOST=stub` for that.\n",
            )
            attached < runs.size -> out.append(
                "A host was attached to $attached of ${runs.size} passes. The rest ran standalone.\n",
            )
            else -> out.append("A host was attached to every pass, answering `challenge`.\n")
        }
        if (attached > 0 && asks.isEmpty()) {
            out.append(
                "\nIt was never asked. Nothing any provider fetched in this run came back looking like\n" +
                    "an interactive challenge, so the clearance path was not exercised and cannot be\n" +
                    "credited with any pass or blamed for any failure here.\n",
            )
            return out.toString()
        }
        if (asks.isEmpty()) return out.toString()
        out.append("\n| provider | asked for | cleared | what the host found |\n")
        out.append("| --- | --- | :-: | --- |\n")
        for ((run, ask) in asks) {
            out.append("| ${run.label} | `${ask.url.take(90)}` | ${if (ask.cleared) "yes" else "no"} | ")
            out.append("${ask.detail} |\n")
        }
        return out.toString()
    }

    private fun table(runs: List<LiveRun>): String {
        val out = StringBuilder("## Verdict per provider\n\n")
        out.append("| extension | provider | query | results | played | links | subs | fetched | verdict |\n")
        out.append("| --- | --- | --- | --: | --- | --: | --: | :-: | --- |\n")
        for (run in runs) {
            val winner = run.winner
            val name = winner?.detail?.name?.let { "\"${it.take(40)}\"" } ?: "-"
            out.append("| `${run.file}` | ${run.label} | `${run.query}` | ${run.results?.size ?: 0} | ")
            val probes = winner?.probes.orEmpty()
            val fetched = if (probes.isEmpty()) "-" else "${probes.count { it.served }}/${probes.size}"
            out.append("$name | ${winner?.linkCount ?: 0} | ${winner?.links?.subtitles?.size ?: 0} | ")
            out.append("$fetched | ${run.verdict} |\n")
        }
        return out.toString()
    }

    /** A provider that swallows a refused fetch reports an empty list, which is indistinguishable
     * from an honest miss until you look at what the server answered. */
    private fun refusals(runs: List<LiveRun>): String {
        val out = StringBuilder("## Requests the sites refused or challenged\n\n")
        val bad = runs.flatMap { run ->
            run.http.filter { !it.ok || it.apiPathAnsweredWithPage }.map { run to it }
        }
        if (bad.isEmpty()) {
            out.append("Every request every provider made in this run came back 2xx with the body type the\n")
            out.append("caller asked for, so nothing below is explained by a site turning the fetch away.\n")
            return out.toString()
        }
        out.append("| provider | answered | type | bytes | url |\n")
        out.append("| --- | --- | --- | --: | --- |\n")
        for ((run, call) in bad) {
            val status = call.error ?: call.status.toString()
            val note = if (call.apiPathAnsweredWithPage) " (api path, page body: a challenge)" else ""
            out.append("| ${run.label} | $status$note | ${call.contentType.ifEmpty { "-" }} | ")
            out.append("${call.bodyBytes} | `${call.url.take(150)}` |\n")
        }
        return out.toString()
    }

    /** The question this gate exists to answer: when a provider handed the layer a url, did the
     * registry have a class for that host. */
    private fun coverage(runs: List<LiveRun>): String {
        val out = StringBuilder("## Extractor registry coverage\n\n")
        val all = runs.flatMap { run -> run.attempts.map { run to it } }
        if (all.isEmpty()) {
            out.append("No provider in this run handed a url to `loadExtractor`: every link was built by\n")
            out.append("the provider itself, so the registry was never consulted and cannot be the cause\n")
            out.append("of a missing link here.\n")
            return out.toString()
        }
        out.append("| provider | host wanted | registry entry | tried | links from it |\n")
        out.append("| --- | --- | --- | --- | --: |\n")
        for ((run, attempt) in all) {
            val entry = if (attempt.covered) attempt.registryEntries.joinToString(", ") else "**none**"
            out.append("| ${run.label} | `${attempt.host}` | $entry | ")
            out.append("${attempt.triedExtractors.joinToString(", ")} | ${attempt.linksProduced} |\n")
        }
        out.append('\n')
        val uncovered = all.filter { !it.second.covered }.map { it.second.host }.distinct()
        if (uncovered.isEmpty()) {
            out.append("Every host asked for had a registry entry, so no missing link in this run is\n")
            out.append("attributable to a gap in the registry.\n")
        } else {
            out.append("Hosts with no registry entry, which is the known risk this gate measures:\n\n")
            uncovered.forEach { out.append("- `$it`\n") }
        }
        return out.toString()
    }

    private fun transcripts(runs: List<LiveRun>): String {
        val out = StringBuilder("## Transcripts\n\n")
        for (run in runs) {
            out.append("### ${run.label} (`${run.file}`)\n\n")
            out.append("```\n").append(run.transcript()).append("```\n\n")
        }
        return out.toString()
    }
}
