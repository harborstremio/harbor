package harbor.capstan.test

import com.harbor.capstan.StreamLink
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

/** What a produced link actually serves.
 *
 * A link is a claim until something fetches it. This asks for the first kilobyte with the headers
 * the extension attached, which is the same request a player makes first. */
class LinkProbe(
    val url: String,
    val status: Int,
    val contentType: String,
    val bytes: Int,
    val error: String?,
) {
    val served: Boolean get() = status in 200..299 && bytes > 0

    fun line(): String {
        val outcome = error ?: "$status ${contentType.ifEmpty { "?" }} ${bytes}B"
        return "$outcome  ${url.take(120)}"
    }
}

object LinkProbes {

    private const val WINDOW = 1024L

    private val client = OkHttpClient.Builder()
        .callTimeout(20, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    fun probe(links: List<StreamLink>, limit: Int): List<LinkProbe> = links.take(limit).map(::one)

    private fun one(link: StreamLink): LinkProbe {
        val builder = Request.Builder().url(link.url).header("Range", "bytes=0-${WINDOW - 1}")
        link.headers.forEach { (name, value) -> runCatching { builder.header(name, value) } }
        if (link.referer.isNotEmpty() && !link.headers.keys.any { it.equals("referer", true) }) {
            builder.header("Referer", link.referer)
        }
        return try {
            client.newCall(builder.build()).execute().use { response ->
                val body = response.body?.bytes()?.size ?: 0
                LinkProbe(
                    url = link.url,
                    status = response.code,
                    contentType = response.header("content-type").orEmpty().substringBefore(';').trim(),
                    bytes = body,
                    error = null,
                )
            }
        } catch (t: Throwable) {
            LinkProbe(link.url, 0, "", 0, line(t))
        }
    }
}
