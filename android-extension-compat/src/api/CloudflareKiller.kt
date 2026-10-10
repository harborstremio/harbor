package com.lagradost.cloudstream3.network

import com.lagradost.nicehttp.ChallengeSolve
import okhttp3.Interceptor
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody

/** Clears a Cloudflare challenge and replays the request that met one.
 *
 * CloudStream's own interceptor answers the challenge itself, by running it in a WebView it owns.
 * This host has no WebView to run one in, so the challenge is handed up to the application instead:
 * it opens a window, waits for that to clear, and returns the clearance cookie together with the
 * user agent that earned it. `HostLink` holds that conversation and remembers a clearance per host.
 *
 * Leaving it as a pass-through does not fail loudly, which is why it went unnoticed: the provider
 * receives the challenge page as an ordinary 200 and parses it, and the stream it builds from that
 * is a real one — just not the one that was asked for.
 *
 * A body is read only for a 403 or a 503, because reading one buffers it and every other response
 * has to stay streamable. Those two are the only statuses a challenge arrives as, and the response
 * is put back together and handed on untouched when there is nothing to solve. */
class CloudflareKiller : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val response = chain.proceed(request)
        if (response.code != 403 && response.code != 503) return response

        val held = response.body
        val bytes = try {
            held?.bytes() ?: ByteArray(0)
        } catch (_: Throwable) {
            return response
        }
        // The bytes are consumed above, so the response has to be rebuilt before it can be passed
        // on: the original body is closed, and anything downstream would read nothing from it.
        val restored = response.newBuilder()
            .body(bytes.toResponseBody(held?.contentType()))
            .build()

        // A challenge is told apart from an ordinary refusal by what the body says, and the host is
        // asked only for one it recognises. A null answer means either that, or that the host could
        // not clear it, and both leave the caller with what it would have had anyway.
        val retry = ChallengeSolve.retryOf(request, restored, bytes.toString(Charsets.UTF_8))
            ?: return restored
        return chain.proceed(retry)
    }
}
