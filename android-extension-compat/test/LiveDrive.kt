package harbor.capstan.test

import com.harbor.capstan.CallTrace
import com.harbor.capstan.HttpCall
import com.harbor.capstan.LinkSet
import com.harbor.capstan.Provider
import com.harbor.capstan.SearchItem

/** The three calls a viewer triggers, in order, against the live site.
 *
 * Every one of them runs inside a trace, so a call that comes back empty is still accounted for by
 * the requests it made, the status each one got, and whatever the extension said while it ran. */
object LiveDrive {

    /** How many of a provider's links get fetched. Enough to prove the path, not a load test. */
    private const val PROBE_LIMIT = 3

    fun run(
        file: String,
        provider: Provider,
        query: String,
        maxCandidates: Int,
        note: String?,
        host: GateHost?,
    ): LiveRun {
        val started = System.nanoTime()
        val traced = CallTrace.tracing { runCatching { provider.search(query) } }
        val searchMs = since(started)
        val results = traced.value.getOrElse {
            return LiveRun(
                file, provider.name, query, null, "search threw ${line(it)}",
                searchMs, traced.http, traced.logs, note = note,
                hostAttached = host != null, asks = host?.drain().orEmpty(),
            )
        }
        val candidates = ArrayList<Candidate>()
        if (results.isNotEmpty()) {
            for (hit in results.take(maxCandidates)) {
                val candidate = chase(provider, hit)
                candidates.add(candidate)
                if (candidate.linkCount > 0) break
            }
        }
        return LiveRun(
            file, provider.name, query, results, null,
            searchMs, traced.http, traced.logs, candidates, note,
            host != null, host?.drain().orEmpty(),
        )
    }

    private fun chase(provider: Provider, hit: SearchItem): Candidate {
        var mark = System.nanoTime()
        val loaded = CallTrace.tracing { runCatching { provider.load(hit.url) } }
        val detailMs = since(mark)
        val detail = loaded.value.getOrElse {
            return Candidate(hit, null, detailMs, loaded.http, "load threw ${line(it)}", logs = loaded.logs)
        } ?: return Candidate(hit, null, detailMs, loaded.http, null, logs = loaded.logs)

        val data = detail.playableData ?: detail.episodes.firstOrNull()?.data
        if (data == null) {
            return Candidate(
                hit, detail, detailMs, loaded.http, "loaded with nothing playable", logs = loaded.logs,
            )
        }
        val source = if (detail.playableData != null) "playableData" else "episode 1 data"

        mark = System.nanoTime()
        val traced = CallTrace.tracing { runCatching { provider.loadLinks(data) } }
        val linksMs = since(mark)
        val links: LinkSet? = traced.value.getOrNull()
        val error = traced.value.exceptionOrNull()?.let { "loadLinks threw ${line(it)}" }
        val probes = links?.links?.let { LinkProbes.probe(it, PROBE_LIMIT) }.orEmpty()
        return Candidate(
            hit, detail, detailMs, loaded.http, error, source, data,
            links, linksMs, traced.resolves, traced.http, probes, loaded.logs + traced.logs,
        )
    }

    private fun since(startedNanos: Long): Long = (System.nanoTime() - startedNanos) / 1_000_000
}

/** A compact one line rendering of a request, short enough to read a whole trace at once. */
fun HttpCall.line(): String {
    val outcome = error ?: "$status ${contentType.ifEmpty { "?" }} ${bodyBytes}B"
    return "$method $outcome ${millis}ms ${url.take(160)}"
}
