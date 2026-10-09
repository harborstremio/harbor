package com.harbor.capstan

import com.lagradost.api.Log
import com.lagradost.cloudstream3.utils.ExtractorProbe
import com.lagradost.cloudstream3.utils.extractorWatch
import com.lagradost.nicehttp.RequestRecord
import com.lagradost.nicehttp.requestWatch
import java.util.Collections

data class ResolveAttempt(
    val url: String,
    val host: String,
    val registryEntries: List<String>,
    val triedExtractors: List<String>,
    val linksProduced: Int,
) {
    val covered: Boolean get() = registryEntries.isNotEmpty()
}

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

    val apiPathAnsweredWithPage: Boolean get() = ok && html && url.contains("/api/")
}

data class Traced<T>(
    val value: T,
    val resolves: List<ResolveAttempt>,
    val http: List<HttpCall>,
    val logs: List<String>,
)

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
