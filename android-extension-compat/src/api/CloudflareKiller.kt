package com.lagradost.cloudstream3.network

import okhttp3.Interceptor
import okhttp3.Response

/** The interceptor extensions attach to the requests a Cloudflare-protected site needs.
 *
 * On a device this drives a WebView through the challenge and keeps the clearance cookie. There is
 * no browser engine here, so it does not: the request passes straight through. That is enough
 * because the challenge is already handled a layer down, on the request path every extension call
 * goes through, where Requests.kt spots a challenge response and asks the host to clear it
 * (ChallengeSolve, HostLink.solveChallenge). An extension that attaches this gets the same result
 * as one that does not. It exists so the class is there to construct. */
class CloudflareKiller : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response = chain.proceed(chain.request())
}
