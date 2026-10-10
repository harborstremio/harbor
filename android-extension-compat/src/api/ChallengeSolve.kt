package com.lagradost.nicehttp

import harbor.compat.host.HostLink
import okhttp3.Request
import okhttp3.Response

internal object ChallengeSolve {

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
