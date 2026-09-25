package com.harbor.capstan

import com.lagradost.api.Log
import com.lagradost.cloudstream3.utils.ExtractorProbe
import com.lagradost.cloudstream3.utils.extractorWatch
import com.lagradost.nicehttp.RequestRecord
import com.lagradost.nicehttp.requestWatch
import java.util.Collections

/** One url an extension asked the layer to turn into a stream, and what the registry did with it.
 *
 * [registryEntries] is the coverage fact: empty means nobody wrote a class for this host and the
 * attempt fell through to the generic reader, which is a different failure from an entry that ran
 * and came back empty. */
data class ResolveAttempt(
    val url: String,
    val host: String,
    val registryEntries: List<String>,
    val triedExtractors: List<String>,
    val linksProduced: Int,
) {
    val covered: Boolean get() = registryEntries.isNotEmpty()
}

/** One request that left the machine. Status 0 means the call never completed.
 *
 * [contentType] is load bearing: a site that answers an api path with 200 and a page of html is
 * serving a challenge, and that reads as success everywhere except here. */
data class HttpCall(
    val method: String,
    val url: String,
    val status: Int,
    val contentType: String,
    val bodyBytes: Int,
    val millis: Long,
    val error: String?,
) {
    val ok: Boolean get() = status in 200..299

    val html: Boolean get() = contentType.startsWith("text/html")

    /** What the caller asked for, as far as the url says, against what came back. */
    val apiPathAnsweredWithPage: Boolean get() = ok && html && url.contains("/api/")
}

data class Traced<T>(
    val value: T,
    val resolves: List<ResolveAttempt>,
    val http: List<HttpCall>,
    /** What the extension itself said while it ran. An extension that gives up on purpose usually
     * says so here and nowhere else. */
    val logs: List<String>,
)

/** Records what an extension did on the wire while [block] runs.
 *
 * Only one recording can be in flight, because the watches it installs are process wide. */
object CallTrace {

    private val lock = Any()

    fun <T> tracing(block: () -> T): Traced<T> = synchronized(lock) {
        val resolves = Collections.synchronizedList(ArrayList<ResolveAttempt>())
        val http = Collections.synchronizedList(ArrayList<HttpCall>())
        val logs = Collections.synchronizedList(ArrayList<String>())
        val previous = Log.sink
        extractorWatch = { probe -> resolves.add(resolve(probe)) }
        requestWatch = { record -> http.add(call(record)) }
        Log.sink = { level, tag, message ->
            val line = "$level/$tag: $message"
            logs.add(line)
            if (previous != null) previous(level, tag, message)
            else if (level == 'E' || level == 'W') System.err.println(line) else println(line)
        }
        try {
            Traced(block(), ArrayList(resolves), ArrayList(http), ArrayList(logs))
        } finally {
            extractorWatch = null
            requestWatch = null
            Log.sink = previous
        }
    }

    private fun resolve(probe: ExtractorProbe) = ResolveAttempt(
        url = probe.url,
        host = probe.host,
        registryEntries = probe.named,
        triedExtractors = probe.ran,
        linksProduced = probe.produced,
    )

    private fun call(record: RequestRecord) = HttpCall(
        method = record.method,
        url = record.url,
        status = record.status,
        contentType = record.contentType,
        bodyBytes = record.bodyBytes,
        millis = record.millis,
        error = record.error,
    )
}
