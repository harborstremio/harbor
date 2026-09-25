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

/** What the solve was, once it is over. */
class SolveOutcome(val answer: Map<String, String>?, val detail: String)

/** What a host without a browser can do about a challenge, which is fetch the page, keep the
 * cookies it was handed, and try them once. That clears a site whose gate is a cookie. It does not
 * clear one that has to be solved by running script, and it must not claim to: cookies come back
 * from a Cloudflare interactive page too, so a solver that stopped at "I was given cookies" would
 * report every unsolvable challenge as solved. The retry below is what tells the two apart. */
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
            // Enough to see the challenge markers. A host asked about a url that turned out to serve
            // something large should not pull all of it into a gate.
            val head = ByteArray(64 * 1024)
            val read = stream?.use { it.readNBytes(head, 0, head.size) } ?: 0
            return Page(status, connection.getHeaderField("cf-mitigated"), String(head, 0, read), jar)
        } finally {
            connection.disconnect()
        }
    }
}

/** One reverse request the host was given, and what it was able to do about it. */
class HostAsk(val method: String, val url: String, val cleared: Boolean, val detail: String) {

    fun line(): String = "$method ${if (cleared) "cleared" else "did not clear"} $url: $detail"
}

/** The host the gates attach, wired straight into the layer with no bridge in between.
 *
 * One implementation serves both gates: the host gate asserts the protocol against it, and the live
 * gate runs real providers behind it, so a live run with a host attached is behind the same host
 * whose behaviour the host gate pins down. Every ask is recorded, because a run where the host was
 * never asked and a run where it was asked and failed are different findings. */
class GateHost : HostChannel {

    private val recorded = Collections.synchronizedList(ArrayList<HostAsk>())

    val asks: List<HostAsk> get() = synchronized(recorded) { ArrayList(recorded) }

    /** Everything asked since the last drain, cleared out. */
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

/** The other end of the two pipes: reads the bridge's protocol stream, answers reverse requests,
 * and hands forward responses back to whoever asked for them. */
class PipedHost(input: InputStream, private val output: OutputStream) {

    private val reverse = LinkedBlockingQueue<JsonObject>()

    private val answers = ConcurrentHashMap<String, LinkedBlockingQueue<JsonObject>>()

    private val reader = BufferedReader(InputStreamReader(input, Charsets.UTF_8))

    /** Every write goes through one long lived thread. A piped stream remembers which thread last
     * wrote to it and fails every later read once that thread has ended, so writing from a helper
     * thread would kill the bridge under test rather than testing it. */
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

    /** The next reverse request the layer sent, or null if none arrived in time. */
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
