package com.lagradost.cloudstream3.network

import com.lagradost.nicehttp.DEFAULT_USER_AGENT
import okhttp3.Interceptor
import okhttp3.Response

/**
 * No browser engine is available in this runtime, so the page cannot be rendered and its script
 * cannot run. The resolver still does the part that works without one: it fetches the page and
 * looks through the returned text for a link matching [interceptUrl], which is where most players
 * put the stream anyway. When nothing matches, the original response is passed through untouched.
 */
class WebViewResolver(
    val interceptUrl: Regex,
    val additionalUrls: List<Regex> = emptyList(),
    val userAgent: String? = DEFAULT_USER_AGENT,
    val useOkhttp: Boolean = true,
    val script: String? = null,
    val scriptCallback: ((String) -> Unit)? = null,
    val timeout: Long = DEFAULT_TIMEOUT
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = try {
            chain.proceed(chain.request())
        } catch (throwable: Throwable) {
            throw throwable
        }

        val target = try {
            findTarget(response)
        } catch (throwable: Throwable) {
            null
        } ?: return response

        val next = try {
            val builder = chain.request().newBuilder().url(target).get()
            if (userAgent != null) builder.header("user-agent", userAgent)
            chain.proceed(builder.build())
        } catch (throwable: Throwable) {
            null
        } ?: return response

        response.close()
        return next
    }

    private fun findTarget(response: Response): String? {
        val type = response.header("content-type").orEmpty().lowercase()
        if (type.isNotEmpty() && !type.startsWith("text/") && !type.contains("json") &&
            !type.contains("javascript") && !type.contains("xml")
        ) return null

        val text = response.peekBody(PEEK_BYTES).string().replace(ESCAPED_SLASH, "/")
        val candidates = URL_IN_TEXT.findAll(text).map { it.value.trimEnd(BACKSLASH, ',', ';') }.toList()
        if (candidates.isEmpty()) return null

        candidates.firstOrNull { interceptUrl.containsMatchIn(it) }?.let { return it }
        if (additionalUrls.isEmpty()) return null
        return candidates.firstOrNull { candidate -> additionalUrls.any { it.containsMatchIn(candidate) } }
    }

    companion object {
        const val DEFAULT_TIMEOUT = 15_000L
        private val BACKSLASH = 92.toChar()
        private val ESCAPED_SLASH = BACKSLASH + "/"
        private const val PEEK_BYTES = 4L * 1024 * 1024
        private val URL_IN_TEXT = Regex("""https?://[^\s"'<>()\[\]]+""")
    }
}
