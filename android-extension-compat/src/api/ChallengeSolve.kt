package com.lagradost.nicehttp

import harbor.compat.host.HostLink
import okhttp3.Request
import okhttp3.Response

/** The challenge case on the request path the extensions actually use.
 *
 * A page fetched here is read by extension code, not rendered, so a challenge reaches the extension
 * as a body full of Cloudflare markup and it finds nothing in it. When a host is attached the
 * clearance is asked for once per host and replayed on a single retry of the same request.
 */
internal object ChallengeSolve {

    /** The same request carrying a clearance, or null when there is nothing to retry.
     *
     * Null covers every case where retrying cannot help: the response was not a challenge, no host
     * is attached, the host could not clear it, or this request already carried the clearance that
     * was refused, which means the clearance is stale rather than missing. */
    fun retryOf(request: Request, response: Response, body: String?): Request? {
        if (!HostLink.attached()) return null
        val url = request.url.toString()
        if (!HostLink.isChallenge(response.code, response.header("cf-mitigated"), body)) return null

        val host = HostLink.hostOf(url)
        val replayed = HostLink.cached(host)
        if (replayed != null && request.header("cookie")?.contains(replayed.cookie) == true) {
            HostLink.invalidate(host)
            return null
        }

        val solution = HostLink.solveChallenge(url) ?: return null
        val existing = request.header("cookie").orEmpty()
        val merged = if (existing.isBlank()) solution.cookie else "$existing; ${solution.cookie}"
        return request.newBuilder()
            .header("cookie", merged)
            .header("user-agent", solution.userAgent)
            .build()
    }
}
