package com.harbor.capstan

import com.lagradost.cloudstream3.app
import harbor.compat.host.PlatformHost
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.NewPipe
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import org.schabi.newpipe.extractor.exceptions.ReCaptchaException
import java.util.concurrent.atomic.AtomicBoolean
import okhttp3.Request as HttpRequest

private const val DESKTOP_AGENT =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/139.0.0.0 Safari/537.36"

private val started = AtomicBoolean(false)

/** The extractor library reads its downloader out of a static that the phone app fills in at
 * startup, so an extension built against it never calls init itself and would find that static
 * null here. Nothing else in the layer needs this, and a host that ships without the library
 * should lose one extension rather than all of them. */
internal fun startNewPipe() {
    if (!started.compareAndSet(false, true)) return
    try {
        NewPipe.init(HostDownloader())
    } catch (absent: Throwable) {
        started.set(false)
        PlatformHost.log(5, "capstan", "newpipe extractor is not on the classpath: ${describe(absent)}")
    }
}

/** Reads the client per call rather than holding one, so a host that replaces the shared client
 * after startup is honoured here too. */
private class HostDownloader : Downloader() {

    override fun execute(request: Request): Response {
        val method = request.httpMethod()
        val headers = request.headers().orEmpty()
        val builder = HttpRequest.Builder().url(request.url())
        headers.forEach { (name, values) ->
            builder.removeHeader(name)
            values.orEmpty().forEach { builder.addHeader(name, it) }
        }
        if (headers.keys.none { it.equals("User-Agent", ignoreCase = true) }) {
            builder.header("User-Agent", DESKTOP_AGENT)
        }
        val sent = request.dataToSend()
        val body = if (sent != null || method == "POST" || method == "PUT" || method == "PATCH") {
            (sent ?: ByteArray(0)).toRequestBody()
        } else {
            null
        }
        builder.method(method, body)
        app.baseClient.newCall(builder.build()).execute().use { response ->
            if (response.code == 429) {
                throw ReCaptchaException("rate limited, a captcha is being asked for", request.url())
            }
            val text = if (method == "HEAD") "" else response.body?.string().orEmpty()
            return Response(
                response.code,
                response.message,
                response.headers.toMultimap(),
                text,
                response.request.url.toString(),
            )
        }
    }
}
