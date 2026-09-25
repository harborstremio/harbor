package harbor.compat.host

import java.util.concurrent.ConcurrentHashMap

/** Cookies that cleared an interactive challenge, and the agent they are bound to.
 *
 * Cloudflare binds `cf_clearance` to the user agent that solved, so the pair travels together and
 * replaying one without the other is worse than replaying neither. */
class ChallengeSolution(val cookie: String, val userAgent: String)

/** One reverse request: the layer asks the attached host something and waits for the answer.
 *
 * Returns the answer's fields, or null when the host refused, answered with an error, or did not
 * answer inside [timeoutMs]. Nothing here distinguishes those three, because every caller does the
 * same thing with all of them, which is to carry on without a host.
 */
fun interface HostChannel {
    fun request(method: String, params: Map<String, String>, timeoutMs: Long): Map<String, String>?
}

/** The layer's side of the reverse direction, and the challenge case built on it.
 *
 * Standalone, no host is attached and [solveChallenge] answers null immediately, so the gates and
 * any embedder without a browser behave exactly as they did before this existed. */
object HostLink {

    const val METHOD_CHALLENGE = "challenge"

    const val CHALLENGE_TIMEOUT_MS = 120_000L

    /** How long a solved clearance is replayed before it is asked for again. */
    private const val SOLUTION_TTL_MS = 20 * 60 * 1000L

    /** How long a host that failed to solve is left alone. Without this a run against a host that
     * cannot be solved pays the full solve wait on every single request it makes. */
    private const val FAILURE_COOLDOWN_MS = 30 * 60 * 1000L

    private class Held(val solution: ChallengeSolution, val at: Long)

    @Volatile
    var channel: HostChannel? = null

    private val solved = ConcurrentHashMap<String, Held>()

    private val failed = ConcurrentHashMap<String, Long>()

    private val locks = ConcurrentHashMap<String, Any>()

    fun attached(): Boolean = channel != null

    fun request(method: String, params: Map<String, String>, timeoutMs: Long): Map<String, String>? {
        val host = channel ?: return null
        return try {
            host.request(method, params, timeoutMs)
        } catch (failure: Throwable) {
            PlatformHost.log(5, "HostLink", "$method failed: ${failure.javaClass.simpleName}")
            null
        }
    }

    /** What is already known for [host], without asking anyone. */
    fun cached(host: String?): ChallengeSolution? {
        val key = host?.lowercase() ?: return null
        val held = solved[key] ?: return null
        if (System.currentTimeMillis() - held.at > SOLUTION_TTL_MS) {
            solved.remove(key)
            return null
        }
        return held.solution
    }

    fun invalidate(host: String?) {
        solved.remove(host?.lowercase() ?: return)
    }

    /** Asks the host to clear the challenge in front of [url], or returns what it cleared earlier.
     *
     * One solve runs per host at a time: a page that fans out ten requests into the same challenged
     * host must open one window, not ten. */
    fun solveChallenge(url: String, timeoutMs: Long = CHALLENGE_TIMEOUT_MS): ChallengeSolution? {
        if (channel == null) return null
        val host = hostOf(url) ?: return null
        cached(host)?.let { return it }
        synchronized(locks.computeIfAbsent(host) { Any() }) {
            cached(host)?.let { return it }
            val since = failed[host]
            if (since != null) {
                if (System.currentTimeMillis() - since < FAILURE_COOLDOWN_MS) return null
                failed.remove(host)
            }
            val answer = request(METHOD_CHALLENGE, mapOf("url" to url), timeoutMs)
            val cookie = answer?.get("cookie").orEmpty()
            val agent = answer?.get("userAgent").orEmpty()
            if (cookie.isEmpty() || agent.isEmpty()) {
                failed[host] = System.currentTimeMillis()
                PlatformHost.log(5, "HostLink", "host did not clear $host")
                return null
            }
            val solution = ChallengeSolution(cookie, agent)
            solved[host] = Held(solution, System.currentTimeMillis())
            failed.remove(host)
            PlatformHost.log(4, "HostLink", "host cleared $host")
            return solution
        }
    }

    fun hostOf(url: String?): String? {
        if (url.isNullOrEmpty()) return null
        return try {
            java.net.URI(url).host?.lowercase()?.ifEmpty { null }
        } catch (_: Throwable) {
            null
        }
    }

    /** Both markers Cloudflare puts in front of a page a browser is meant to clear.
     *
     * A hard block is deliberately not a challenge: no amount of solving opens it, and treating it
     * as one costs the user a window that cannot help. */
    fun isChallenge(status: Int, mitigated: String?, body: String?): Boolean {
        val text = body.orEmpty()
        if (text.contains("Sorry, you have been blocked") ||
            text.contains("error code: 1020") ||
            text.contains("Error 1015") ||
            text.contains("You are being rate limited")
        ) return false
        if (mitigated == "challenge") return true
        if (status != 403 && status != 503) return false
        return text.contains("Just a moment") ||
            text.contains("cf_chl_opt") ||
            text.contains("challenge-form") ||
            text.contains("cf-please-wait")
    }

    /** Test seam. Drops every cached solve and cooldown so one gate run cannot colour the next. */
    fun forget() {
        solved.clear()
        failed.clear()
    }
}
