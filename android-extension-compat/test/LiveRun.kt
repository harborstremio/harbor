package harbor.capstan.test

import com.harbor.capstan.HttpCall
import com.harbor.capstan.LinkSet
import com.harbor.capstan.MediaItem
import com.harbor.capstan.ResolveAttempt
import com.harbor.capstan.SearchItem

/** One candidate taken from a search hit as far as it would go. */
class Candidate(
    val hit: SearchItem,
    val detail: MediaItem?,
    val detailMs: Long,
    val detailHttp: List<HttpCall>,
    val error: String?,
    val dataSource: String = "",
    val data: String = "",
    val links: LinkSet? = null,
    val linksMs: Long = 0,
    val attempts: List<ResolveAttempt> = emptyList(),
    val linkHttp: List<HttpCall> = emptyList(),
    val probes: List<LinkProbe> = emptyList(),
    val logs: List<String> = emptyList(),
) {
    val linkCount: Int get() = links?.links?.size ?: 0
}

/** One provider driven end to end, with the verdict derived from what was recorded rather than
 * from a judgement made at the time. */
class LiveRun(
    val file: String,
    val providerName: String,
    val query: String,
    val results: List<SearchItem>?,
    val abort: String?,
    val searchMs: Long = 0,
    val searchHttp: List<HttpCall> = emptyList(),
    val searchLogs: List<String> = emptyList(),
    val candidates: List<Candidate> = emptyList(),
    /** Set when the gate changed something about the provider before driving it. */
    val note: String? = null,
    /** Whether a host was there to answer the layer's reverse requests during this pass. */
    val hostAttached: Boolean = false,
    /** Every reverse request the layer made during this pass, and what the host did about it. */
    val asks: List<HostAsk> = emptyList(),
) {
    /** The provider, plus a marker when this pass was not the one the extension ships with. */
    val label: String get() = if (note == null) providerName else "$providerName (repointed)"

    /** Why a failing pass failed is a different question with and without a host, and a run that
     * cannot say which of the two it was cannot be read at all. */
    val hostState: String
        get() = when {
            !hostAttached -> "no host attached"
            asks.isEmpty() -> "host attached, never asked"
            else -> "host attached, cleared ${asks.count { it.cleared }} of ${asks.size}"
        }

    val winner: Candidate? get() = candidates.firstOrNull { it.linkCount > 0 }

    val played: Boolean get() = winner != null

    val attempts: List<ResolveAttempt> get() = candidates.flatMap { it.attempts }

    val http: List<HttpCall>
        get() = searchHttp + candidates.flatMap { it.detailHttp + it.linkHttp }

    val verdict: String
        get() = if (played) reason else "$reason ($hostState)"

    private val reason: String
        get() {
            val refused = searchHttp.firstOrNull { !it.ok }
            val challenged = searchHttp.firstOrNull { it.apiPathAnsweredWithPage }
            return when {
                abort != null -> "blocked: $abort"
                results.isNullOrEmpty() && refused != null ->
                    "search returned nothing, its request answered ${refused.error ?: refused.status}"
                results.isNullOrEmpty() && challenged != null ->
                    "search returned nothing, its api path answered 200 with ${challenged.contentType}"
                results.isNullOrEmpty() -> "search returned nothing, every request it made succeeded"
                played -> "live, ${winner!!.linkCount} link(s) on candidate ${candidates.indexOf(winner!!) + 1}"
                candidates.none { it.detail != null } -> "load returned nothing for every candidate"
                attempts.any { !it.covered } -> "no links, a host had no registry entry"
                attempts.isNotEmpty() -> "no links, every host had an entry and still yielded none"
                candidates.any { it.links != null && it.linkHttp.isEmpty() } ->
                    "no links and no request made, the provider gave up before the network"
                else -> "no links, the provider built them itself and produced none"
            }
        }

    fun transcript(): String {
        val out = StringBuilder()
        if (note != null) out.append("  note     $note\n")
        out.append("  search   \"$query\" -> ${results?.size ?: 0} results in ${searchMs}ms\n")
        searchHttp.forEach { out.append("      http ${it.line()}\n") }
        searchLogs.forEach { out.append("      said ${it.take(200)}\n") }
        if (abort != null) out.append("  ABORT    $abort\n")
        out.append("  host     $hostState\n")
        asks.forEach { out.append("      ask  ${it.line()}\n") }
        results?.take(5)?.forEach { out.append("    - ${it.name}  [${it.type}]  ${it.url}\n") }
        if ((results?.size ?: 0) > 5) out.append("    ... ${results!!.size - 5} more\n")
        candidates.forEachIndexed { index, candidate -> out.append(render(index + 1, candidate)) }
        return out.toString()
    }

    private fun render(position: Int, candidate: Candidate): String {
        val out = StringBuilder()
        out.append("  --- candidate $position: ${candidate.hit.name}\n")
        candidate.detailHttp.forEach { out.append("      http ${it.line()}\n") }
        if (candidate.error != null) out.append("      error  ${candidate.error}\n")
        val detail = candidate.detail
            ?: return out.append("      load   returned nothing\n").toString()
        out.append("      load   \"${detail.name}\" type=${detail.type} year=${detail.year ?: "-"} ")
        out.append("episodes=${detail.episodes.size} in ${candidate.detailMs}ms\n")
        if (candidate.dataSource.isEmpty()) return out.toString()
        out.append("      data   from ${candidate.dataSource}: ${candidate.data.take(200)}\n")
        candidate.linkHttp.forEach { out.append("      http ${it.line()}\n") }
        candidate.logs.forEach { out.append("      said ${it.take(200)}\n") }
        val links = candidate.links ?: return out.toString()
        out.append("      links  ${links.links.size} links, ${links.subtitles.size} subtitles ")
        out.append("in ${candidate.linksMs}ms, provider reported handled=${links.handled}\n")
        links.links.forEach {
            out.append("        [${it.quality}p ${it.type}] ${it.name}\n")
            out.append("          url     ${it.url}\n")
            if (it.referer.isNotEmpty()) out.append("          referer ${it.referer}\n")
            if (it.headers.isNotEmpty()) out.append("          headers ${it.headers}\n")
        }
        candidate.probes.forEach { out.append("        fetched ${it.line()}\n") }
        links.subtitles.forEach { out.append("        sub [${it.lang}] ${it.url}\n") }
        candidate.attempts.forEach {
            val entries = if (it.covered) it.registryEntries.joinToString(", ") else "NONE"
            out.append("        resolve ${it.host} -> registry [$entries] ")
            out.append("tried [${it.triedExtractors.joinToString(", ")}] produced ${it.linksProduced}\n")
            out.append("          asked   ${it.url}\n")
        }
        return out.toString()
    }
}
