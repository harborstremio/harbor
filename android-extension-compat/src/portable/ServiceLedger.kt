package com.harbor.capstan

import com.lagradost.nicehttp.RequestRecord
import com.lagradost.nicehttp.serviceLedger
import java.net.URI
import java.util.concurrent.ConcurrentHashMap

object ServiceLedger {

    private const val CAP = 400

    private val last = ConcurrentHashMap<String, Answer>()

    class Answer(
        val host: String,
        val status: Int,
        val error: String?,
        val apiPage: Boolean,
        val at: Long,
        val okAt: Long,
    ) {
        val refused: Boolean get() = refuses(status, apiPage)
    }

    private fun refuses(status: Int, apiPage: Boolean): Boolean = when {
        status == 0 -> true
        apiPage -> true
        status in 500..599 -> true
        status == 429 -> true
        status == 401 || status == 403 || status == 407 || status == 451 -> true
        else -> false
    }

    fun install() {
        serviceLedger = ::record
    }

    fun record(record: RequestRecord) {
        val host = hostOf(record.url) ?: return
        if (last.size > CAP) last.clear()
        val page = record.status in 200..299 &&
            record.contentType.startsWith("text/html") &&
            record.url.contains("/api/")
        val now = System.currentTimeMillis()
        val okAt = if (refuses(record.status, page)) last[host]?.okAt ?: 0 else now
        last[host] = Answer(host, record.status, record.error, page, now, okAt)
    }

    fun note(hosts: Collection<String>, since: Long): String? {
        val seen = hosts.mapNotNull { last[it.lowercase()] }.filter { it.at >= since }
        if (seen.isEmpty() || seen.any { !it.refused || it.okAt >= since }) return null
        val latest = seen.maxByOrNull { it.at } ?: return null
        val head = describe(latest)
        val others = seen.size - 1
        if (others <= 0) return head
        return "$head, and $others other ${if (others == 1) "address" else "addresses"} also refused"
    }

    fun hostOf(url: String): String? =
        runCatching { URI(url).host?.lowercase() }.getOrNull()?.takeIf { it.isNotEmpty() }

    private fun describe(answer: Answer): String = when {
        answer.status == 0 -> "${answer.host} did not respond${shortly(answer.error)}"
        answer.apiPage -> "${answer.host} answered with a page instead of data"
        answer.status == 429 -> "${answer.host} is rate limiting (HTTP 429)"
        answer.status in 500..599 -> "${answer.host} is down (HTTP ${answer.status})"
        answer.status == 401 || answer.status == 403 ->
            "${answer.host} refused the request (HTTP ${answer.status})"
        else -> "${answer.host} answered HTTP ${answer.status}"
    }

    private fun shortly(error: String?): String {
        val text = error.orEmpty()
        if (text.isEmpty()) return ""
        return when {
            text.contains("UnknownHost") -> " (no such address)"
            text.contains("timed out", ignoreCase = true) || text.contains("Timeout") -> " (timed out)"
            text.contains("Connect") -> " (could not connect)"
            else -> ""
        }
    }
}
