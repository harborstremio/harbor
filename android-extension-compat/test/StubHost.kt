package harbor.capstan.test

import com.google.gson.JsonObject
import com.google.gson.JsonParser
import harbor.compat.host.HostChannel
import harbor.compat.host.HostLink
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.Collections
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

class SolveOutcome(val answer: Map<String, String>?, val detail: String)

object StubSolver {

    const val AGENT = ChallengeSite.SOLVED_AGENT

    fun solve(url: String): SolveOutcome {
        val first = fetch(url, null)
        val cookie = first.cookies.values.joinToString("; ")
        if (!HostLink.isChallenge(first.status, first.mitigated, first.body)) {
            if (cookie.isEmpty()) return SolveOutcome(null, "${first.status}, not a challenge and no cookie set")
            return SolveOutcome(answer(cookie), "${first.status}, not a challenge, kept ${first.cookies.size} cookie(s)")
        }
        if (cookie.isEmpty()) return SolveOutcome(null, "${first.status} challenge, and it set no cookie to try")
        val second = fetch(url, cookie)
        if (HostLink.isChallenge(second.status, second.mitigated, second.body)) {
            return SolveOutcome(
                null,
                "${first.status} challenge, and the ${first.cookies.size} cookie(s) it set did not clear it, " +
                    "still ${second.status}: this one needs a browser",
            )
        }
        return SolveOutcome(answer(cookie), "${first.status} challenge cleared to ${second.status} by cookie alone")
    }

    private fun answer(cookie: String) = mapOf("cookie" to cookie, "userAgent" to AGENT)

    private class Page(
        val status: Int,
        val mitigated: String?,
        val body: String,
        val cookies: Map<String, String>,
    )

    private fun fetch(url: String, cookie: String?): Page {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = 15_000
        connection.readTimeout = 15_000
        connection.setRequestProperty("User-Agent", AGENT)
        if (!cookie.isNullOrEmpty()) connection.setRequestProperty("Cookie", cookie)
        try {
            val status = connection.responseCode
            val jar = LinkedHashMap<String, String>()
            for ((key, values) in connection.headerFields) {
                if (key == null || !key.equals("set-cookie", ignoreCase = true)) continue
                for (raw in values) {
                    val pair = raw.substringBefore(';').trim()
                    val name = pair.substringBefore('=')
                    if (name.isNotEmpty() && pair.contains('=')) jar[name] = pair
                }
            }
            val stream = runCatching { connection.inputStream }.getOrNull() ?: connection.errorStream
            val head = ByteArray(64 * 1024)
            val read = stream?.use { it.readNBytes(head, 0, head.size) } ?: 0
            return Page(status, connection.getHeaderField("cf-mitigated"), String(head, 0, read), jar)
        } finally {
            connection.disconnect()
        }
    }
}

class HostAsk(val method: String, val url: String, val cleared: Boolean, val detail: String) {

    fun line(): String = "$method ${if (cleared) "cleared" else "did not clear"} $url: $detail"
}

class GateHost : HostChannel {

    private val recorded = Collections.synchronizedList(ArrayList<HostAsk>())

    val asks: List<HostAsk> get() = synchronized(recorded) { ArrayList(recorded) }

    fun drain(): List<HostAsk> = synchronized(recorded) {
        val taken = ArrayList(recorded)
        recorded.clear()
        taken
    }

    override fun request(
        method: String,
        params: Map<String, String>,
        timeoutMs: Long,
    ): Map<String, String>? {
        val url = params["url"].orEmpty()
        if (method != HostLink.METHOD_CHALLENGE) {
            recorded.add(HostAsk(method, url, false, "this host has no method named $method"))
            return null
        }
        val outcome = runCatching { StubSolver.solve(url) }
            .getOrElse { SolveOutcome(null, "the solve threw ${line(it)}") }
        recorded.add(HostAsk(method, url, outcome.answer != null, outcome.detail))
        return outcome.answer
    }
}

class PipedHost(input: InputStream, private val output: OutputStream) {

    private val reverse = LinkedBlockingQueue<JsonObject>()

    private val answers = ConcurrentHashMap<String, LinkedBlockingQueue<JsonObject>>()

    private val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))

    // A piped stream fails every read once the thread that last wrote to it has ended.
    private val outbox = LinkedBlockingQueue<JsonObject>()

    fun start(): PipedHost {
        val writer = Thread({
            while (true) {
                val frame = outbox.take()
                output.write((frame.toString() + "\n").toByteArray(Charsets.UTF_8))
                output.flush()
            }
        }, "stub-host-writer")
        writer.isDaemon = true
        writer.start()
        val thread = Thread({
            while (true) {
                val line = reader.readLine() ?: return@Thread
                if (line.isBlank()) continue
                val frame = runCatching { JsonParser.parseString(line) }.getOrNull()
                    ?.takeIf { it.isJsonObject }?.asJsonObject ?: continue
                if (frame.has("host")) {
                    reverse.put(frame)
                } else {
                    val id = frame.get("id")?.asString ?: continue
                    answers.computeIfAbsent(id) { LinkedBlockingQueue() }.put(frame)
                }
            }
        }, "stub-host")
        thread.isDaemon = true
        thread.start()
        return this
    }

    fun takeReverse(timeoutMs: Long): JsonObject? = reverse.poll(timeoutMs, TimeUnit.MILLISECONDS)

    fun call(id: String, method: String): JsonObject? {
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("method", method)
        write(frame)
        return answers.computeIfAbsent(id) { LinkedBlockingQueue() }.poll(20, TimeUnit.SECONDS)
    }

    fun answer(id: String, result: Map<String, String>) {
        val body = JsonObject()
        for ((key, value) in result) body.addProperty(key, value)
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("ok", true)
        frame.add("result", body)
        write(frame)
    }

    fun refuse(id: String, code: String, message: String) {
        val error = JsonObject()
        error.addProperty("code", code)
        error.addProperty("message", message)
        val frame = JsonObject()
        frame.addProperty("id", id)
        frame.addProperty("ok", false)
        frame.add("error", error)
        write(frame)
    }

    private fun write(frame: JsonObject) {
        outbox.put(frame)
    }
}
