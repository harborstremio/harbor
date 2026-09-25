package android.webkit

import harbor.compat.host.HostLink
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.Future
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.ThreadFactory
import java.util.concurrent.TimeUnit

/** Fetches documents for [WebView] over plain HTTP and drives the page callbacks from the result.
 *
 * This is the whole of the page pipeline. There is no renderer and no script engine here, so what a
 * view can honestly do is retrieve a document, learn its title, and keep the cookies the server set
 * along the way. A page whose content is produced by script arrives empty.
 *
 * A challenge page is the one exception. It cannot be cleared here either, so it is handed to the
 * attached host, which has a browser, and whatever clearance comes back is replayed on one retry.
 * With no host attached nothing is asked and the challenge page is returned as it always was.
 * Either way every load ends in a page-finished callback, so a caller times out on its own
 * schedule instead of hanging. */
internal object WebEngine {

    private const val MAX_REDIRECTS = 5
    private const val MAX_BODY_BYTES = 4 * 1024 * 1024
    private const val CONNECT_TIMEOUT_MS = 15000
    private const val READ_TIMEOUT_MS = 20000

    private val pool: ScheduledExecutorService =
        Executors.newScheduledThreadPool(2, ThreadFactory { r ->
            val t = Thread(r, "compat-webview")
            t.isDaemon = true
            t
        })

    private val titlePattern = Regex(
        "<title[^>]*>(.*?)</title>",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    )
    private val charsetPattern = Regex("charset=\\s*\"?([A-Za-z0-9_.:-]+)", RegexOption.IGNORE_CASE)
    private val spacePattern = Regex("\\s+")

