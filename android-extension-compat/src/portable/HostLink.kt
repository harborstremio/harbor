package harbor.compat.host

import java.util.concurrent.ConcurrentHashMap

class ChallengeSolution(val cookie: String, val userAgent: String)

fun interface HostChannel {
    fun request(method: String, params: Map<String, String>, timeoutMs: Long): Map<String, String>?
}

object HostLink {

    const val METHOD_CHALLENGE = "challenge"

    const val CHALLENGE_TIMEOUT_MS = 120_000L

    private const val SOLUTION_TTL_MS = 20 * 60 * 1000L

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

    fun forget() {
        solved.clear()
        failed.clear()
    }
}