    fun schedule(action: Runnable, delayMillis: Long): Boolean {
        return try {
            pool.schedule(action, maxOf(0L, delayMillis), TimeUnit.MILLISECONDS)
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun load(view: WebView, url: String, headers: Map<String, String>?): Future<*>? {
        val extra = if (headers == null) emptyMap() else LinkedHashMap(headers)
        return try {
            pool.submit { run(view, url, extra) }
        } catch (_: Throwable) {
            null
        }
    }

    private fun run(view: WebView, url: String, headers: Map<String, String>) {
        val client = view.pageClientOrNull()
        val chrome = view.chromeClientOrNull()
        view.noteLoadStarted(url)
        safely { client?.onPageStarted(view, url, null) }
        safely { chrome?.onProgressChanged(view, 10) }

        if (!isHttp(url)) {
            view.noteLoadFinished(url, null)
            safely { chrome?.onProgressChanged(view, 100) }
            safely { client?.onPageFinished(view, url) }
            return
        }

        var current = url
        var title: String? = null
        var failure: String? = null
        try {
            var hop = 0
            var solveTried = false
            while (true) {
                val step = fetch(view, current, headers)
                val next = step.redirectTo
                if (next == null) {
                    if (!solveTried && clearChallenge(view, current, step)) {
                        solveTried = true
                        continue
                    }
                    title = step.title
                    break
                }
                hop++
                if (hop > MAX_REDIRECTS) break
                if (view.isDestroyed()) return
                val handled = safelyBool {
                    client?.shouldOverrideUrlLoading(view, SimpleResourceRequest(next)) ?: false
                }
                current = next
                if (handled) break
                safely { client?.onPageStarted(view, current, null) }
            }
        } catch (t: Throwable) {
            failure = t.message ?: t.javaClass.simpleName
        }

        if (view.isDestroyed()) return
        view.noteLoadFinished(current, title)
        if (failure != null) {
            safely { client?.onReceivedError(view, WebViewClient.ERROR_CONNECT, failure, current) }
        } else if (title != null) {
            safely { chrome?.onReceivedTitle(view, title) }
        }
        safely { chrome?.onProgressChanged(view, 100) }
        safely { client?.onPageFinished(view, current) }
    }

    private fun isHttp(url: String): Boolean =
        url.startsWith("http://", true) || url.startsWith("https://", true)

    private class Step(
        val title: String?,
        val redirectTo: String?,
        val status: Int = 0,
        val mitigated: String? = null,
        val body: String = "",
    )

    /** Hands a challenge page to the attached host and keeps what it cleared.
     *
     * True when the caller should fetch again, which only happens when a host answered with a
     * clearance. With no host attached this returns false without asking anything, so a standalone
     * run reaches the same challenge page it always did. */
    private fun clearChallenge(view: WebView, url: String, step: Step): Boolean {
        if (!HostLink.isChallenge(step.status, step.mitigated, step.body)) return false
        val solution = HostLink.solveChallenge(url) ?: return false
        val jar = CookieManager.getInstance()
        // One call per pair: the jar reads everything after the first semicolon as attributes.
        for (pair in solution.cookie.split(';')) {
            val one = pair.trim()
            if (one.contains('=')) jar.setCookie(url, one)
        }
        view.getSettings().setUserAgentString(solution.userAgent)
        return true
    }

    private fun fetch(view: WebView, url: String, headers: Map<String, String>): Step {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = CONNECT_TIMEOUT_MS
        connection.readTimeout = READ_TIMEOUT_MS
        connection.requestMethod = "GET"
        connection.setRequestProperty("User-Agent", view.getSettings().getUserAgentString())
        connection.setRequestProperty(
            "Accept",
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        )
        connection.setRequestProperty("Accept-Language", "en-US,en;q=0.9")
        val cookies = CookieManager.getInstance().getCookie(url)
        if (!cookies.isNullOrEmpty()) connection.setRequestProperty("Cookie", cookies)
        for (entry in headers.entries) connection.setRequestProperty(entry.key, entry.value)

        try {
            val status = connection.responseCode
            storeCookies(url, connection)
            if (status in 300..399) {
                val location = connection.getHeaderField("Location")
                if (!location.isNullOrEmpty()) return Step(null, resolve(url, location))
            }
            val stream: InputStream? =
                if (status >= 400) connection.errorStream else connection.inputStream
            val body = readBody(stream, connection.contentType)
            return Step(
                extractTitle(body), null, status,
                connection.getHeaderField("cf-mitigated"), body,
            )
        } finally {
            connection.disconnect()
        }
    }

    private fun storeCookies(url: String, connection: HttpURLConnection) {
        val headers = connection.headerFields ?: return
        val values = ArrayList<String>()
        for (entry in headers.entries) {
            val key = entry.key ?: continue
            val name = key.lowercase(Locale.ROOT)
            if (name == "set-cookie" || name == "set-cookie2") {
                values.addAll(entry.value.filterNotNull())
            }
        }
        if (values.isNotEmpty()) CookieManager.getInstance().storeAll(url, values)
    }

    private fun readBody(stream: InputStream?, contentType: String?): String {
        if (stream == null) return ""
        val buffer = ByteArrayOutputStream()
        stream.use { input ->
            val chunk = ByteArray(16 * 1024)
            while (buffer.size() < MAX_BODY_BYTES) {
                val read = input.read(chunk)
                if (read < 0) break
                buffer.write(chunk, 0, read)
            }
        }
        val bytes = buffer.toByteArray()
        val declared = if (contentType == null) null else charsetPattern.find(contentType)?.groupValues?.get(1)
        val charset = try {
            if (declared != null) charset(declared) else Charsets.UTF_8
        } catch (_: Throwable) {
            Charsets.UTF_8
        }
        return String(bytes, charset)
    }

    private fun extractTitle(body: String): String? {
        val raw = titlePattern.find(body)?.groupValues?.get(1) ?: return null
        val text = spacePattern.replace(raw, " ")
            .replace("&amp;", "&")
            .replace("&quot;", "\"")
            .replace("&#39;", "'")
            .replace("&lt;", "<")
            .replace("&gt;", ">")
            .trim()
        return text.ifEmpty { null }
    }

    private fun resolve(base: String, location: String): String = try {
        URI(base).resolve(location).toString()
    } catch (_: Throwable) {
        location
    }

    private inline fun safely(block: () -> Unit) {
        try {
            block()
        } catch (_: Throwable) {
        }
    }

    private inline fun safelyBool(block: () -> Boolean): Boolean = try {
        block()
    } catch (_: Throwable) {
        false
    }
}
